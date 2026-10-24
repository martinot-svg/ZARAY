import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const reference = (request.nextUrl.searchParams.get('reference') ?? '').trim().toUpperCase();
  if (!/^[A-F0-9]{12}$/.test(reference)) return NextResponse.json({ error: 'Référence invalide.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const { data: order, error } = await service.from('subscription_orders')
    .select('id,public_reference,offer_name,amount,currency,status,paid_at')
    .eq('public_reference', reference).maybeSingle();
  if (error) { console.error('manual payment status order lookup failed', { code: error.code }); return NextResponse.json({ error: 'Service indisponible.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  if (!order) return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const { data: submission, error: submissionError } = await service.from('manual_payment_submissions')
    .select('provider,status,created_at,reviewed_at')
    .eq('order_id', order.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (submissionError) { console.error('manual payment status submission lookup failed', { code: submissionError.code }); return NextResponse.json({ error: 'Service indisponible.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  return NextResponse.json({
    reference: order.public_reference,
    offerName: order.offer_name,
    amount: order.amount,
    currency: order.currency,
    orderStatus: order.status,
    paid: order.status === 'paid' && Boolean(order.paid_at),
    submission: submission ? {
      provider: submission.provider,
      status: submission.status,
      createdAt: submission.created_at,
      reviewedAt: submission.reviewed_at,
    } : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
