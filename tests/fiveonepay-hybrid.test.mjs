import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('FiveOne merchant secrets are encrypted on server and never exposed to Data API',()=>{
 const sql=read('supabase/migrations/20261107144500_fiveonepay_hybrid_foundation.sql');
 const crypto=read('src/lib/fiveonepay-server.ts');
 const config=read('src/app/api/fiveonepay/settings/route.ts');
 assert.match(sql,/fiveonepay_merchants enable row level security/);
 assert.match(sql,/fiveonepay_attempts enable row level security/);
 assert.match(sql,/from public,anon,authenticated/);
 assert.match(sql,/grant select,insert,update,delete/);
 assert.match(crypto,/createCipheriv\('aes-256-gcm'/);
 assert.match(crypto,/createDecipheriv\('aes-256-gcm'/);
 assert.match(crypto,/ZARAY_FIVEONEPAY_ENCRYPTION_KEY/);
 assert.doesNotMatch(crypto,/NEXT_PUBLIC_FIVEONE/);
 assert.match(config,/authorizeTenant\(session,companyId,siteId\|\|null\)/);
 assert.match(config,/api_key_ciphertext/);
 assert.match(config,/webhook_secret_ciphertext/);
 assert.match(config,/select\('id,label,site_id,environment,enabled,updated_at'\)/);
});

test('hybrid routing and ABWIFI references are bound to verified site and merchant',()=>{
 const sql=read('supabase/migrations/20261107144500_fiveonepay_hybrid_foundation.sql');
 const service=read('src/lib/fiveonepay-server.ts');
 assert.match(sql,/mode in \('shared','dedicated'\)/);
 assert.match(sql,/reserve_fiveonepay_attempt/);
 assert.match(sql,/for update/);
 assert.match(sql,/ABWIFI-/);
 assert.match(sql,/lpad\(v_code.next_number::text,6,'0'\)/);
 assert.match(sql,/v_merchant\.site_id is distinct from v_site\.id/);
 assert.match(sql,/v_order\.status<>'pending_payment'/);
 assert.match(service,/routing\?\.mode==='dedicated'/);
 assert.match(service,/\.is\('site_id',scope\)/);
 assert.match(service,/api\.fiveonepay\.com\/v1/);
 assert.match(service,/pay\.fiveonepay\.com/);
 assert.match(service,/Idempotency-Key/);
 assert.doesNotMatch(service,/reason\s*:\s*'ABWIFI'/);
});

test('signed, tenant-bound FiveOne success reuses production ledger; sandbox never activates real access',()=>{
 const hook=read('src/app/api/fiveonepay/webhook/[merchantId]/route.ts');
 assert.match(hook,/x-fiveone-signature/);
 assert.match(hook,/createHmac\('sha256'/);
 assert.match(hook,/timingSafeEqual/);
 assert.match(hook,/\.eq\('merchant_id',merchantId\)/);
 assert.match(hook,/attempt\.environment!==merchant\.environment/);
 assert.match(hook,/if\(verified\.environment==='sandbox'\)/);
 assert.match(hook,/p_provider:'fiveonepay'/);
 assert.match(hook,/process_payment_webhook/);
 assert.match(hook,/p_order_reference:order\.public_reference/);
 assert.match(hook,/payment\.expired/);
});

test('new client checkout and existing /kaotiko/me account reuses site-specific order',()=>{
 const portal=read('src/components/public-wifi-portal.tsx');
 const account=read('src/components/residential-account-portal.tsx');
 const api=read('src/app/api/residential/account/route.ts');
 const checkout=read('src/app/api/fiveonepay/checkout/route.ts');
 const proxy=read('proxy.ts');
 assert.match(portal,/FiveOneCheckoutButton siteId=\{selectedSiteId\}/);
 assert.match(account,/FiveOneCheckoutButton siteId=\{siteId\}/);
 assert.match(api,/email:user\.email\.toLowerCase\(\)/);
 assert.match(checkout,/hostCanPay\(request,subscription\.site_id\)/);
 assert.match(checkout,/subscription\.customer_email\.toLowerCase\(\)!==email/);
 assert.match(checkout,/manual_payment_submissions/);
 assert.match(checkout,/reserve_fiveonepay_attempt/);
 assert.match(proxy,/\/api\/fiveonepay\/availability/);
 assert.match(proxy,/\/api\/fiveonepay\/checkout/);
 assert.match(proxy,/\/kaotiko\/me/);
});
