import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const sql=read('supabase/migrations/20261030182000_residential_network_acknowledgement.sql');
const agent=read('src/app/api/network/agent/route.ts');
test('renewal links only one paid residential network account to the same customer and site',()=>{
 assert.match(sql,/previous_order\.customer_id=new\.customer_id/);
 assert.match(sql,/previous_order\.paid_at is not null/);
 assert.match(sql,/previous_order\.site_id is not distinct from new\.site_id/);
 assert.match(sql,/r\.site_id is not distinct from new\.site_id/);
 assert.match(sql,/array_length\(v_matching_accounts,1\),0\)=1/);
 assert.match(sql,/set order_id=new\.id/);
});
test('repaid active account requires a new acknowledged entitlement',()=>{
 assert.match(sql,/perform network_internal\.reconcile_one\(a\.id\)/);
 assert.match(sql,/and a\.applied_state='active'/);
 assert.match(sql,/cmd\.status in \('queued','dispatched'\)/);
 assert.match(sql,/Confirmer le renouvellement résidentiel sur MikroTik/);
});
test('access is activated only from trusted network applied state, not the payment alone',()=>{
 assert.match(sql,/after update of applied_state/);
 assert.match(sql,/new\.applied_state<>'active' or new\.desired_state<>'active'/);
 assert.match(sql,/v_order\.paid_at is null/);
 assert.match(sql,/activated_at=coalesce\(activated_at,now\(\)\)/);
 assert.match(sql,/status='active'/);
 assert.match(sql,/set expires_at=v_period_end/);
 assert.match(sql,/revoke all on function network_internal\.residential_network_ack/);
});
test('agent refuses missing or failed account sync after MikroTik acknowledgement',()=>{
 assert.match(agent,/accountSyncError\|\|!updatedAccount/);
 assert.match(agent,/\.eq\('router_id',routerId\)\.eq\('desired_state',applied\)\.select\('id'\)\.maybeSingle\(\)/);
 assert.match(agent,/Commande réseau confirmée, mais synchronisation des droits non enregistrée/);
});
