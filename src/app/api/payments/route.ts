import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizeTenant } from '@/lib/tenant-context';
export const dynamic = 'force-dynamic';
const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request:NextRequest){
  const companyId=request.nextUrl.searchParams.get('companyId')??'';
  const siteId=request.nextUrl.searchParams.get('siteId')||null;
  if(!companyId)return json('Entreprise requise.',400);
  try{
    const supabase=await createClient();
    const access=await authorizeTenant(supabase,companyId,siteId);
    if(!access.ok)return json(access.error,access.status);

    const columns='id,company_id,order_id,provider,provider_payment_id,amount,currency,status,confirmed_at,created_at';
    let query=supabase.from('payments').select(columns+(siteId?',subscription_orders!inner(site_id)':'')).eq('company_id',companyId);
    if(siteId)query=query.eq('subscription_orders.site_id',siteId);
    const {data,error}=await query.order('created_at',{ascending:false}).limit(200);
    if(error)return json('Impossible de charger les paiements.',503);
    return NextResponse.json({payments:data??[]},{headers:{'Cache-Control':'no-store'}});
  }catch{return json('Service indisponible.',503);}
}
