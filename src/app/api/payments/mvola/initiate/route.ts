import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMvolaAccessToken, getMvolaConfig, mvolaHeaders } from '@/lib/mvola';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export async function POST(request: NextRequest) {
  const config = getMvolaConfig();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.zaray_SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !supabaseUrl || !serviceKey) return json({ error: 'Le paiement MVola n’est pas encore configuré. Votre commande reste en attente et aucun accès Internet ne sera activé.' }, 503);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const reference = typeof body?.reference === 'string' ? body.reference.trim().toUpperCase() : '';
  if (!/^[A-F0-9]{12}$/.test(reference)) return json({ error: 'Référence de commande invalide.' }, 400);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: order, error: orderError } = await supabase.from('subscription_orders')
    .select('id,public_reference,company_id,customer_phone,amount,currency,status,paid_at')
    .eq('public_reference', reference).maybeSingle();
  if (orderError) return json({ error: 'Impossible de vérifier la commande.' }, 503);
  if (!order) return json({ error: 'Commande introuvable.' }, 404);
  if (order.status === 'paid' && order.paid_at) return json({ error: 'Cette commande est déjà payée.' }, 409);
  if (order.status !== 'pending_payment') return json({ error: 'Cette commande n’est plus payable.' }, 409);
  if (!order.customer_phone || !/^03\d{8}$/.test(order.customer_phone)) return json({ error: 'Un numéro mobile malgache valide est nécessaire pour demander le paiement MVola.' }, 400);
  if (order.currency !== 'MGA' || !Number.isSafeInteger(Number(order.amount)) || Number(order.amount) < 1) {
    return json({ error: 'Le montant doit être un nombre entier en ariary (MGA) pour MVola.' }, 409);
  }

  const { data: existing, error: existingError } = await supabase.from('payments')
    .select('id,provider_payment_id,status')
    .eq('order_id', order.id).eq('provider', 'mvola').in('status', ['pending','succeeded','review_required'])
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existingError) return json({ error: 'Impossible de vérifier les tentatives de paiement.' }, 503);
  if (existing?.status === 'succeeded') return json({ error: 'Cette commande est déjà payée.' }, 409);
  if (existing?.status === 'pending') return json({ accepted: true, alreadyStarted: true, status: 'pending', message: 'Une demande MVola existe déjà. Terminez-la sur votre téléphone puis attendez la confirmation.' }, 200);
  if (existing?.status === 'review_required') return json({ error: 'Un paiement doit être rapproché par le support avant toute nouvelle tentative.' }, 409);

  const correlationId = randomUUID();
  const { error: insertError } = await supabase.from('payments').insert({
    company_id: order.company_id,
    order_id: order.id,
    provider: 'mvola',
    provider_payment_id: correlationId,
    idempotency_key: 'mvola-init:' + order.id + ':' + correlationId,
    amount: Number(order.amount),
    currency: order.currency,
    status: 'pending',
  });
  if (insertError) return json({ error: 'Impossible de préparer une tentative de paiement.' }, 503);

  try {
    const token = await getMvolaAccessToken(config);
    const callbackUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zaray.vercel.app').replace(/\/+$/, '') + '/api/payments/mvola/callback';
    const response = await fetch(config.apiBase + '/mvola/mm/transactions/type/merchantpay/1.0.0/', {
      method: 'POST',
      headers: { ...mvolaHeaders(config, token, order.customer_phone), 'X-Callback-URL': callbackUrl },
      body: JSON.stringify({
        amount: String(Number(order.amount)),
        currency: 'Ar',
        descriptionText: 'ZARAY ' + order.public_reference,
        requestDate: new Date().toISOString(),
        debitParty: [{ key: 'msisdn', value: order.customer_phone }],
        creditParty: [{ key: 'msisdn', value: config.partnerMsisdn }],
        metadata: [
          { key: 'partnerName', value: config.partnerName },
          { key: 'orderReference', value: order.public_reference },
        ],
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok || !result || typeof result.serverCorrelationId !== 'string') {
      await supabase.from('payments').update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('provider', 'mvola').eq('provider_payment_id', correlationId).eq('status', 'pending');
      console.error('MVola initiation failed', { status: response.status, correlationId });
      return json({ error: 'MVola n’a pas accepté la demande de paiement. Réessayez plus tard.' }, 502);
    }
    // The locally generated correlation ID is the ledger's stable transaction key.
    // MVola's serverCorrelationId is retained only in the response to aid reconciliation.
    return json({
      accepted: true,
      status: 'pending',
      reference: order.public_reference,
      correlationId,
      mvolaCorrelationId: result.serverCorrelationId,
      message: 'Demande envoyée à MVola. Validez-la sur votre téléphone. Le forfait ne sera pas activé avant confirmation vérifiée.',
    }, 202);
  } catch {
    await supabase.from('payments').update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('provider', 'mvola').eq('provider_payment_id', correlationId).eq('status', 'pending');
    return json({ error: 'MVola est temporairement inaccessible. La commande reste non activée.' }, 502);
  }
}
