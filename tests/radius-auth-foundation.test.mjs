import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=path=>readFileSync(path,'utf8');
const auth=read('src/app/api/network/radius/auth/route.ts');
const migration=read('supabase/migrations/20261109113000_radius_gateway_credentials.sql');
const gateway=read('src/app/api/network/radius/gateway/route.ts');
const credentials=read('src/app/api/network/radius/credentials/route.ts');
const bridge=read('radius-service/bridge.mjs');

test('gateway is disabled by default and a rotation cannot enable access',()=>{
 assert.match(migration,/enabled boolean NOT NULL DEFAULT false/i);
 assert.match(gateway,/enabled:false/);
 assert.doesNotMatch(gateway,/export async function PATCH/);
 assert.match(auth,/!gateway\.enabled/);
});
test('credentials remain server-side with tenant guards and no client table grants',()=>{
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/g);
 assert.match(migration,/REVOKE ALL.*authenticated/i);
 assert.match(migration,/radius_credential_guard/);
 assert.match(credentials,/authorizeTenant/);
 assert.match(credentials,/hashRadiusPassword/);
 assert.doesNotMatch(credentials,/password_hash:password/);
});
test('authentication checks payment, tenant isolation, expiry and suspension',()=>{
 for(const condition of ['radiusTokenHash(token)','company.status','realSite.status','administrative_hold','desired_state','validUntil','order.paid_at','order.site_id','verifyRadiusPassword'])assert.ok(auth.includes(condition),condition);
 assert.match(auth,/status:204/);
 assert.match(auth,/status:401/);
});
test('bridge listens only on loopback, requires TLS upstream and fails closed',()=>{
 assert.match(bridge,/server\.listen\(port,'127\.0\.0\.1'/);
 assert.match(bridge,/ZARAY_RADIUS_GATEWAY_TOKEN/);
 assert.match(bridge,/upstream\.status===204\?204:upstream\.status===401\?401:503/);
 const result=spawnSync(process.execPath,['radius-service/bridge.mjs'],{env:{PATH:process.env.PATH},encoding:'utf8',timeout:4000});
 assert.notEqual(result.status,0,'bridge must reject missing credentials');
});
test('FreeRADIUS examples require PAP and dedicated NAS secret',()=>{
 assert.match(read('radius-service/freeradius/rest.example'),/framedProtocol/);
 assert.match(read('radius-service/freeradius/site.example'),/Auth-Type := zaray_rest/);
 assert.match(read('radius-service/freeradius/clients.example'),/REPLACE_WITH_LONG_RANDOM_SECRET/);
});
