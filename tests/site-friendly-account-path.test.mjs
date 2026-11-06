import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('site-host root maps to site portal and /mycompte/me maps to a verified account',()=>{
 const proxy=read('proxy.ts');
 assert.match(proxy,/if\(path==='\/'\|\|path==='\/login'\)/);
 assert.match(proxy,/target\.pathname='\/wifi\/'\+encodeURIComponent\(site\.companySlug\)/);
 assert.match(proxy,/target\.search='\?siteId='\+encodeURIComponent\(site\.siteId\)/);
 assert.match(proxy,/path==='\/mycompte\/me'/);
 assert.match(proxy,/target\.pathname='\/mon-internet\/'\+site\.siteId/);
 assert.match(proxy,/\.eq\('hostname',hostname\)\.eq\('status','active'\)/);
 assert.match(proxy,/\.eq\(field,hostname\)/);
 assert.match(proxy,/return denied\(\)/);
 assert.doesNotMatch(proxy,/search\.get\('customerId'\)/);
});

test('local site dashboard shows the requested URL pair without implying that MikroTik hosts the account',()=>{
 const page=read('src/app/sites/[siteId]/domaine/page.tsx');
 assert.match(page,/const localAddress=link\?'http:\/\/'\+link\.alias/);
 assert.match(page,/const accountAddress=localAddress\?localAddress\+'\/mycompte\/me'/);
 assert.match(page,/Copier l’adresse du compte/);
 assert.match(page,/un serveur HTTPS privé/);
 assert.match(page,/routeur : non confirmée/);
});

test('MikroTik template never advertises an invented local account server',()=>{
 const portal=read('public/hotspot/zaray-login.html');
 const exporter=read('src/components/wifi-ticket-customization.tsx');
 assert.match(portal,/var LOCAL_ONLY='__ZARAY_LOCAL_ONLY__'/);
 assert.match(portal,/var SITE_HOSTED='__ZARAY_SITE_HOSTED__'/);
 assert.match(portal,/PORTAL\.showAccount!==false/);
 assert.match(portal,/!LOCAL_ONLY&&PUBLIC_API_BASE/);
 assert.match(portal,/SITE_HOSTED\s*\?PUBLIC_API_BASE\+'\/mycompte\/me'/);
 assert.match(exporter,/const localOnly=Boolean\(linkData\.link\)&&!siteWebHost/);
 assert.match(exporter,/\.replaceAll\('__ZARAY_SITE_HOSTED__',siteWebHost\?'true':'false'\)/);
 assert.match(exporter,/\.replaceAll\('__ZARAY_PUBLIC_API_BASE__',publicBase\)/);
});

test('home screen account shortcut uses /mycompte/me only for site-hosted web app',()=>{
 const manifest=read('src/app/mon-internet/[siteId]/manifest.webmanifest/route.ts');
 const portal=read('src/components/public-wifi-portal.tsx');
 const account=read('src/app/api/residential/account/route.ts');
 assert.match(manifest,/const entry=branded\?'\/mycompte\/me':'\/mon-internet\/'\+identity\.siteId/);
 assert.match(portal,/siteBrandedHost\?'\/mycompte\/me':'\/mon-internet\/'/);
 assert.match(account,/\.eq\('site_id',siteId\)\.eq\('email',user\.email\.toLowerCase\(\)\)/);
 assert.match(account,/\.eq\('customer_id',customer\.id\)/);
});
