import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const route=readFileSync('src/app/api/network/inventory/coverage/route.ts','utf8');
test('inventory coverage is tenant scoped and never mutates RouterOS',()=>{
 assert.ok(route.includes('authorizeTenant(client,companyId)'));
 assert.ok(route.includes(".eq('id',routerId).eq('company_id',companyId)"));
 assert.ok(route.includes(".eq('company_id',companyId).eq('router_id',routerId)"));
 assert.ok(!route.includes('export async function POST'));
 assert.ok(!route.includes('service_role'));
 assert.ok(!route.includes('password'));
});
test('coverage is explicit for incomplete, stale and unsupported inventory',()=>{
 for(const state of ['migration_required','requires_local_connector','not_collected','stale','complete','partial'])
  assert.ok(route.includes(state),state);
 assert.ok(route.includes('inventorySourceIsCurrent(kind,source.observed_at,now)'));
 assert.ok(route.includes(".limit(100)"));
});
