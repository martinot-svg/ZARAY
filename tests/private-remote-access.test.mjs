import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('private account subdomain resolves only by a site-owned alias',()=>{
 const proxy=read('proxy.ts');
 assert.match(proxy,/hostname\.startsWith\('compte\.'\)\?hostname\.slice\('compte\.'\.length\)/);
 assert.match(proxy,/activeSiteForPublicHostname\(accountAlias\|\|hostname,'alias'\)/);
 assert.match(proxy,/site\.status!=='active'/);
 assert.match(proxy,/\['active','trial'\]/);
 assert.match(proxy,/\.eq\(field,hostname\)/);
 assert.match(proxy,/target\.pathname='\/mon-internet\/'\+site\.siteId/);
 assert.match(proxy,/return denied\(\)/);
});

test('private site hostname does not allow cross-company subscriptions',()=>{
 const api=read('src/app/api/portal/[slug]/route.ts');
 assert.match(api,/hostname\.startsWith\('compte\.'\)\?hostname\.slice\(7\):hostname/);
 assert.match(api,/site\.status!=='active'/);
 assert.match(api,/\['active','trial'\]/);
 assert.match(api,/domainSite\.companySlug!==slug/);
 assert.match(api,/siteId!==domainSite\.siteId/);
});

test('authenticated residential account remains site-scoped with no mock usage',()=>{
 const account=read('src/app/api/residential/account/route.ts');
 assert.match(account,/session\.auth\.getUser\(\)/);
 assert.match(account,/user\.email_confirmed_at/);
 assert.match(account,/\.eq\('site_id',siteId\)\.eq\('email',user\.email\.toLowerCase\(\)\)/);
 assert.match(account,/usage:\{available:false/);
 const client=read('src/components/residential-account-portal.tsx');
 assert.match(client,/auth\.auth\.verifyOtp/);
 assert.doesNotMatch(client,/>ZARAY</);
});

test('site dashboard does not suggest remote access is already active',()=>{
 const settings=read('src/app/sites/[siteId]/domaine/page.tsx');
 assert.match(settings,/compte\.'\+link\.alias/);
 assert.match(settings,/Adresse privée préparée, non activée/);
 assert.match(settings,/VPN, DNS privé, serveur et certificat : mise en service non confirmée/);
});
