import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('a free vanity host has separate private mapping and never claims a .mg domain',()=>{
 const sql=read('supabase/migrations/20261105180000_public_site_vanity_hostname.sql');
 assert.match(sql,/add column if not exists public_hostname text/i);
 assert.match(sql,/site_public_links_hostname_unique/);
 assert.match(sql,/vercel\[\.\]app/);
 const proxy=read('proxy.ts');
 assert.match(proxy,/hostname==='mlayconnexion\.vercel\.app'/);
 assert.match(proxy,/\.from\('site_public_links'\)/);
 assert.match(proxy,/\.eq\('public_hostname',hostname\)/);
 assert.match(proxy,/customHostResponse\(request,site,true\)/);
 assert.match(proxy,/if\(vanity&&path==='\/'\)/);
 assert.match(proxy,/inscription=1/);
 assert.match(proxy,/return denied\(\)/);
});

test('a branded vanity site only accepts subscriptions for its own site',()=>{
 const route=read('src/app/api/portal/[slug]/route.ts');
 assert.match(route,/const brandedHost=hostname==='mlayconnexion\.vercel\.app'/);
 assert.match(route,/\.eq\('public_hostname',hostname\)/);
 assert.match(route,/domainSite\.siteId/);
 assert.match(route,/siteId!==domainSite.siteId/);
});

test('site administrators share the branded domain rather than a ZARAY URL',()=>{
 const ui=read('src/app/sites/[siteId]/domaine/page.tsx');
 const api=read('src/app/api/site-links/route.ts');
 assert.match(api,/public_hostname/);
 assert.match(api,/publicLink\(data\.alias,data\.public_hostname\)/);
 assert.match(ui,/link\.url\?\.startsWith\('https:\/\/'\)/);
 assert.match(ui,/navigator\.clipboard\.writeText\(publicUrl\)/);
 const portal=read('src/components/public-wifi-portal.tsx');
 assert.match(portal,/startInSubscription/);
 assert.match(portal,/linkedSiteId/);
});
