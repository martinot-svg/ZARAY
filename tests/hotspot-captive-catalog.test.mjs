import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(path,'utf8');
const sql=read('supabase/migrations/20261029163000_hotspot_public_offer_catalog.sql');
const api=read('src/app/api/public/wifi-offers/route.ts');
const portal=read('public/hotspot/zaray-login.html');
const editor=read('src/components/wifi-ticket-customization.tsx');

test('catalog is site-scoped and returns only active offers with prepaid prepared unused stock',()=>{
 assert.match(sql,/s\.id=p_site_id/);
 assert.match(sql,/s\.status='active'/);
 assert.match(sql,/o\.status='active'/);
 assert.match(sql,/v\.status='available'/);
 assert.match(sql,/n\.network_state='provisioned'/);
 assert.match(sql,/having count\(v\.id\)>0/);
});
test('public API limits fields to public offer metadata and never returns ticket credentials',()=>{
 assert.match(api,/get_hotspot_offer_catalog/);
 assert.match(api,/Access-Control-Allow-Origin/);
 assert.doesNotMatch(api,/credential_hash|secret_hash|password_length|voucher_id/);
});
test('RouterOS portal renders offers before showing voucher entry form',()=>{
 assert.match(portal,/id="catalog"/);
 assert.match(portal,/id="credentials"[^>]*hidden/);
 assert.match(portal,/b\.addEventListener\('click',function\(\)\{showLogin\(o\);\}\)/);
 assert.match(portal,/name="username"/);
 assert.match(portal,/name="password"/);
});
test('credentials are posted to native Hotspot with CHAP and HTTPS fallback',()=>{
 assert.match(portal,/action="\$\(link-login-only\)"/);
 assert.match(portal,/hexMD5\('\$\(chap-id\)'\+password\+'\$\(chap-challenge\)'\)/);
 assert.match(portal,/location\.protocol!=='https:'/);
 assert.doesNotMatch(portal,/fetch\([^)]*password/);
});
test('site-specific download never adds private credentials',()=>{
 assert.match(editor,/downloadPortal/);
 assert.match(editor,/replaceAll\('__ZARAY_SITE_ID__',siteId\)/);
 assert.match(portal,/__ZARAY_SITE_ID__/);
});
