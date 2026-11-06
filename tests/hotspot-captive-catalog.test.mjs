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
 assert.match(portal,/link\.href=PUBLIC_API_BASE\+'\/wifi\/'/);
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

// Each site reuses its own public, administrator-configured ticket identity.
// The snapshot keeps the same brand on a captive network without API access.
test('native captive portal opens only the login with one discreet offers control',()=>{
 assert.match(portal,/id="catalog"[^>]*hidden/);
 assert.match(portal,/id="credentials" aria-labelledby="formTitle">/);
 assert.match(portal,/id="back" aria-controls="catalog" aria-expanded="false">Découvrir les offres/);
 const login=portal.slice(portal.indexOf('id="credentials"'),portal.indexOf('</section>',portal.indexOf('id="credentials"')));
 assert.doesNotMatch(login,/id="subscribeLink"/);
 assert.match(portal,/id="subscribeLink"/);
 assert.match(portal,/id="already"/);
});
test('public brand lookup is scoped by active site and default site template, not offer overrides',()=>{
 assert.match(api,/\.eq\('id',siteId\)\.eq\('status','active'\)/);
 assert.match(api,/\.eq\('site_id',siteId\)\.eq\('company_id',site.company_id\)\.is\('offer_id',null\)/);
 assert.match(api,/\.select\('brand_name,logo_data_uri,primary_color,accent_color,welcome_message'\)/);
 assert.match(api,/branding,/);
 assert.doesNotMatch(api,/service[_-]?role[_-]?key|credential_hash|ticket_password/);
});
test('download embeds escaped site-level branding and preserves native RouterOS authentication',()=>{
 assert.match(editor,/const qs=new URLSearchParams\(\{companyId,siteId\}\)/);
 assert.match(editor,/encodeURIComponent\(JSON.stringify\(snapshot\)\)\.replace\(\/\'\/g,'%27'\)/);
 assert.match(editor,/replaceAll\('__ZARAY_BRANDING_JSON__',safeBranding\)/);
 assert.match(portal,/var EMBEDDED_BRANDING='__ZARAY_BRANDING_JSON__'/);
 assert.match(portal,/JSON\.parse\(decodeURIComponent\(EMBEDDED_BRANDING\)\)/);
 assert.match(portal,/applyBranding\(readEmbeddedBranding\(\)\)/);
 assert.match(portal,/applyBranding\(data.branding\)/);
 assert.match(portal,/window.loginWithTicket=function/);
 assert.match(portal,/action="\$\(link-login-only\)"/);
});
test('site colors, logo and welcome text are applied as safe values, not HTML injection',()=>{
 assert.match(portal,/^.*validHex\(value\)/m);
 assert.match(portal,/document\.documentElement\.style\.setProperty\('--site-primary'/);
 assert.match(portal,/document\.documentElement\.style\.setProperty\('--site-accent'/);
 assert.match(portal,/document\.getElementById\('welcomeText'\)\.textContent/);
 assert.match(portal,/document\.getElementById\('companyHeading'\)\.textContent/);
 assert.match(portal,/^.*logo\.src=image/m);
 assert.match(portal,/image.length<=180000/);
 assert.match(portal,/png\|jpeg\|webp/);
 assert.doesNotMatch(portal,/innerHTML\s*=/);
});

test('MikroTik HTML exposes only the current site subscriber account when backend is available',()=>{
 assert.match(portal,/id="accountLink" class="account-link" href="#" hidden/);
 assert.match(portal,/SITE_HOSTED/);
 assert.match(portal,/PUBLIC_API_BASE\+'\/mycompte\/me'/);
 assert.match(portal,/PUBLIC_API_BASE\+'\/mon-internet\/'\+encodeURIComponent\(SITE_ID\)/);
 assert.match(portal,/if\(!LOCAL_ONLY&&PUBLIC_API_BASE&&/);
 assert.match(portal,/\?siteId='\+encodeURIComponent\(SITE_ID\)\+'&inscription=1'/);
 assert.doesNotMatch(portal,/href="https:\/\/zaray\.vercel\.app\/mon-internet\//);
});
