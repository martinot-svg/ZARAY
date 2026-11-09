import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const api=read('src/app/api/network/agent/route.ts');
const access=read('src/app/api/network/access/route.ts');
const offers=read('src/app/api/offers/route.ts');
const ui=read('src/app/offres/page.tsx');
const routeros=read('public/network/zaray-routeros-agent.rsc');
const migration=read('supabase/migrations/20261109210000_network_native_entitlements.sql');

test('unconfirmed network commands are eligible for leasing again with no duplicates',()=>{
 assert.match(api,/retryBefore=new Date\(Date\.now\(\)-90000\)/);
 assert.match(api,/\.in\('status',\['queued','dispatched'\]\)/);
 assert.match(api,/cmd\.status==='dispatched'/);
 assert.match(api,/\.eq\('dispatched_at',cmd\.dispatched_at\)/);
 assert.match(api,/\.eq\('status',cmd\.status\)/);
 assert.match(api,/query\.in\('action',supported\)/);
});
test('acknowledgements are repeatable only for same router and outcome',()=>{
 assert.match(api,/let command=recorded/);
 assert.match(api,/if\(!command\)/);
 assert.match(api,/previous\.status!==\(ok\?'success':'failed'\)/);
 assert.match(api,/\.eq\('id',commandId\)\.eq\('router_id',routerId\)/);
});
test('resume grants include trustworthy paid status, tenant, deadline and clock-bound expiry',()=>{
 assert.match(api,/account\.administrative_hold/);
 assert.match(api,/account\.username!==cmd\.username/);
 assert.match(api,/order\.site_id===router\.site_id/);
 assert.match(api,/\['paid','active','activation_pending'\]/);
 assert.match(api,/BigInt\\(expiry\\)\\*BigInt\\(1000000\\)/);
 assert.match(api,/deadlineEpochNs/);
 assert.match(api,/uploadKbps/);
});
test('router enforces calendar expiry before reaching the cloud only for tagged accounts',()=>{
 const guard=routeros.indexOf('Offline guard runs BEFORE all cloud requests');
 const sync=routeros.indexOf('"action"="sync"');
 assert.ok(guard>0&&sync>guard);
 assert.match(routeros, /:tonsec value=\[:timestamp\]/);
 assert.match(routeros,/1704067200000000000/);
 assert.match(routeros,/\^zaray:access:/);
 assert.match(routeros,/\$nowNs >= \$due/);
 assert.match(routeros,/\/ip hotspot user disable \$user/);
 assert.match(routeros,/\/ppp secret disable \$user/);
 assert.match(routeros,/Unmanaged Hotspot comment/);
 assert.match(routeros,/Unmanaged PPP comment/);
});
test('bandwidth configuration is optional, bounded, snapshotted, and never overwrites unrelated profiles',()=>{
 assert.match(migration,/ALTER TABLE public\.offers/);
 assert.match(migration,/ALTER TABLE public\.network_access_accounts/);
 assert.match(migration,/upload_kbps BETWEEN 64 AND 10000000/);
 assert.match(access,/uploadKbps=offer\.upload_kbps/);
 assert.match(offers,/Number\.isInteger\(upload\)/);
 assert.match(ui,/Débit montant \(kbit\/s\)/);
 assert.match(ui,/Débit descendant \(kbit\/s\)/);
 assert.match(routeros,/zaray:managed-bandwidth/);
 assert.match(routeros,/Hotspot profile not managed by ZARAY/);
 assert.match(routeros,/PPP profile not managed by ZARAY/);
});
test('existing control gate and bounded RouterOS actions are intact',()=>{
 assert.match(api,/if\(!router\.control_enabled\)return json\(\{commands:\[\],controlEnabled:false\}\)/);
 assert.match(api,/siteActive/);
 assert.match(api,/credential_hash/);
 assert.match(routeros,/check-certificate=yes/g);
 assert.doesNotMatch(routeros,/check-certificate=no/);
 assert.doesNotMatch(routeros,/\/ip firewall|\/ip route add|\/user add/i);
});
