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
test('RouterOS portal opens on the voucher login and allows offer selection',()=>{
 assert.match(portal,/id="catalog"/);
 assert.match(portal,/id="credentials" aria-labelledby="formTitle">/);
 assert.match(portal,/id="catalog"[^>]*hidden/);
 assert.match(portal,/Bienvenue chez/);
 assert.match(portal,/Devenir un abonné/);
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

test('one native MikroTik page serves both ticket and residential subscription journeys',()=>{
 assert.match(portal,/id="catalog"/);
 assert.match(portal,/id="credentials"/);
 assert.match(portal,/id="subscribeLink"/);
 assert.match(portal,/Accès Wi-Fi occasionnel/);
 assert.match(portal,/Devenir un abonné/);
 assert.match(portal,/https:\/\/zaray\.vercel\.app\/portail\//);
 assert.match(portal,/COMPANY_SLUG='__ZARAY_COMPANY_SLUG__'/);
});
test('subscription destination and display name are server-derived from the site company',()=>{
 assert.match(api,/\.select\('id,name,status,company_id'\)/);
 assert.match(api,/\.eq\('id',site\.company_id\)/);
 assert.match(api,/companyName:company\.legal_name/);
 assert.match(api,/companySlug:company\.slug/);
 assert.doesNotMatch(api,/service[_-]?role[_-]?key|voucher[_-]?password|credential_hash/);
});
test('downloaded MikroTik login page contains a safe public company slug fallback',()=>{
 assert.match(editor,/replaceAll\('__ZARAY_COMPANY_SLUG__',companySlug\)/);
 assert.match(editor,/\^\[a-z0-9-\]\{2,80\}\$/i);
 assert.match(portal,/showSubscription\('',COMPANY_SLUG\)/);
 assert.match(portal,/showSubscription\(data\.companyName,data\.companySlug\)/);
});
test('subscriber sign-up does not authenticate or activate a Hotspot voucher',()=>{
 assert.match(portal,/registrationRequiresPaymentConfirmation|paiement doit être confirmé/);
 assert.match(portal,/showSubscription/);
 assert.match(portal,/window\.loginWithTicket/);
 assert.match(portal,/action="\$\(link-login-only\)"/);
});
