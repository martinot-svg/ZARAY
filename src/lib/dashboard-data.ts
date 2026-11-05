import type { createClient } from '@/lib/supabase/server';
import type { authorizeTenant } from '@/lib/tenant-context';
import type { DashboardMetrics, DashboardPayload } from '@/lib/dashboard-types';

type Client = Awaited<ReturnType<typeof createClient>>;
type AuthorizedTenant = Extract<Awaited<ReturnType<typeof authorizeTenant>>, {ok:true}>;

/**
 * The page and API use one tenant-authorized data reader. Nothing is cached across
 * users, companies or sites. The page renders real metrics on its first response,
 * rather than waiting for a second client-side dashboard request.
 */
export async function getDashboardData(
  client: Client, companyId: string, siteId: string | null, access: AuthorizedTenant
): Promise<DashboardPayload> {
  const { data: company, error: companyError } = await client.from('companies')
    .select('id,legal_name,slug').eq('id', companyId).maybeSingle();
  if (companyError || !company) throw new Error('Entreprise indisponible.');

  // Exact counts; a missing metric is not silently replaced with zero.
  const count = async (table: keyof DashboardMetrics): Promise<number|null> => {
    if (siteId && table === 'offers') return null;
    if (table === 'wifi_tickets' && siteId) {
      const r = await client.from(table).select('id,subscription_orders!inner(site_id)', { count:'exact',head:true })
        .eq('company_id',companyId).eq('subscription_orders.site_id',siteId);
      return r.error ? null : r.count;
    }
    if (table === 'payments' && siteId) {
      const r = await client.from(table).select('id,subscription_orders!inner(site_id)', { count:'exact',head:true })
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
  const results = await Promise.all(keys.map(key => count(key)));
  const metrics = Object.fromEntries(keys.map((key,i) => [key,results[i]])) as DashboardMetrics;
  let recentQuery = client.from('subscription_orders')
    .select('id,site_id,public_reference,customer_name,offer_name,status,created_at')
    .eq('company_id',companyId).order('created_at',{ascending:false}).limit(6);
  if (siteId) recentQuery = recentQuery.eq('site_id',siteId);
  const [recentResult,sitesResult] = await Promise.all([
    recentQuery,
    client.from('sites').select('id,company_id,name,status').eq('company_id',companyId).order('name'),
  ]);
  if (recentResult.error || sitesResult.error) throw new Error('Activité ou liste des sites indisponible.');

  return {
    company, site: access.site, role: access.member.role,
    metrics, sites: sitesResult.data ?? [], recentOrders: recentResult.data ?? [],
  };
}
