import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=(path)=>readFileSync(path,'utf8');
const migration=file('supabase/migrations/20261109121500_mikrotik_administration_inventory.sql');
const backend=file('src/app/api/network/agent/route.ts');
const inventory=file('src/app/api/network/inventory/route.ts');
const operations=file('src/app/api/network/operations/route.ts');
const node=file('network-connector/agent.mjs');
const native=file('public/network/zaray-routeros-agent.rsc');
const ui=file('src/app/gestion-reseau/page.tsx');

test('advanced read-only inventories never capture credentials or raw configuration',()=>{
 for(const kind of ['hotspot-user','hotspot-profile','ppp-secret','ppp-profile','ip-address','ip-pool',
  'dhcp-server','queue','firewall-filter','firewall-nat','route']){
  assert.ok(node.includes("kind:'"+kind+"'"),kind);
  assert.ok(backend.includes("'"+kind+"'"),kind);
  assert.ok(migration.includes("'"+kind+"'"),kind);
 }
 assert.ok(node.includes("label:o=>"));
 assert.ok(!node.includes("label:o=>JSON.stringify(o)"));
 assert.ok(!node.includes("password:o=>"));
 assert.ok(!node.includes("secret:o=>"));
});
test('inventory coverage is explicit, capped, paged and tenant-scoped',()=>{
 assert.ok(node.includes("sourceStats:[...sourceStats.values()]"));
 assert.ok(node.includes("key:o=>'wifi:'"));
 assert.ok(node.includes("key:o=>'wireless:'"));
 assert.ok(node.includes("Math.min(25,500-items.length)"));
 assert.ok(backend.includes("b?.sourceStats!==undefined"));
 assert.ok(backend.includes("complete:item.complete"));
 assert.ok(inventory.includes("authorizeTenant(client,companyId)"));
 assert.ok(inventory.includes(".eq('router_id',routerId).eq('company_id',companyId)"));
 assert.ok(inventory.includes(".range(offset,offset+size-1)"));
 assert.ok(inventory.includes("migration_required"));
 assert.ok(inventory.includes("requires_local_connector"));
 assert.ok(migration.includes("ENABLE ROW LEVEL SECURITY"));
 assert.ok(migration.includes("GRANT SELECT ON public.network_inventory_sources TO authenticated"));
 assert.ok(!migration.includes("GRANT INSERT ON public.network_inventory_sources TO authenticated"));
});
test('session command is not an insecure direct RouterOS browser call',()=>{
 assert.ok(operations.includes("authorizeTenant(client,companyId)"));
 assert.ok(operations.includes("['owner','admin']"));
 assert.ok(operations.includes("confirmation!=='DECONNECTER'"));
 assert.ok(operations.includes("router.control_enabled"));
 assert.ok(operations.includes("credential?.paired_at"));
 assert.ok(operations.includes("networkWritesBlockedInPreview()"));
 assert.ok(operations.includes("recent(observation.observed_at)"));
 assert.ok(operations.includes(".eq('router_id',routerId).eq('company_id',companyId)"));
 assert.ok(operations.includes("observed_kind==='hotspot'"));
 assert.ok(operations.includes("observed_kind==='pppoe'"));
 assert.ok(operations.includes("session_id:sessionId"));
 assert.ok(operations.includes("Date.now()+10*60000"));
 assert.ok(operations.includes("'network.session_disconnect_requested'"));
 assert.ok(!operations.includes("MIKROTIK_PASSWORD"));
});
test('disconnect acknowledgement verifies RouterOS session absence in both execution modes',()=>{
 assert.ok(node.includes("const after=await ros(path,'GET',undefined,operationReadProjection(path))"));
 assert.ok(node.includes("Session encore présente après la commande MikroTik"));
 assert.ok(native.includes("Hotspot session still active"));
 assert.ok(native.includes("PPP session still active"));
 assert.ok(native.includes("Hotspot session removal confirmed"));
 assert.ok(native.includes("PPP session removal confirmed"));
 assert.ok(backend.includes(".eq('status','dispatched')"));
 assert.ok(native.includes("check-certificate=yes"));
});
test('native RouterOS publishes partial counts without pretending to implement advanced REST',()=>{
 assert.ok(native.includes('"sourceStats"=$sourceStats'));
 assert.ok(native.includes('"reportedCount"=$reported'));
 assert.ok(native.includes('"collectedCount"=$count'));
 assert.ok(native.includes('"complete"=($count = $reported)'));
 assert.ok(!native.includes('/rest/ip/firewall/filter'));
});
test('browser identifies incompatible sources and separates request from confirmation',()=>{
 for(const status of ['migration_required','requires_local_connector','stale','partial','complete']){
  assert.ok(ui.includes(status),status);
 }
 assert.ok(ui.includes("Déconnecter"));
 assert.ok(ui.includes("network/operations"));
 assert.ok(ui.includes("confirmation:'DECONNECTER'"));
 assert.ok(ui.includes('page {inventoryPage}'));
 assert.ok(ui.includes("le résultat ne sera confirmé"));
 assert.ok(ui.includes("retour arrière local sûr"));
});

test('all existing network write handlers reject unisolated Vercel Previews',()=>{
 const guard=file('src/lib/network-preview-guard.ts');
 assert.ok(guard.includes("process.env.VERCEL_ENV==='preview'"));
 assert.ok(guard.includes("ZARAY_PREVIEW_NETWORK_MUTATIONS"));
 for(const path of [
  'src/app/api/network/route.ts',
  'src/app/api/network/operations/route.ts',
  'src/app/api/network/access/route.ts',
  'src/app/api/network/device-action/route.ts',
  'src/app/api/network/pair/route.ts',
  'src/app/api/network/agent/route.ts',
  'src/app/api/network/radius/gateway/route.ts',
  'src/app/api/network/radius/credentials/route.ts',
  'src/app/api/network/radius/auth/route.ts'
 ]){
  const src=file(path);
  assert.ok(src.includes('networkWritesBlockedInPreview()'),path);
  assert.ok(src.includes('status:403')||(path.endsWith('/operations/route.ts')&&src.includes("error('Prévisualisation en lecture seule : opérations réelles désactivées.',403)")),path);
 }
});

test('generated local and native agents target the preview deployment, never the production alias by default',()=>{
 assert.ok(native.includes('__ZARAY_AGENT_ENDPOINT__'));
 assert.ok(!native.includes('https://zaray.vercel.app/api/network/agent'));
 assert.ok(ui.includes(".replaceAll('__ZARAY_AGENT_ENDPOINT__',currentZarayOrigin()+'/api/network/agent')"));
 assert.ok(ui.includes("'ZARAY_URL='+currentZarayOrigin()"));
 assert.ok(ui.includes("url.protocol!=='https:'"));
});
