import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INVENTORY_PROJECTIONS} from '../network-connector/routeros/inventory-projections.mjs';
import {chooseRouterOsSources,ADVANCED_SCAN_EVERY_CYCLES,FAST_INVENTORY_KINDS}
 from '../network-connector/routeros/inventory-schedule.mjs';
import {inventorySourceIsCurrent} from '../src/lib/network-inventory-freshness.ts';

const read=file=>readFileSync(file,'utf8');
const connector=read('network-connector/agent.mjs');
const agent=read('src/app/api/network/agent/route.ts');
const inventory=read('src/app/api/network/inventory/route.ts');
const coverage=read('src/app/api/network/inventory/coverage/route.ts');
const migration=read('supabase/migrations/20261109121500_mikrotik_administration_inventory.sql');
const ui=read('src/app/gestion-reseau/page.tsx');
const newKinds={
 bridge:'interface/bridge',
 'bridge-port':'interface/bridge/port',
 'dhcp-network':'ip/dhcp-server/network',
 'dns-static':'ip/dns/static',
 'firewall-address-list':'ip/firewall/address-list',
 'queue-tree':'queue/tree',
 'wireguard-interface':'interface/wireguard',
 'wireguard-peer':'interface/wireguard/peers',
 'routing-rule':'routing/rule',
 'ipv6-address':'ipv6/address'
};

test('new WinBox-equivalent inventory families are wired end to end',()=>{
 for(const [kind,path] of Object.entries(newKinds)){
  assert.ok(connector.includes("kind:'"+kind+"',path:'"+path+"'"),kind);
  assert.ok(INVENTORY_PROJECTIONS[path]?.length>0,path);
  assert.ok(agent.includes("'"+kind+"'"),kind);
  assert.ok(inventory.includes("'"+kind+"'"),kind);
  assert.ok(coverage.includes("'"+kind+"'"),kind);
  assert.equal(migration.split("'"+kind+"'").length,3,kind+' must appear in both SQL CHECK constraints');
  assert.ok(ui.includes('value="'+kind+'"'),kind);
 }
});
test('every projected RouterOS source has a strictly bounded public field list',()=>{
 const pairs=[...connector.matchAll(/\{kind:'([^']+)',path:'([^']+)'/g)];
 assert.ok(pairs.length>=30);
 const secret=/^(?:password|private-key|preshared-key|secret|shared-secret|script|source|ssh-key)$/;
 for(const [,_kind,path] of pairs){
  assert.ok(Object.hasOwn(INVENTORY_PROJECTIONS,path),path);
  for(const field of INVENTORY_PROJECTIONS[path]){
   assert.ok(!secret.test(field),path+' has secret property '+field);
  }
 }
 assert.ok(connector.includes("readOnlyInventoryProjection(source.path)"));
});
test('advanced sources are staggered, but Hotspot/PPPoE remain frequent',()=>{
 const all=[{kind:'interface'},{kind:'hotspot'},{kind:'pppoe'},{kind:'bridge'},{kind:'wireguard-peer'}];
 assert.equal(ADVANCED_SCAN_EVERY_CYCLES,10);
 assert.deepEqual(chooseRouterOsSources(all,0).map(x=>x.kind),all.map(x=>x.kind));
 for(const i of [1,2,9,11]){
  assert.deepEqual(chooseRouterOsSources(all,i).map(x=>x.kind),['interface','hotspot','pppoe']);
 }
 assert.deepEqual(chooseRouterOsSources(all,10).map(x=>x.kind),all.map(x=>x.kind));
 assert.ok(FAST_INVENTORY_KINDS.includes('hotspot')&&FAST_INVENTORY_KINDS.includes('pppoe'));
 assert.ok(connector.includes('chooseRouterOsSources(sources,inventoryCycle++)'));
 assert.ok(connector.includes('for(const source of selectedSources)'));
});
test('the stale-data contract differs between live sessions and config snapshots',()=>{
 const now=Date.parse('2026-11-10T07:00:00.000Z');
 const fourMinutes=new Date(now-4*60*1000).toISOString();
 const thirteenMinutes=new Date(now-13*60*1000).toISOString();
 assert.equal(inventorySourceIsCurrent('pppoe',fourMinutes,now),false);
 assert.equal(inventorySourceIsCurrent('bridge',fourMinutes,now),true);
 assert.equal(inventorySourceIsCurrent('bridge',thirteenMinutes,now),false);
 assert.equal(inventorySourceIsCurrent('wireguard-peer',new Date(now+30001).toISOString(),now),false);
 assert.ok(inventory.includes('inventorySourceIsCurrent(kind,latest)'));
 assert.ok(coverage.includes('inventorySourceIsCurrent(kind,source.observed_at,now)'));
});
