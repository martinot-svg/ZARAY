import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(p,'utf8');
const ros = read('public/network/zaray-routeros-agent.rsc');
const api = read('src/app/api/network/agent/route.ts');
const network = read('src/app/api/network/route.ts');
const legacy = read('network-connector/agent.mjs');
const ui = read('src/app/gestion-reseau/page.tsx');
const migration = read('supabase/migrations/20261109193000_network_native_agent_mode.sql');

test('native RouterOS bootstrap is parameterized, paired once and never embeds production tokens',()=>{
 assert.match(ros,/__ZARAY_ROUTER_ID__/);
 assert.match(ros,/__ZARAY_PAIRING_TOKEN__/);
 assert.doesNotMatch(ros,/Bearer [a-f0-9]{64}/);
 assert.match(ros,/"action"="claim"/);
 assert.match(ros,/connectorSecret/);
 assert.match(ros,/check-certificate=yes/g);
 assert.doesNotMatch(ros,/check-certificate=no/);
 assert.match(ros,/zaray-native-credentials/);
 assert.match(ros,/zaray-native-minute/);
 assert.match(ros,/interval=1m/);
});
test('native script processes whitelisted actions with explicit RouterOS confirmation',()=>{
 for(const action of ['disconnect_hotspot','disconnect_ppp','suspend_account','resume_account','provision_voucher','expire_voucher'])
  assert.ok(ros.includes(action),action);
 assert.match(ros,/controlEnabled/);
 assert.match(ros,/supportedActions/);
 assert.match(ros,/name=\$username/);
 assert.match(ros,/comment\] != \$tag/);
 assert.match(ros,/provision_voucher/);
 assert.match(ros,/resultBody/);
 assert.match(ros,/"action"="result"/);
 assert.doesNotMatch(ros,/\/ip firewall (?:filter|nat) (?:add|set|remove|enable|disable)|\/ip route (?:add|set|remove)|\/user add/i);
});
test('server filters native agent actions without changing legacy connector behavior',()=>{
 assert.match(api,/declared=b\?\.supportedActions/);
 assert.match(api,/if\(supported\)query=query\.in\('action',supported\)/);
 assert.match(api,/if\(supported&&supported\.length===0\)/);
 assert.match(api,/!router\.control_enabled/);
 assert.match(api,/siteActive/);
 assert.match(api,/credential_hash/);
 assert.match(api,/agent_kind=b\.agentKind/);
 assert.match(legacy,/agentKind:'node-local'/);
});
test('agent origin is only metadata and cannot enable network control',()=>{
 assert.match(migration,/DEFAULT 'unreported'/);
 assert.match(migration,/routeros-native/);
 assert.doesNotMatch(migration,/control_enabled\s*=\s*true/i);
 assert.match(network,/control_enabled,agent_kind/);
});
test('browser creates private RSC only after authorized pairing, never uploads it as a public artifact',()=>{
 assert.match(ui,/prepareNativeAgent\(r:Router\)/);
 assert.match(ui,/fetch\('\/network\/zaray-routeros-agent\.rsc'/);
 assert.match(ui,/run\('\/api\/network\/pair'/);
 assert.match(ui,/\.replaceAll\('__ZARAY_PAIRING_TOKEN__',data\.pairingToken\)/);
 assert.match(ui,/new Blob\(\[source\]/);
 assert.match(ui,/supprimez toute copie du fichier/);
 assert.match(ui,/Agent RouterOS natif/);
 assert.match(ui,/\!canManage\|\|busy/);
});
test('legacy pairing and controlled command acknowledgment remain unchanged',()=>{
 const pair=read('src/app/api/network/pair/route.ts');
 const access=read('src/app/api/network/access/route.ts');
 assert.match(pair,/control_enabled:false/);
 assert.match(access,/creds\?\.paired_at/);
 assert.match(api,/\.eq\('status','dispatched'\)/);
});
