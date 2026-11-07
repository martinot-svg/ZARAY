import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const api=read('public/hotspot/zaray-api.json');
const helper=read('src/lib/mikrotik-captive-api-download.ts');
const studio=read('src/components/site-portal-studio.tsx');
const tickets=read('src/components/wifi-ticket-customization.tsx');
const network=read('src/app/gestion-reseau/page.tsx');
const html=read('public/hotspot/zaray-login.html');
const guide=read('docs/captive-portal-studio-v1.md');

test('RouterOS native CAPPORT API preserves unexpanded HotSpot macros and valid conditional fields',()=>{
 assert.match(api,/"captive": \$\(if logged-in == 'yes'\)false\$\(else\)true\$\(endif\)/);
 assert.match(api,/"user-portal-url": "\$\(link-login-only\)"/);
 assert.match(api,/\$\(if session-timeout-secs != 0\)/);
 assert.match(api,/\$\(if remain-bytes-total\)/);
 assert.match(api,/"can-extend-session": true/);
 assert.doesNotMatch(api,/zaray\.vercel\.app|token|service_role|password/i);
});

test('CAPPORT file is downloadable unprocessed as api.json from both captive-editor and ticket workflow',()=>{
 assert.match(helper,/fetch\('\/hotspot\/zaray-api\.json'/);
 assert.match(helper,/contents\.includes\('\$\(if logged-in'/);
 assert.match(helper,/contents\.includes\('\$\(link-login-only\)'\)/);
 assert.match(helper,/anchor\.download='api\.json'/);
 assert.match(studio,/downloadMikrotikCaptiveApi\(\)/);
 assert.match(tickets,/downloadMikrotikCaptiveApi\(\)/);
 assert.match(tickets,/Télécharger api\.json/);
 assert.match(html,/src="md5\.js"/);
 assert.match(html,/hexMD5/);
 assert.match(html,/\$\(link-login-only\)/);
});

test('site router display is company-bound and does not imply HTML installed or live Internet',()=>{
 assert.match(studio,/\/api\/network\?companyId=/);
 assert.match(studio,/routerSnapshot\?\.companyId===companyId/);
 assert.match(studio,/router\.site_id===siteId/);
 assert.match(studio,/Connecteur en ligne/);
 assert.match(studio,/Installation sur le MikroTik non vérifiée/);
 assert.match(studio,/Un connecteur en ligne ne confirme pas/);
 assert.match(studio,/\/gestion-reseau\?companyId=/);
 assert.match(network,/const requestedSite=query\.get\('siteId'\)/);
 assert.match(network,/list\.find\(\(s:Site\)=>s\.id===requestedSite\)/);
 assert.match(guide,/md5\.js/);
 assert.match(guide,/certificat HTTPS valide/);
});
