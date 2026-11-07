import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('the live WiFi portal displays the site identity and no vendor branding',()=>{
 const web=read('src/components/public-wifi-portal.tsx');
 assert.match(web,/\/api\/public\/residential-site\?siteId=/);
 assert.match(web,/currentIdentity=siteIdentity\?\.siteId===selectedSiteId&&siteIdentity\.companySlug===slug/);
 assert.match(web,/currentIdentity\?\.brandName/);
 assert.match(web,/currentIdentity\?\.logoDataUri/);
 assert.match(web,/!demo&&selectedSiteId&&/);
 assert.match(web,/portalDesign\?\.showAccount/);
 assert.match(web,/\/mon-internet\//);
 assert.doesNotMatch(web,/Propulsé par ZARAY|dans ZARAY après enregistrement/);
 const meta=read('src/app/wifi/[slug]/page.tsx');
 assert.doesNotMatch(meta,/title:\s*['"]Portail Wi-Fi client \| ZARAY/);
 assert.match(meta,/generateMetadata/);
});

test('public branding is restricted to the selected active site and site-level template',()=>{
 const site=read('src/lib/residential-site-identity.ts');
 assert.match(site,/uuid\.test\(siteId\)/);
 assert.match(site,/\.eq\('id',siteId\)/);
 assert.match(site,/\.eq\('company_id',site.company_id\)/);
 assert.match(site,/\.eq\('site_id',siteId\)\.is\('offer_id',null\)/);
 assert.match(site,/logoDataUri:logo\(template\?\.logo_data_uri\)/);
 assert.doesNotMatch(site,/process\.env\.NEXT_PUBLIC_SUPABASE_SECRET/);
 const api=read('src/app/api/public/residential-site/route.ts');
 assert.match(api,/publicResidentialSite\(siteId\)/);
 assert.doesNotMatch(api,/network_access_accounts|customers/);
});

test('resident OTP never leaks whether an email is a site subscriber',()=>{
 const route=read('src/app/api/residential/otp/route.ts');
 assert.match(route,/\.eq\('company_id',site.company_id\)\.eq\('site_id',siteId\)\.eq\('email',email\)/);
 assert.match(route,/if\(customer\)/);
 assert.match(route,/shouldCreateUser:true/);
 assert.match(route,/Si cette adresse possède un abonnement sur ce site/);
 assert.doesNotMatch(route,/password:/);
});

test('client account is authorized using verified identity and all tenant dimensions',()=>{
 const route=read('src/app/api/residential/account/route.ts');
 assert.match(route,/session\.auth\.getUser\(\)/);
 assert.match(route,/user\.email_confirmed_at/);
 assert.match(route,/\.eq\('site_id',siteId\)\.eq\('email',user.email.toLowerCase\(\)\)/);
 assert.match(route,/\.eq\('company_id',siteRow.company_id\)\.eq\('site_id',siteId\)/);
 assert.match(route,/\.eq\('customer_id',customer.id\)/);
 assert.doesNotMatch(route,/request\.nextUrl\.searchParams\.get\('customerId'\)/);
 assert.match(route,/downloadBytes:null,uploadBytes:null,rateDownBps:null/);
});

test('customer workspace has real subscriptions, paid orders and no fabricated metrics',()=>{
 const component=read('src/components/residential-account-portal.tsx');
 const page=read('src/app/mon-internet/[siteId]/page.tsx');
 const css=read('src/components/residential-account-portal.css');
 assert.match(component,/verifyOtp\(\{email:email.trim\(\).toLowerCase\(\),token:code.trim\(\),type:'email'\}\)/);
 assert.match(component,/account\?\.subscriptions\[0\]/);
 assert.match(component,/account\.orders\.map/);
 assert.match(component,/Indisponible/);
 assert.match(component,/className="rp-root resident-portal"/);
 assert.doesNotMatch(component,/>ZARAY</);
 assert.match(page,/applicationName:name/);
 assert.match(page,/residential-app-icon/);
 assert.match(page,/manifest:'\/mon-internet\/'\+encodeURIComponent\(siteId\)/);
 assert.match(css,/--rp-primary/);
 assert.match(css,/@media\(max-width:540px\)/);
});
