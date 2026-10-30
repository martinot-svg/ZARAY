import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const sql=read('supabase/migrations/20261030194500_residential_portal_site_binding.sql');
const api=read('src/app/api/portal/[slug]/route.ts');
const wifi=read('src/components/public-wifi-portal.tsx');
const legacy=read('src/app/portail/[slug]/page.tsx');
const native=read('public/hotspot/zaray-login.html');
const subApi=read('src/app/api/residential-subscriptions/route.ts');
const subPage=read('src/app/abonnements/page.tsx');

test('public enrollment binds a site within the company before customer/order triggers',()=>{
 assert.match(sql,/create_public_subscription_order_at_site/);
 assert.match(sql,/s\.id=p_site_id and s\.company_id=v_company_id/);
 assert.match(sql,/s\.status in \('active','planned'\)/);
 assert.match(sql,/if coalesce\(pg_catalog\.array_length/);
 assert.match(sql,/site_id,offer_id,customer_name/);
 assert.match(sql,/site_required/);
 assert.match(sql,/customer_already_assigned_to_site/);
 assert.match(sql,/if v_recent_count>=3/);
});
test('site list is public only for active or trial enterprises',()=>{
 assert.match(sql,/get_public_residential_sites/);
 assert.match(sql,/c\.status in \('trial','active'\)/);
 assert.match(sql,/s\.status in \('active','planned'\)/);
});
test('both hosted portals select or carry a site to the same verified RPC',()=>{
 assert.match(api,/get_public_residential_sites/);
 assert.match(api,/create_public_subscription_order_at_site/);
 assert.match(api,/p_site_id: siteId/);
 assert.match(wifi,/siteId:selectedSiteId\|\|null/);
 assert.match(wifi,/linkedSite/);
 assert.match(wifi,/Site de raccordement/);
 assert.match(legacy,/siteId:siteId\|\|null/);
 assert.match(legacy,/Choisir un site/);
 assert.match(native,/\?siteId=/);
});
test('owner-only assignment is explicitly controlled and cannot move provisioned accounts',()=>{
 assert.match(sql,/assign_residential_subscription_site/);
 assert.match(sql,/v_role not in \('owner','admin'\)/);
 assert.match(sql,/site_already_assigned/);
 assert.match(sql,/network_account_already_bound/);
 assert.match(subApi,/export async function PATCH/);
 assert.match(subApi,/p_subscription_id:subscriptionId,p_site_id:siteId/);
 assert.match(subPage,/Site de raccordement non attribué/);
 assert.match(subPage,/Attribuer ce site/);
});
