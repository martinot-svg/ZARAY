import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(p)=>readFileSync(p,'utf8');
const agent=read('network-connector/agent.mjs');
const cloud=read('src/app/api/network/agent/route.ts');
const migration=read('supabase/migrations/20261029110000_wifi_voucher_cumulative_hotspot_uptime.sql');
const cashier=read('src/components/wifi-voucher-sales.tsx');

test('MikroTik Hotspot enforces cumulative uptime instead of a session timer',()=>{
 assert.match(agent,/['"]limit-uptime['"]/);
 assert.match(agent,/routerUptimeSeconds/);
 assert.match(agent,/voucherUptimeReadings/);
 assert.doesNotMatch(agent,/session-timeout':/);
});
test('cloud sync persists only validated router uptime readings',()=>{
 assert.match(cloud,/record_wifi_voucher_usage/);
 assert.match(cloud,/Number\.isSafeInteger\(uptimeSeconds\)/);
 assert.match(cloud,/expires_at:null/);
});
test('database caps usage monotonically and stops wall-clock cutoff after first use',()=>{
 assert.match(migration,/greatest\(x\.used_seconds,v_sec\)/);
 assert.match(migration,/new_used>=x\.duration_minutes\*60/);
 assert.match(migration,/v\.status='active' and exists/);
 assert.doesNotMatch(migration,/v\.status='active' and expires_at is not null and expires_at<=now\(\)/);
});
test('cashier displays consumed and remaining cumulative seconds',()=>{
 assert.match(cashier,/used_seconds/);
 assert.match(cashier,/duration_minutes\*60-t\.network\.used_seconds/);
});
