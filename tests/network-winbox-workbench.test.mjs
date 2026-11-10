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
  'Rechercher dans l’inventaire du routeur','visibleInventory.map',
  'Propriétés de l’élément sélectionné','selectedInventory.identity_key',
  "onClick={()=>void disconnectObserved(d)}",
  "network/operations",
  "setAdminSource(e.target.value);setInventoryPage(1);setInventoryQuery('');setSelectedInventoryId('')"
 ])assert.ok(page.includes(part),part);
 assert.ok(!page.includes('new WebSocket('),'browser must not open RouterOS sockets');
});

test('separate inventory windows keep tenant authorization and never forward arbitrary URL parameters',()=>{
 const page=readFileSync('src/app/gestion-reseau/page.tsx','utf8');
 assert.ok(page.includes("const url=new URL('/gestion-reseau',window.location.origin)"));
 assert.ok(page.includes("url.searchParams.set('companyId',companyId)"));
 assert.ok(page.includes("url.searchParams.set('routerId',routerId)"));
 assert.ok(page.includes("url.searchParams.set('kind',adminSource)"));
 assert.ok(page.includes("window.open(url.toString(),'_blank','noopener,noreferrer')"));
 assert.ok(page.includes("setRouterId(query.get('routerId')||'')"));
 assert.ok(page.includes("setAdminSource(requestedKind)"));
 assert.ok(page.includes("setRouterId(v=>(n.routers||[]).some((x:Router)=>x.id===v)?v:(n.routers?.[0]?.id||''))"));
 assert.ok(!page.includes('window.open(window.location.href'));
});

test('WinBox global filter searches across server-side pages without losing tenant scope',()=>{
 const page=readFileSync('src/app/gestion-reseau/page.tsx','utf8');
 const route=readFileSync('src/app/api/network/inventory/route.ts','utf8');
 const migration=readFileSync('supabase/migrations/20261110152239_mikrotik_administration_inventory.sql','utf8');
 assert.ok(page.includes("params.set('search',inventorySearchTerm)"));
 assert.ok(page.includes("setTimeout(()=>{setInventorySearchTerm(inventoryQuery.trim())"));
 assert.ok(page.includes("adminSource,inventoryPage,inventoryVersion,inventorySearchTerm"));
 assert.ok(route.includes("authorizeTenant(client,companyId)"));
 assert.ok(route.includes(".eq('id',routerId).eq('company_id',companyId)"));
 assert.ok(route.includes("client.rpc('network_inventory_search'"));
 assert.ok(route.includes("p_company_id:companyId,p_router_id:routerId,p_kind:kind,p_term:search,p_page:page"));
 assert.ok(!route.includes('createServiceClient()'));
 assert.ok(migration.includes('SECURITY INVOKER'));
 assert.ok(migration.includes("FROM public.network_observations AS n"));
 assert.ok(migration.includes('n.company_id=p_company_id AND n.router_id=p_router_id'));
 assert.ok(migration.includes('GRANT EXECUTE ON FUNCTION public.network_inventory_search'));
 assert.ok(!page.includes('new WebSocket('));
});
