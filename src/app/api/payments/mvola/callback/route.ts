import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMvolaAccessToken, getMvolaConfig, mvolaHeaders, normalizeMvolaStatus } from '@/lib/mvola';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const transactionPath = '/mvola/mm/transactions/type/merchantpay/1.0.0/status/';

async function verifyWithMvola(correlationId: string) {
  const config = getMvolaConfig();
  if (!config) throw new Error('mvola_not_configured');
  const token = await getMvolaAccessToken(config);
  const response = await fetch(config.apiBase + transactionPath + encodeURIComponent(correlationId), {
    method: 'GET',
    headers: { ...mvolaHeaders(config, token, config.partnerMsisdn), 'X-CorrelationID': randomUUID() },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('mvola_status_failed');
  const statusData = await response.json() as Record<string, unknown>;
  // MVola's status endpoint returns an objectReference, while the details endpoint
  // contains the transaction amount, currency and final transactionStatus.
  const transactionId = typeof statusData.objectReference === 'string' ? statusData.objectReference : '';
  if (!transactionId) return statusData;
  const detailsResponse = await fetch(config.apiBase + '/mvola/mm/transactions/type/merchantpay/1.0.0/' + encodeURIComponent(transactionId), {
    method: 'GET',
    headers: { ...mvolaHeaders(config, token, config.partnerMsisdn), 'X-CorrelationID': randomUUID() },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!detailsResponse.ok) throw new Error('mvola_details_failed');
  const details = await detailsResponse.json() as Record<string, unknown>;
  return { ...statusData, ...details, status: statusData.status ?? details.transactionStatus };
}

async function handle(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.zaray_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || !getMvolaConfig()) return json({ error: 'MVola non configuré.' }, 503);

  let payload: Record<string, unknown> = {};
  if (request.method === 'POST') {
    payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  } else {
    payload = Object.fromEntries(request.nextUrl.searchParams.entries());
  }
  const candidate = payload.serverCorrelationId ?? payload.correlationId ?? payload.transactionId;
  const correlationId = typeof candidate === 'string' ? candidate.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(correlationId)) {
    return json({ error: 'Référence de transaction invalide.' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: payment, error: paymentError } = await supabase.from('payments')
    .select('id,order_id,company_id,provider,provider_payment_id,status')
    .eq('provider', 'mvola').eq('provider_payment_id', correlationId).maybeSingle();
  if (paymentError) return json({ error: 'Impossible de retrouver le paiement.' }, 503);
  if (!payment) return json({ accepted: true, ignored: true }, 200);

  try {
    const verified = await verifyWithMvola(correlationId);
    const status = normalizeMvolaStatus(verified.transactionStatus ?? verified.status);
    if (!status) {
      console.warn('MVola returned an unknown transaction status', { correlationId });
      return json({ accepted: true, pending: true }, 202);
    }
    const { data: order, error: orderError } = await supabase.from('subscription_orders')
      .select('id,public_reference,amount,currency,status,paid_at')
      .eq('id', payment.order_id).maybeSingle();
    if (orderError || !order) return json({ error: 'Commande introuvable.' }, 503);

    const providerAmount = Number(verified.amount);
    const providerCurrency = typeof verified.currency === 'string' ? verified.currency.toUpperCase() : '';
    if (status === 'completed') {
      const currencyMatches = providerCurrency === 'AR' || providerCurrency === 'MGA';
      if (!Number.isFinite(providerAmount) || providerAmount !== Number(order.amount) || !currencyMatches || order.currency !== 'MGA') {
        console.error('MVola payment requires reconciliation', { correlationId, orderReference: order.public_reference });
        return json({ error: 'Confirmation reçue, mais le montant ou la devise nécessite un rapprochement manuel.' }, 409);
      }
    }

    const stableEvent = JSON.stringify({
      correlationId,
      status,
      amount: verified.amount ?? null,
      currency: verified.currency ?? null,
      transactionReference: verified.transactionReference ?? null,
    });
    const eventId = 'mvola:' + correlationId + ':' + status;
    const payloadHash = createHash('sha256').update(stableEvent).digest('hex');
    const { data, error } = await supabase.rpc('process_payment_webhook', {
      p_provider: 'mvola',
      p_provider_payment_id: correlationId,
      p_event_id: eventId,
      p_order_reference: order.public_reference,
      p_amount: order.amount,
      p_currency: order.currency,
      p_event_status: status,
      p_payload_hash: payloadHash,
    });
    if (error) {
      console.error('MVola event processing failed', { code: error.code, correlationId });
      return json({ error: 'Le paiement n’a pas pu être rapproché.' }, 503);
    }
    return json({ accepted: true, status, result: data }, 200);
  } catch {
    return json({ error: 'Vérification MVola temporairement indisponible.' }, 503);
  }
}

export async function POST(request: NextRequest) { return handle(request); }
export async function GET(request: NextRequest) { return handle(request); }
