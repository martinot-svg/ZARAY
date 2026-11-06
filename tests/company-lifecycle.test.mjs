import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('company lifecycle is role-gated and cannot bypass billing suspension',()=>{
 const sql=read('supabase/migrations/20261106130000_company_lifecycle.sql');
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/m\.role/);
 assert.match(sql,/\('owner','admin'\)/);
 assert.match(sql,/lifecycle_previous_status/);
 assert.match(sql,/company_not_reactivatable/);
 assert.match(sql,/v_company\.trial_ends_at<=now\(\)/);
 assert.match(sql,/company\.deactivated/);
 assert.match(sql,/company\.reactivated/);
 assert.match(sql,/company\.deleted/);
 assert.match(sql,/v_role<>'owner'/);
 assert.match(sql,/v_company\.owner_user_id is distinct from v_actor/);
 assert.match(sql,/p_confirmation is distinct from v_company\.legal_name/);
 assert.match(sql,/company_has_business_records/);
 assert.match(sql,/pg_catalog\.pg_constraint/);
 assert.match(sql,/delete from public\.company_members/);
 assert.match(sql,/update public\.audit_logs set company_id=null/);
 assert.match(sql,/delete from public\.companies/);
 assert.match(sql,/grant execute on function public\.manage_company_lifecycle.*to authenticated/);
});

test('company mutations route through authenticated tenant membership',()=>{
 const route=read('src/app/api/companies/lifecycle/route.ts');
 assert.match(route,/authorizeTenant\(client,companyId\)/);
 assert.match(route,/\['owner','admin'\]/);
 assert.match(route,/auth\.member\.role!=='owner'/);
 assert.match(route,/body\?\.acknowledge!==true/);
 assert.match(route,/p_company_id:companyId/);
 assert.match(route,/p_action:action/);
});

test('enterprise settings require deliberate confirmation',()=>{
 const personal=read('src/lib/personal-context.ts');
 const list=read('src/app/entreprises/page.tsx');
 const ui=read('src/components/company-lifecycle-panel.tsx');
 assert.match(personal,/lifecycle_previous_status/);
 assert.match(list,/CompanyLifecyclePanel/);
 assert.match(ui,/Désactiver l’entreprise/);
 assert.match(ui,/Réactiver l’entreprise/);
 assert.match(ui,/Supprimer définitivement/);
 assert.match(ui,/confirmation!==company\.legal_name/);
 assert.match(ui,/const owner=company\.role==='owner'/);
 assert.match(ui,/const voluntarySuspension/);
 assert.match(ui,/router\.refresh\(\)/);
});

test('company suspension prevents new orders tickets and MikroTik activation commands',()=>{
 const sql=read('supabase/migrations/20261106134000_company_operational_freeze.sql');
 assert.match(sql,/guard_order_site_is_active/);
 assert.match(sql,/c\.status in \('trial','active'\)/);
 assert.match(sql,/company_freeze_new_vouchers/);
 assert.match(sql,/company_freeze_network_accounts/);
 assert.match(sql,/company_freeze_network_commands/);
 assert.match(sql,/not in \('resume_account','provision_voucher','unblock_hotspot_mac'\)/);
 const agent=read('src/app/api/network/agent/route.ts');
 assert.match(agent,/companyState\.status/);
 assert.match(agent,/siteState\.status==='active'/);
 const vouchers=read('src/app/api/wifi-vouchers/route.ts');
 assert.match(vouchers,/entreprise est suspendue/);
});
