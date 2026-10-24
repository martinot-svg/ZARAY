import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

type PaymentEvent = {
  provider: string;
  eventId: string;
  paymentId: string;
  orderReference: string;
  amount: number;
  currency: string;
  status: string;
};

function validEvent(value: unknown): value is PaymentEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.provider === 'string' && /^[a-z0-9_-]{2,40}$/i.test(v.provider) &&
    typeof v.eventId === 'string' && v.eventId.trim().length > 0 && v.eventId.length <= 200 &&
    typeof v.paymentId === 'string' && v.paymentId.trim().length > 0 && v.paymentId.length <= 200 &&
    typeof v.orderReference === 'string' && v.orderReference.trim().length > 0 && v.orderReference.length <= 40 &&
    typeof v.amount === 'number' && Number.isFinite(v.amount) && v.amount >= 0 &&
    typeof v.currency === 'string' && /^[A-Z]{3}$/i.test(v.currency) &&
    typeof v.status === 'string' && v.status.length <= 40;
}

export async function POST(request: NextRequest) {
  const secret = process.env.ZARAY_PAYMENT_WEBHOOK_SECRET;
  const serviceKey = process.env.zaray_SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !serviceKey || !supabaseUrl) return json({ error: 'Webhook de paiement non configuré.' }, 503);

  const rawBody = await request.text();
  if (rawBody.length > 32_000) return json({ error: 'Événement trop volumineux.' }, 413);
  const signature = request.headers.get('x-zaray-signature') ?? '';
  if (!/^[0-9a-f]{64}$/i.test(signature)) return json({ error: 'Signature invalide.' }, 401);
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  const received = Buffer.from(signature, 'hex');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return json({ error: 'Signature invalide.' }, 401);

  let event: unknown;
  try { event = JSON.parse(rawBody); } catch { return json({ error: 'JSON invalide.' }, 400); }
  if (!validEvent(event)) return json({ error: 'Format de paiement invalide.' }, 400);

  try {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const payloadHash = createHash('sha256').update(rawBody, 'utf8').digest('hex');
    const { data, error } = await supabase.rpc('process_payment_webhook', {
      p_provider: event.provider.toLowerCase(),
      p_provider_payment_id: event.paymentId,
      p_event_id: event.eventId,
      p_order_reference: event.orderReference,
      p_amount: event.amount,
      p_currency: event.currency.toUpperCase(),
      p_event_status: event.status,
      p_payload_hash: payloadHash,
    });
    if (error) {
      console.error('payment webhook rejected', { code: error.code, message: error.message });
      if (error.message?.includes('order_not_found')) return json({ error: 'Commande introuvable.' }, 404);
      if (error.message?.includes('mismatch') || error.code === '22023') return json({ error: 'Événement de paiement incohérent.' }, 409);
      if (error.code === '23505') return json({ error: 'Événement déjà reçu ou conflit d’identifiant.' }, 409);
      return json({ error: 'Événement de paiement refusé.' }, 400);
    }
    return json({ accepted: true, result: data }, 200);
  } catch {
    return json({ error: 'Traitement du paiement indisponible.' }, 503);
  }
}
