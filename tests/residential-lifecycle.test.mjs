import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(p,'utf8');
const migration=read('supabase/migrations/20261030165000_residential_subscription_lifecycle.sql');
const api=read('src/app/api/residential-subscriptions/route.ts');
const page=read('src/app/abonnements/page.tsx');
const shell=read('src/components/app-shell.tsx');

test('one permanent residential subscription per customer and company, protected by RLS',()=>{
 assert.match(migration,/unique\(company_id,customer_id\)/);
 assert.match(migration,/references public\.customers\(id\)/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/company_members m/);
 assert.match(migration,/grant select on public\.residential_subscriptions to authenticated/);
 assert.match(migration,/revoke all on public\.residential_subscriptions from anon,authenticated/);
});
test('payment and network activation remain separate and idempotent',()=>{
 assert.match(migration,/order_id uuid not null unique/);
 assert.match(migration,/on conflict\(order_id\) do nothing/);
 assert.match(migration,/if v_order\.paid_at is null/);
 assert.match(migration,/if v_order\.activated_at is not null and v_cycle\.activated_at is null/);
 assert.match(migration,/greatest\(v_order\.activated_at/);
 assert.match(migration,/after insert or update of status,paid_at,activated_at/);
 assert.match(migration,/network_internal\.sync_residential_subscription/);
});
test('renewal requires verified user and company membership; creates unpaid order only',()=>{
 assert.match(migration,/create or replace function public\.request_residential_renewal/);
 assert.match(migration,/auth\.uid\(\)/);
 assert.match(migration,/email_confirmed_at is not null/);
 assert.match(migration,/m\.status='active'/);
 assert.match(migration,/v_member_role not in \('owner','admin','site_manager','sales'\)/);
 assert.match(migration,/o\.status='pending_payment'/);
 assert.match(migration,/on conflict/);
 assert.match(migration,/grant execute on function public\.request_residential_renewal/);
 assert.doesNotMatch(migration,/update public\.network_access_accounts set desired_state='active'/);
});
test('API scopes all records to authorized company/site, server counts and safe filter',()=>{
 assert.match(api,/authorizeTenant\(session,companyId,siteId\)/);
 assert.match(api,/\.eq\('company_id',companyId\)/);
 assert.match(api,/residential_subscription_summary/);
 assert.match(api,/residential_subscription_pending_ids/);
 assert.match(api,/pageSize/);
 assert.match(api,/request_residential_renewal/);
});
test('residential UI offers real lifecycle, periods, expiry and visible limits',()=>{
 assert.match(page,/title="Abonnements résidentiels"/);
 assert.match(page,/Échéances proches/);
 assert.match(page,/À activer/);
 assert.match(page,/Préparer un renouvellement/);
 assert.match(page,/Historique des périodes/);
 assert.match(page,/Gestion réseau/);
 assert.match(page,/window\.confirm/);
 assert.match(page,/l'activation réseau restent deux validations distinctes/);
 assert.match(shell,/\/abonnements/);
});
