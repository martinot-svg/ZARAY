import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMvolaConfig } from '@/lib/mvola';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const reference = (request.nextUrl.searchParams.get('reference') ?? '').trim().toUpperCase();
  if (!/^[A-F0-9]{12}$/.test(reference)) return NextResponse.json({ error: 'Référence invalide.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.zaray_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: order, error } = await supabase.from('subscription_orders').select('id,status,paid_at').eq('public_reference', reference).maybeSingle();
  if (error) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  if (!order) return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  // This endpoint reports the server-side ledger only. It never marks a payment as paid.
  const { data: payment } = await supabase.from('payments').select('status,confirmed_at').eq('order_id', order.id).eq('provider', 'mvola').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const config = getMvolaConfig();
  return NextResponse.json({
    reference,
    orderStatus: order.status,
    paid: order.status === 'paid' && Boolean(order.paid_at),
    paymentStatus: payment?.status ?? 'not_started',
    providerConfigured: Boolean(config),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
