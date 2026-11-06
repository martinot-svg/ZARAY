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

test('status is no longer editable through legacy site PATCH or the old dropdown',()=>{
 const legacy=read('src/app/api/sites/route.ts');
 const ui=read('src/app/sites/page.tsx');
 assert.match(legacy,/input\.status !== undefined/);
 assert.match(legacy,/\.update\(\{ name \}\)/);
 assert.doesNotMatch(ui,/onChange=\{e=>void save\(s,s\.name,e\.target\.value\)\}/);
 assert.match(ui,/SiteLifecyclePanel/);
});

test('database enforces owner/admin status changes and active-site enrolment',()=>{
 const sql=read('supabase/migrations/20261106110000_site_lifecycle_status_enforcement.sql');
 const serialized=read('supabase/migrations/20261106112500_serialize_site_orders_with_status.sql');
 assert.match(sql,/m\.role in \('owner','admin'\)/);
 assert.match(sql,/before update of status on public\.sites/);
 assert.match(sql,/s\.status='active'/);
 assert.match(sql,/before insert on public\.subscription_orders/);
 assert.match(serialized,/for share/);
 const portal=read('src/app/api/portal/[slug]/route.ts');
 assert.match(portal,/get_public_residential_sites/);
 assert.match(portal,/eligible\.some\(s=>s\.site_id===siteId\)/);
 assert.match(portal,/Aucun site actif disponible/);
 const siteIdentity=read('src/lib/residential-site-identity.ts');
 assert.match(siteIdentity,/site\.status!=='active'/);
});

test('suspension blocks new network accounts and MikroTik activation commands',()=>{
 const network=read('src/app/api/network/access/route.ts');
 const agent=read('src/app/api/network/agent/route.ts');
 assert.match(network,/site\.status!=='active'/);
 assert.match(agent,/siteState\.status==='active'/);
 assert.match(agent,/provision_voucher/);
 assert.match(agent,/resume_account/);
 assert.match(agent,/unblock_hotspot_mac/);
 assert.match(agent,/Site désactivé : activation réseau refusée/);
});

test('permanent deletion never orphans active external hostnames',()=>{
 const sql=read('supabase/migrations/20261106114000_block_deletion_with_external_hostname.sql');
 assert.match(sql,/public\.site_custom_domains/);
 assert.match(sql,/d\.status='active'/);
 assert.match(sql,/public\.site_public_links/);
 assert.match(sql,/l\.public_hostname is not null/);
 assert.match(sql,/p_confirmation is distinct from v_site\.name/);
});
