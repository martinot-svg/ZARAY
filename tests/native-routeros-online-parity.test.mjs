import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
const native=read('public/network/zaray-routeros-agent.rsc');
const server=read('src/app/api/network/agent/route.ts');
const diagnostics=read('src/app/api/network/diagnostics/route.ts');
const page=read('src/app/gestion-reseau/page.tsx');
const api=read('src/app/api/network/route.ts');
const migration=read('supabase/migrations/20261110192500_routeros_native_online_ping.sql');
const begin=native.indexOf('# BEGIN ZARAY NATIVE READ-ONLY NETWORK DISCOVERY');
const end=native.indexOf('# END ZARAY NATIVE READ-ONLY NETWORK DISCOVERY');
const inventory=native.slice(begin,end);
const kinds=[
 'ip-address','vlan','bridge','dhcp','dhcp-server','dhcp-client',
 'arp','route','firewall-filter','firewall-nat','queue','dns-static'
];
const menus={
 'ip-address':'/ip address','vlan':'/interface vlan','bridge':'/interface bridge',
 'dhcp':'/ip dhcp-server lease','dhcp-server':'/ip dhcp-server',
 'dhcp-client':'/ip dhcp-client','arp':'/ip arp','route':'/ip route',
 'firewall-filter':'/ip firewall filter','firewall-nat':'/ip firewall nat',
 'queue':'/queue simple','dns-static':'/ip dns static'
};

test('native RouterOS agent provides real network inventories without a local computer',()=>{
 assert.ok(begin>0&&end>begin);
 for(const kind of kinds){
  const block=inventory.split('# '+kind+': RouterOS-originated collection')[1]?.split(' on-error=')[0];
  assert.ok(block,kind+' collection absent');
  assert.ok(block.includes('/'+menus[kind].slice(1)+' find'),kind+' RouterOS lookup missing');
  assert.ok(block.includes('$count < 6'),kind+' per-poll limit missing');
  assert.ok(block.includes('"kind"="'+kind+'"'),kind+' observation missing');
  assert.ok(block.includes('"props"=('),kind+' properties missing');
  assert.ok(block.includes('reportedCount'),kind+' coverage count missing');
  assert.ok(block.includes('collectedCount'),kind+' coverage count missing');
 }
 assert.ok(native.includes('check-certificate=yes'));
 assert.ok(!inventory.includes('password'));
 assert.ok(!inventory.includes('private-key'));
 assert.ok(!inventory.includes('/system script'));
 assert.ok(!inventory.includes('/ip firewall filter add'));
});

test('native Ping is bounded, router-initiated, leased and has no terminal',()=>{
 for(const part of [
  ':local supportedDiagnostics {"ping"}',
  '"supportedDiagnostics"=$supportedDiagnostics',
  '"diagnostics")] = "array"',
  '[/ping address=$target count=3 as-value]',
  '[:len $samples] < 3',
  '"dispatchedAt"=$lease',
  '"action"="diagnostic-result"',
  'check-certificate=yes output=none'
 ])assert.ok(native.includes(part),part);
 assert.ok(!native.includes('[/execute script='));
 assert.ok(!native.includes('check-certificate=no'));
});

test('native diagnostic capability is authenticated and not inferred from RouterOS version',()=>{
 for(const part of [
  'const declaredDiagnostics=b?.supportedDiagnostics',
  "declaredDiagnostics.some(v=>v!=='ping')",
  "router.agent_kind==='routeros-native'",
  'native_ping_supported:nativePingAdvertised',
  "router.agent_kind==='routeros-native'&&nativePingAdvertised",
  "router.native_ping_supported===true",
  "pingAvailable"
 ])assert.ok(server.includes(part)||diagnostics.includes(part),part);
 assert.ok(api.includes('native_ping_supported'));
 assert.ok(page.includes("chosen.native_ping_supported===true"));
 assert.ok(migration.includes('native_ping_supported boolean NOT NULL DEFAULT false'));
 assert.ok(!migration.includes('GRANT UPDATE'));
});
