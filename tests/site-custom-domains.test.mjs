import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('site domain registry is exclusive, pending by default and protected from browser writes',()=>{
 const sql=read('supabase/migrations/20261105164000_site_custom_domains.sql');
 assert.match(sql,/site_id uuid primary key/);
 assert.match(sql,/hostname text not null unique/);
 assert.match(sql,/status text not null default 'pending'/);
 assert.match(sql,/status <> 'active' or verified_at is not null/);
 assert.match(sql,/enforce_site_domain_company/);
 assert.match(sql,/s\.id=new\.site_id and s\.company_id=new\.company_id/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public.site_custom_domains from public,anon,authenticated/);
});

test('only authorized tenant admins may register a domain; no browser-supplied activation status',()=>{
 const route=read('src/app/api/site-domains/route.ts');
 assert.match(route,/authorizeTenant\(client,companyId,siteId\)/);
 assert.match(route,/\['owner','admin'\]\.includes\(access.member.role\)/);
 assert.match(route,/status:'pending'/);
 assert.match(route,/verified_at:null/);
 assert.match(route,/checkSiteProjectDomain\(current.hostname,'verify'\)/);
 assert.match(route,/status:check.active\?'active':'pending'/);
 assert.match(route,/\.eq\('site_id',siteId\)\.eq\('company_id',companyId\)\.eq\('hostname',current.hostname\)/);
 assert.match(route,/hostname.endsWith\('\.vercel.app'\)/);
});

test('Vercel verification requires BOTH ownership and DNS correctness',()=>{
 const integration=read('src/lib/site-domain-vercel.ts');
 assert.match(integration,/ZARAY_VERCEL_API_TOKEN/);
 assert.match(integration,/ZARAY_VERCEL_PROJECT_ID/);
 assert.match(integration,/ZARAY_VERCEL_TEAM_ID/);
 assert.match(integration,/domain.verified===true/);
 assert.match(integration,/dns.misconfigured===false/);
 assert.match(integration,/active:verified&&dnsConfigured/);
 assert.doesNotMatch(integration,/NEXT_PUBLIC_.*TOKEN/);
});

test('custom host routes are isolated and preserve refreshed auth cookies',()=>{
 const proxy=read('proxy.ts');
 assert.match(proxy,/hostname\.endsWith\('\.vercel.app'\)/);
 assert.match(proxy,/\.eq\('hostname',hostname\)\.eq\('status','active'\)/);
 assert.match(proxy,/site.status!=='active'/);
 assert.match(proxy,/target.pathname='\/mon-internet\/'\+site.siteId/);
 assert.match(proxy,/target.pathname='\/api\/public\/residential-icon'/);
 assert.match(proxy,/return denied\(\)/);
 assert.match(proxy,/for\(const cookie of cookiesToSet\)response.cookies.set/);
 assert.match(proxy,/getUser\(\)/);
});

test('site administrators can open domain management; clients retain white-label portal',()=>{
 const sites=read('src/app/sites/page.tsx');
 const settings=read('src/app/sites/[siteId]/domaine/page.tsx');
 const residential=read('src/app/mon-internet/[siteId]/page.tsx');
 assert.match(sites,/\/domaine\?companyId=/);
 assert.match(settings,/\/api\/site-domains/);
 assert.match(settings,/\/api\/site-links/);
 assert.match(settings,/Aucun achat de domaine ni réglage DNS n’est nécessaire/);
 assert.doesNotMatch(settings,/Ouvrir la configuration Vercel/);
 assert.match(residential,/applicationName:name/);
});


test('custom-domain subscriptions and payment links cannot escape the linked site',()=>{
 const proxy=read('proxy.ts');
 const portal=read('src/app/api/portal/[slug]/route.ts');
 const status=read('src/app/api/manual-payments/status/route.ts');
 const payment=read('src/components/residential-payment-status.tsx');
 const page=read('src/app/mon-internet/[siteId]/paiement/[reference]/page.tsx');
 assert.match(proxy,/paymentReference\.length===12/);
 assert.match(proxy,/target\.pathname='\/mon-internet\/'\+site\.siteId\+'\/paiement\/'/);
 assert.match(proxy,/path==='\/api\/manual-payments\/status'/);
 assert.match(portal,/customSiteOf\(request\)/);
 assert.match(portal,/domainSite\.siteId/);
 assert.match(portal,/allowedSites/);
 assert.match(status,/if\(siteId&&order\.site_id!==siteId\)/);
 assert.match(payment,/siteId:site.siteId/);
 assert.match(payment,/site\.logoDataUri/);
 assert.doesNotMatch(payment,/>ZARAY</);
 assert.match(page,/publicResidentialSite\(siteId\)/);
});
