import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterAndSortRouterInventory,inventoryObservationIsFresh}
 from '../src/lib/network-inventory-workbench.ts';

const now=Date.parse('2026-11-10T07:00:00Z');
const old='2026-11-10T06:55:00Z',recent='2026-11-10T06:59:20Z';
const base={
 router_id:'router-a',observed_kind:'interface',identity_key:'*1',
 ip_address:null,mac_address:null,client_label:null,active:true,observed_at:recent
};
const records=[
 {...base,id:'a',identity_key:'*A',client_label:'ÉtherDeux',ip_address:'192.0.2.10'},
 {...base,id:'b',identity_key:'*B',client_label:'ether1',ip_address:'192.0.2.2'},
 {...base,id:'c',identity_key:'*C',client_label:'WAN',mac_address:'AA:BB:CC:00:11:22',observed_at:old}
];
test('WinBox-style search is accent-insensitive, includes IP MAC and ID',()=>{
 assert.deepEqual(filterAndSortRouterInventory(records,'ether','label',false,recent,now).map(x=>x.id),['b','a']);
 assert.deepEqual(filterAndSortRouterInventory(records,'192.0.2.10','label',false,recent,now).map(x=>x.id),['a']);
 assert.deepEqual(filterAndSortRouterInventory(records,'aa:bb:cc','label',false,recent,now).map(x=>x.id),['c']);
 assert.deepEqual(filterAndSortRouterInventory(records,'*B','label',false,recent,now).map(x=>x.id),['b']);
});
test('sorting is deterministic, page-local and never mutates input',()=>{
 const original=records.map(x=>x.id);
 assert.deepEqual(filterAndSortRouterInventory(records,'','label',false,recent,now).map(x=>x.id),['b','a','c']);
 assert.deepEqual(filterAndSortRouterInventory(records,'','observed',false,recent,now).map(x=>x.id),['c','a','b']);
 assert.deepEqual(records.map(x=>x.id),original);
});
test('future timestamps, stale readings and offline routers never report verified state',()=>{
 assert.equal(inventoryObservationIsFresh(recent,recent,now),true);
 assert.equal(inventoryObservationIsFresh(old,recent,now),false);
 assert.equal(inventoryObservationIsFresh(recent,old,now),false);
 assert.equal(inventoryObservationIsFresh('2026-11-10T07:00:01Z',recent,now),false);
 assert.equal(inventoryObservationIsFresh(recent,null,now),false);
});
test('UI provides list -> filter -> properties and retains guarded session operations',()=>{
 const page=readFileSync('src/app/gestion-reseau/page.tsx','utf8');
 for(const part of [
  'filterAndSortRouterInventory(','type InventorySort',
  'Rechercher sur cette page','visibleInventory.map',
  'Propriétés de l’élément sélectionné','selectedInventory.identity_key',
  "onClick={()=>void disconnectObserved(d)}",
  "network/operations",
  "setAdminSource(e.target.value);setInventoryPage(1);setInventoryQuery('');setSelectedInventoryId('')"
 ])assert.ok(page.includes(part),part);
 assert.ok(!page.includes('new WebSocket('),'browser must not open RouterOS sockets');
});
