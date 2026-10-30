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

const orderColumns='id,company_id,site_id,customer_id,offer_id,customer_name,customer_email,customer_phone,offer_name,public_reference,amount,currency,status,paid_at,activated_at,created_at';
const validStatuses=new Set(['pending_payment','paid','cancelled','expired','activation_pending','active','failed']);
const datePattern=/^\d{4}-\d{2}-\d{2}$/;

export async function GET(request:NextRequest){
  const params=request.nextUrl.searchParams;
  const companyId=params.get('companyId')??'';
  const siteId=params.get('siteId')||null;
  if(!companyId)return json('Entreprise requise.',400);
  const page=Math.max(1,Math.min(10000,Number(params.get('page')||1)||1));
  const pageSize=Math.max(1,Math.min(200,Number(params.get('pageSize')||200)||200));
  const tab=params.get('tab')||'all';
  const status=params.get('status')||'all';
  const from=params.get('from')||'';
  const to=params.get('to')||'';
  // PostgREST .or uses a special grammar: strip its separators before interpolation.
  const search=(params.get('search')||'').trim().replace(/[^\p{L}\p{N}@._+ -]/gu,'').slice(0,80);
  if(!['all','pending','history'].includes(tab))return json('Onglet inconnu.',400);
  if(status!=='all'&&!validStatuses.has(status))return json('Statut inconnu.',400);
  if((from&&!datePattern.test(from))||(to&&!datePattern.test(to))||(from&&to&&from>to))return json('Période invalide.',400);

  try{
    const supabase=await createClient();
    const access=await authorizeTenant(supabase,companyId,siteId);
    if(!access.ok)return json(access.error,access.status);

    const baseList=supabase.from('subscription_orders')
      .select(orderColumns,{count:'exact'}).eq('company_id',companyId);
    let list=siteId?baseList.eq('site_id',siteId):baseList;
    if(from)list=list.gte('created_at',from+'T00:00:00Z');
    if(to)list=list.lte('created_at',to+'T23:59:59.999Z');
    if(status!=='all')list=list.eq('status',status);
    else if(tab==='pending')list=list.in('status',['pending_payment','paid','activation_pending','failed']);
    else if(tab==='history')list=list.in('status',['active','cancelled','expired']);
    if(search){
      const term='%'+search+'%';
      list=list.or('customer_name.ilike.'+term+',customer_email.ilike.'+term+
        ',customer_phone.ilike.'+term+',public_reference.ilike.'+term+',offer_name.ilike.'+term);
    }
    const offset=(page-1)*pageSize;
    const listPromise=list.order('created_at',{ascending:false}).range(offset,offset+pageSize-1);

    // Counters cover the full tenant/site and selected period, not just the visible page.
    const count=(filter:'total'|'unpaid'|'paid'|'activation')=>{
      let q=supabase.from('subscription_orders').select('id',{count:'exact',head:true}).eq('company_id',companyId);
      if(siteId)q=q.eq('site_id',siteId);
      if(from)q=q.gte('created_at',from+'T00:00:00Z');
      if(to)q=q.lte('created_at',to+'T23:59:59.999Z');
      if(filter==='unpaid')q=q.eq('status','pending_payment');
      if(filter==='paid')q=q.not('paid_at','is',null);
      if(filter==='activation')q=q.in('status',['paid','activation_pending']).is('activated_at',null);
      return q;
    };
    const [result,total,unpaid,paid,activation]=await Promise.all([
      listPromise,count('total'),count('unpaid'),count('paid'),count('activation')
    ]);
    if(result.error||total.error||unpaid.error||paid.error||activation.error)
      return json('Impossible de charger les commandes.',503);
    return NextResponse.json({
      orders:result.data??[],
      total:result.count??0,
      page,pageSize,
      stats:{total:total.count??0,unpaid:unpaid.count??0,paid:paid.count??0,activation:activation.count??0},
      period:{from,to}
    },{headers:{'Cache-Control':'no-store'}});
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
