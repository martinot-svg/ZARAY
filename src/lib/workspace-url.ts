/** Shared client-side navigation only. All authorization is performed by server APIs and RLS. */
export type CompanyOption = { id:string };
export type SiteOption = { id:string;company_id:string };
export function activeSiteId(): string | null {
  return typeof window==='undefined' ? null : new URLSearchParams(window.location.search).get('siteId');
}
export function selectedCompany(companies:CompanyOption[],sites:SiteOption[]=[]): string {
  if(typeof window==='undefined')return companies[0]?.id||'';
  const params=new URLSearchParams(window.location.search);
  const fromURL=params.get('companyId');
  const site=params.get('siteId');
  const chosen=fromURL || (site ? sites.find(s=>s.id===site)?.company_id : '') || companies[0]?.id || '';
  if(fromURL&&!companies.some(c=>c.id===fromURL))throw new Error('Entreprise inaccessible.');
  if(site&&!sites.some(s=>s.id===site&&s.company_id===chosen))throw new Error('Site inaccessible dans cette entreprise.');
  return chosen;
}
export function scopedQuery(companyId:string): string {
  const params=new URLSearchParams({companyId});
  const site=activeSiteId();
  if(site)params.set('siteId',site);
  return params.toString();
}
export function switchCompany(path:string,companyId:string) {
  window.location.assign(path+'?companyId='+encodeURIComponent(companyId));
}
