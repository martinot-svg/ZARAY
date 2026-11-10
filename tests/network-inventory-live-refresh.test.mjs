import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
const connector=read('network-connector/agent.mjs');
const agent=read('src/app/api/network/agent/route.ts');
const route=read('src/app/api/network/inventory/refresh/route.ts');
const migration=read('supabase/migrations/20261109121500_mikrotik_administration_inventory.sql');
const ui=read('src/app/gestion-reseau/page.tsx');

test('refresh requests require tenant admin, local connector and preview isolation',()=>{
 assert.ok(route.includes('networkWritesBlockedInPreview()'));
 assert.ok(route.includes('authorizeTenant(client,companyId)'));
 assert.ok(route.includes("['owner','admin'].includes(auth.member.role)"));
 assert.ok(route.includes(".eq('id',routerId)"));
 assert.ok(route.includes(".eq('company_id',companyId)"));
 assert.ok(route.includes("router.agent_kind!=='node-local'"));
 assert.ok(route.includes("client.rpc('request_network_inventory_refresh'"));
 assert.ok(!route.includes('createServiceClient'));
 assert.ok(!route.includes("fetch('https://"));
 assert.ok(ui.includes("'/api/network/inventory/refresh'"));
 assert.ok(ui.includes('Demander une nouvelle collecte RouterOS'));
 assert.ok(ui.includes('Relire les données collectées'));
});

test('database request function serializes per-router requests and revokes direct writes',()=>{
 for(const part of [
  'CREATE TABLE IF NOT EXISTS public.network_inventory_refresh_requests',
  'ALTER TABLE public.network_inventory_refresh_requests ENABLE ROW LEVEL SECURITY',
  'REVOKE ALL ON public.network_inventory_refresh_requests FROM PUBLIC,anon,authenticated',
  "GRANT SELECT ON public.network_inventory_refresh_requests TO authenticated",
  'SECURITY DEFINER SET search_path=',
  "m.role IN ('owner','admin')",
  "r.agent_kind='node-local'",
  'FOR UPDATE OF r',
  "q.requested_at > now()-interval '60 seconds'",
  "GRANT EXECUTE ON FUNCTION public.request_network_inventory_refresh",
  'FOREIGN KEY(router_id,company_id)'
 ])assert.ok(migration.includes(part),part);
 assert.ok(!migration.includes('GRANT INSERT ON public.network_inventory_refresh_requests TO authenticated'));
});

test('connector forced scan actually reads only selected RouterOS source',async()=>{
 const begin=connector.indexOf('async function sync(');
 const end=connector.indexOf('\nasync function findAccount(',begin);
 assert.ok(begin>=0&&end>begin);
 const calls=[];
 const sources=[
  {kind:'interface',path:'interface',key:o=>o['.id'],label:o=>o.name,ip:()=>'',mac:()=>'',active:()=>true},
  {kind:'dhcp',path:'ip/dhcp-server/lease',key:o=>o['.id'],label:o=>o.name,ip:()=>'',mac:()=>'',active:()=>true}
 ];
 const ros=async path=>{
  calls.push(path);
  if(path==='system/resource')return {'board-name':'test-router',version:'7.26','cpu-load':'2','total-memory':'100','free-memory':'99',uptime:'1h'};
  if(path==='system/routerboard')return {model:'CHR'};
  return [{'.id':'*1',name:path}];
 };
 const api=async (action,details)=>{
  assert.equal(action,'sync');
  assert.deepEqual(details.kinds,['dhcp']);
  assert.equal(details.observations.length,1);
  return {synced:1};
 };
 const factory=new Function('sources','chooseRouterOsSources','ros','readOnlyInventoryProjection',
  'sanitizedRouterOsDetails','voucherUptimeReadings','api','normalize','console',
  'inventoryCycle',connector.slice(begin,end)+'\nreturn sync;');
 const sync=factory(sources,()=>sources,ros,()=>['.id','name'],()=>({}),async()=>[],api,
  v=>typeof v==='string'?v:'',{log:()=>{},warn:()=>{}},0);
 assert.deepEqual(await sync(['dhcp']),['dhcp']);
 assert.deepEqual(calls,['system/resource','system/routerboard','ip/dhcp-server/lease']);
});

test('connector reports successful follow-up reads and never acknowledges a failed scan',async()=>{
 const begin=connector.indexOf('async function poll(');
 const end=connector.indexOf('\nconsole.log(',begin);
 assert.ok(begin>=0&&end>begin);
 const actions=[];
 const api=async (action,details)=>{
  actions.push(action);
  if(action==='poll')return {commands:[],refresh:[
   {kind:'interface',requestedAt:'2026-11-10T07:00:00Z'}]};
  return {acknowledged:true};
 };
 const factory=new Function('api','execute','reportResult','sources','sync','console',
  connector.slice(begin,end)+'\nreturn poll;');
 const sources=[{kind:'interface'}];
 const sync=async()=>['interface'];
 await factory(api,async()=>'',async()=>{},sources,sync,{warn:()=>{},error:()=>{}})();
 assert.deepEqual(actions,['poll','refresh-complete']);
 actions.length=0;
 await factory(api,async()=>'',async()=>{},sources,async()=>[],{warn:()=>{},error:()=>{}})();
 assert.deepEqual(actions,['poll']);
});

test('agent recognizes only tenant-bound fresh acknowledgements',()=>{
 assert.ok(agent.includes("action==='refresh-complete'"));
 assert.ok(agent.includes("Date.parse(source.observed_at)<Date.parse(requestedAt)"));
 assert.ok(agent.includes(".eq('router_id',routerId)"));
 assert.ok(agent.includes(".eq('company_id',router.company_id)"));
 assert.ok(agent.includes(".eq('requested_at',requestedAt).is('fulfilled_at',null)"));
 assert.ok(agent.includes('limit(2)'));
 assert.ok(agent.includes('refreshRequests'));
 assert.ok(connector.includes("sync([requested.kind])"));
});

test('Windows Sandbox debug fixture is explicitly offline and hash-pinned',()=>{
 const template=read('tools/winbox-lab/WinBox-offline.wsb.template');
 const script=read('tools/winbox-lab/WinBox-offline.ps1');
 for(const tag of ['<Networking>Disable</Networking>','<VGpu>Disable</VGpu>',
  '<ClipboardRedirection>Disable</ClipboardRedirection>','<ReadOnly>true</ReadOnly>'])
  assert.ok(template.includes(tag),tag);
 assert.ok(script.includes('4ec6afb7b308633fd2d9e2354fbb164d727f3552216fd61a19518dbc1aaf6861'));
 assert.ok(script.includes('Get-Process'));
 assert.ok(!script.includes('MIKROTIK_PASSWORD'));
 assert.ok(!script.includes('RouterOS login'));
});
