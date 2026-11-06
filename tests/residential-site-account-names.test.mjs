import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('account title is derived from the verified site identity and never the global SaaS name',()=>{
 const labels=read('src/lib/residential-site-labels.ts');
 const page=read('src/app/mon-internet/[siteId]/page.tsx');
 const component=read('src/components/residential-account-portal.tsx');
 assert.match(labels,/subscriberAccountName/);
 assert.match(labels,/site\.brandName/);
 assert.match(labels,/site\.siteName/);
 assert.match(labels,/toLocaleLowerCase\('fr'\)/);
 assert.match(page,/publicResidentialSite\(siteId\)/);
 assert.match(page,/title:name/);
 assert.match(page,/applicationName:name/);
 assert.match(page,/subscriberAccountName\(identity\)/);
 assert.match(component,/subscriberAccountName\(site\)/);
 assert.match(component,/<h1>\{accountLabel\}<\/h1>/);
 assert.doesNotMatch(component,/>ZARAY</);
});

test('each site has a distinct installable home-screen identity with its own public icon',()=>{
 const manifest=read('src/app/mon-internet/[siteId]/manifest.webmanifest/route.ts');
 const page=read('src/app/mon-internet/[siteId]/page.tsx');
 const icon=read('src/app/api/public/residential-app-icon/route.ts');
 assert.match(manifest,/publicResidentialSite\(siteId\)/);
 assert.match(manifest,/id:entry/);
 assert.match(manifest,/start_url:entry,scope:entry/);
 assert.match(manifest,/subscriberAccountName\(identity\)/);
 assert.match(manifest,/size=192/);
 assert.match(manifest,/size=512/);
 assert.match(manifest,/display:'standalone'/);
 assert.doesNotMatch(manifest,/name:\s*'ZARAY'/);
 assert.match(page,/appleWebApp:\{capable:true,title:name/);
 assert.match(page,/manifest:'\/mon-internet\/'\+encodeURIComponent\(siteId\)/);
 assert.match(icon,/publicResidentialSite\(siteId\)/);
 assert.match(icon,/sharp\(source/);
 assert.match(icon,/image\/png/);
});

test('account link remains tied to the site selected on the wifi and hotspot portals',()=>{
 const web=read('src/components/public-wifi-portal.tsx');
 const hotspot=read('public/hotspot/zaray-login.html');
 const proxy=read('proxy.ts');
 const account=read('src/app/api/residential/account/route.ts');
 assert.match(web,/subscriberAccountName\(\{brandName:siteIdentity\?\.brandName/);
 assert.match(web,/\/mon-internet\/'\+encodeURIComponent\(selectedSiteId\)/);
 assert.match(hotspot,/SITE_HOSTED/);
 assert.match(hotspot,/PUBLIC_API_BASE\+'\/mycompte\/me'/);
 assert.match(hotspot,/PUBLIC_API_BASE\+'\/mon-internet\/'\+encodeURIComponent\(SITE_ID\)/);
 assert.match(proxy,/path==='\/mon-internet\/'\+site.siteId\+'\/manifest.webmanifest'/);
 assert.match(proxy,/\/api\/public\/residential-app-icon/);
 assert.match(account,/\.eq\('company_id',siteRow.company_id\)\.eq\('site_id',siteId\)/);
});
