import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('site actions are restricted to the right company and owner/admin roles',()=>{
 const route=read('src/app/api/sites/lifecycle/route.ts');
 assert.match(route,/authorizeTenant\(client,companyId,siteId\)/);
 assert.match(route,/\['owner','admin'\]/);
 assert.match(route,/\.eq\('id',siteId!\)\.eq\('company_id',companyId!\)/);
 assert.match(route,/action==='deactivate'\?'suspended':'active'/);
 assert.match(route,/body\?\.acknowledge!==true/);
 assert.match(route,/p_company_id:companyId!/);
 assert.match(route,/p_site_id:siteId!/);
});

test('database deletion checks caller, tenant, name and business dependencies',()=>{
 const sql=read('supabase/migrations/20261106101200_safe_site_lifecycle_deletion.sql');
 assert.match(sql,/security definer/i);
 assert.match(sql,/set search_path = ''/);
 assert.match(sql,/v_user uuid := auth\.uid\(\)/);
 assert.match(sql,/m\.company_id=p_company_id/);
 assert.match(sql,/m\.role in \('owner','admin'\)/);
 assert.match(sql,/s\.id=p_site_id and s\.company_id=p_company_id/);
 assert.match(sql,/for update;/);
 assert.match(sql,/p_confirmation is distinct from v_site\.name/);
 assert.match(sql,/site_must_be_inactive/);
 for(const table of ['customers','residential_subscriptions','subscription_orders',
    'wifi_vouchers','wifi_voucher_sales','wifi_voucher_network','wifi_voucher_activations',
    'walkin_sales','network_routers','site_notifications','residential_notification_email_jobs']){
  assert.ok(sql.includes('public.'+table),table+' must block unsafe deletion');
 }
 assert.match(sql,/site_has_business_records/);
 assert.match(sql,/insert into public\.audit_logs/);
 assert.match(sql,/delete from public\.sites where id=p_site_id and company_id=p_company_id/);
 assert.match(sql,/grant execute on function public\.delete_company_site\(uuid,uuid,text\) to authenticated/);
 assert.match(sql,/revoke all on function .* from public, anon, authenticated/);
});

test('enterprise site management requires explicit named confirmation for deletion',()=>{
 const ui=read('src/components/site-lifecycle-panel.tsx');
 const list=read('src/app/sites/page.tsx');
 const company=read('src/app/entreprises/page.tsx');
 assert.match(ui,/Désactiver le site/);
 assert.match(ui,/Réactiver le site/);
 assert.match(ui,/Confirmer la suppression définitive/);
 assert.match(ui,/typedName!==site\.name/);
 assert.match(ui,/acknowledged/);
 assert.match(ui,/Cette action ne coupe pas automatiquement/);
 assert.match(list,/SiteLifecyclePanel/);
 assert.match(list,/\['owner','admin'\]/);
 assert.match(company,/Gérer les sites/);
});
