import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizeTenant } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId') || '';
  const siteId = request.nextUrl.searchParams.get('siteId') || null;
  try {
    const client = await createClient();
    const access = await authorizeTenant(client, companyId, siteId);
    if (!access.ok) return fail(access.error, access.status);
    const { data: company, error: companyError } = await client.from('companies')
      .select('id,legal_name,slug').eq('id', companyId).maybeSingle();
    if (companyError || !company) return fail('Entreprise indisponible.', 503);

    // Head/count queries ask PostgREST for exact counts; no 200/1000-row approximation.
    const count = async (table: 'sites'|'customers'|'offers'|'subscription_orders'|'payments'|'wifi_tickets'|'walkin_sales') => {
      if (siteId && table === 'offers') return null; // Offers have no site_id: company-wide catalog only.
      if (table === 'wifi_tickets' && siteId) {
        const r = await client.from(table).select('id,subscription_orders!inner(site_id)',{ count:'exact',head:true })
          .eq('company_id',companyId).eq('subscription_orders.site_id',siteId);
        return r.error ? null : r.count;
      }
      if (table === 'payments' && siteId) {
        const r = await client.from(table).select('id,subscription_orders!inner(site_id)',{ count:'exact',head:true })
          .eq('company_id',companyId).eq('subscription_orders.site_id',siteId);
        return r.error ? null : r.count;
      }
      if (table === 'sites' && siteId) return 1;
      let query = client.from(table).select('id',{count:'exact',head:true}).eq('company_id',companyId);
      if (siteId && (table === 'customers' || table === 'subscription_orders' || table === 'walkin_sales')) {
        query = query.eq('site_id', siteId);
      }
      const { count: total, error } = await query;
      return error ? null : total;
    };
    const keys = ['sites','customers','offers','subscription_orders','payments','wifi_tickets','walkin_sales'] as const;
    const results = await Promise.all(keys.map(key=>count(key)));
    const metrics = Object.fromEntries(keys.map((key,i)=>[key,results[i]]));
    let recentQuery = client.from('subscription_orders')
      .select('id,site_id,public_reference,customer_name,offer_name,status,created_at')
      .eq('company_id',companyId).order('created_at',{ascending:false}).limit(6);
    if (siteId) recentQuery = recentQuery.eq('site_id',siteId);
    const [recentResult, sitesResult] = await Promise.all([
      recentQuery,
      client.from('sites').select('id,company_id,name,status').eq('company_id',companyId).order('name'),
    ]);
    if (recentResult.error || sitesResult.error) return fail('Activité ou liste des sites indisponible.',503);
    return NextResponse.json({
      company, site: access.site, role: access.member.role,
      metrics, sites: sitesResult.data ?? [], recentOrders: recentResult.data ?? [],
    },{headers:noStore});
  } catch {
    return fail('Impossible de charger le tableau de bord.',503);
  }
}
