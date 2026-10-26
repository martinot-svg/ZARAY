import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizeTenant } from '@/lib/tenant-context';
export const dynamic = 'force-dynamic';
const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

async function verified() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, response: json('Connexion requise.', 401) };
  if (!user.email_confirmed_at) return { supabase, response: json('Vérifiez votre e-mail.', 403) };
  return { supabase, response: null };
}

export async function GET(request:NextRequest){
  const companyId=request.nextUrl.searchParams.get('companyId')??'';
  const siteId=request.nextUrl.searchParams.get('siteId')||null;
  if(!companyId)return json('Entreprise requise.',400);
  try{
    const supabase=await createClient();
    const access=await authorizeTenant(supabase,companyId,siteId);
    if(!access.ok)return json(access.error,access.status);

    let query=supabase.from('subscription_orders').select('id,company_id,site_id,offer_id,customer_name,customer_email,customer_phone,offer_name,public_reference,amount,currency,status,paid_at,activated_at,created_at').eq('company_id',companyId);
    if(siteId)query=query.eq('site_id',siteId);
    const {data,error}=await query.order('created_at',{ascending:false}).limit(200);
    if(error)return json('Impossible de charger les commandes.',503);
    return NextResponse.json({orders:data??[]},{headers:{'Cache-Control':'no-store'}});
  }catch{return json('Service indisponible.',503);}
}
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.orderId !== 'string') return json('Commande requise.', 400);
  try {
    const { supabase, response } = await verified();
    if (response) return response;
    const receiptNumber = `RC-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    const { data, error } = await supabase.rpc('record_subscription_cash_payment', { p_order_id: body.orderId, p_receipt_number: receiptNumber });
    if (error) {
      if (error.code === '42501' || error.message?.includes('role_not_authorized')) return json('Permission insuffisante pour encaisser ce paiement.', 403);
      if (error.code === 'P0002') return json('Commande introuvable.', 404);
      if (error.message?.includes('order_not_payable')) return json('Cette commande ne peut plus être encaissée.', 409);
      return json('Impossible d’enregistrer le paiement en espèces.', 400);
    }
    return NextResponse.json({ receipt: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch { return json('Service indisponible.', 503); }
}
