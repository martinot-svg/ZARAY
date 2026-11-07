import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261107132000_site_performance_overview.sql');
const api=read('src/app/api/site-performance/route.ts');
const ui=read('src/components/site-performance-overview.tsx');
const workspace=read('src/components/dashboard-workspace.tsx');
const stylesheet=read('src/app/site-performance.css');

test('all four calendar periods use site-local Madagascar time with exclusive end',()=>{
 for(const p of ["day","week","month","year"])
  assert.match(sql,new RegExp("WHEN '"+p+"' THEN"));
 assert.match(sql,/AT TIME ZONE 'Indian\/Antananarivo'/);
 assert.match(sql,/date_trunc\('week',local_now\)/);
 assert.match(sql,/p_period IN \('day','week','month','year'\)/);
 assert.match(ui,/aria-label="Période financière"/);
 for(const p of ["Jour","Semaine","Mois","Année"])assert.ok(ui.includes("'"+p+"'"));
});
test('money is confirmed receipts only, not ticket activation or unpaid order',()=>{
 assert.match(sql,/p\.status='succeeded'/);
 assert.match(sql,/p\.confirmed_at>=b\.begins_at AND p\.confirmed_at<b\.ends_at/);
 assert.match(sql,/FROM public\.walkin_sales s/);
 assert.match(sql,/FROM public\.wifi_voucher_sales s/);
 assert.match(sql,/public\.wifi_voucher_activations a/);
 const receipts=sql.slice(sql.indexOf('receipts AS ('),sql.indexOf('currency_summary AS ('));
 assert.doesNotMatch(receipts,/wifi_voucher_activations/);
 assert.doesNotMatch(receipts,/p\.status='pending'/);
 assert.match(ui,/première connexion/i);
});
test('stock distinguishes not sold vouchers, network readiness and first connection',()=>{
 assert.match(sql,/v\.status='available'/);
 assert.match(sql,/n\.network_state='provisioned'/);
 assert.match(sql,/n\.network_state IS DISTINCT FROM 'provisioned'/);
 assert.match(sql,/stock st/);
 assert.match(ui,/Premières connexions/);
 assert.match(ui,/Prêts à vendre/);
});
test('subscription statuses separate cash received from expiry, failure and inactivity',()=>{
 assert.match(sql,/count\(DISTINCT order_id\)/);
 assert.match(sql,/s\.paid_cycles>0 AND s\.expires_at<=b\.observed_at/);
 assert.match(sql,/s\.activated_cycles=0 OR s\.expires_at<=b\.observed_at/);
 assert.match(sql,/o\.status='failed'/);
 assert.match(sql,/p\.status='failed'/);
 assert.match(ui,/Encaissements/);
 assert.match(ui,/En retard/);
 assert.match(ui,/Inactifs/);
 assert.match(ui,/Échecs/);
});
test('read-only API checks current company and site authorization and server-only SQL RPC',()=>{
 assert.match(api,/authorizeTenant\(client,companyId,siteId\)/);
 assert.match(api,/reportingRoles\.has\(access\.member\.role\)/);
 assert.match(api,/service\.rpc\('site_performance_overview'/);
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.site_performance_overview/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.site_performance_overview[\s\S]*TO service_role/);
 assert.match(api,/private, no-store/);
 assert.doesNotMatch(api,/\.insert\(|\.update\(|\.delete\(/);
});
test('site overview is embedded in existing site dashboard, not a duplicate module',()=>{
 assert.match(workspace,/\{site&&<SitePerformanceOverview companyId=\{company\.id\} siteId=\{site\.id\}\/>\}/);
 assert.match(ui,/\/api\/site-performance\?/);
 assert.match(ui,/\{companyId,siteId,period\}/);
 assert.match(ui,/\/abonnements\?/);
 assert.match(ui,/\/tickets\?/);
 assert.match(stylesheet,/prefers-reduced-motion:reduce/);
});
