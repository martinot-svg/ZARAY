import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INVENTORY_PROJECTIONS,readOnlyInventoryProjection}
 from '../network-connector/routeros/inventory-projections.mjs';

const connector=readFileSync('network-connector/agent.mjs','utf8');
const backend=readFileSync('src/app/api/network/agent/route.ts','utf8');
const migration=readFileSync('supabase/migrations/20261109121500_mikrotik_administration_inventory.sql','utf8');
const ui=readFileSync('src/app/gestion-reseau/page.tsx','utf8');

test('REST reads request an explicit allowlist without sensitive properties',()=>{
 const forbidden=new Set(['password','secret','private-key','public-key','shared-secret','script','source','ssh-key']);
 for(const [path,fields] of Object.entries(INVENTORY_PROJECTIONS)){
  assert.ok(Array.isArray(fields)&&fields.length,path);
  for(const field of fields){
   assert.match(field,/^(?:\.id|[a-z][a-z0-9-]*)$/,path);
   assert.ok(!forbidden.has(field),path+': '+field);
  }
 }
 for(const path of ['interface','interface/vlan','ip/address','ip/dhcp-server','ip/dhcp-client',
  'ip/dhcp-server/lease','ip/arp','ip/hotspot/user','ppp/secret']){
  assert.ok(readOnlyInventoryProjection(path).length>0,path);
 }
 assert.throws(()=>readOnlyInventoryProjection('system/script'),/Unsupported/);
 assert.ok(connector.includes('readOnlyInventoryProjection(source.path)'));
});

test('real REST adapter sends safe RouterOS .proplist and rejects writes with proplist',async()=>{
 const begin=connector.indexOf('async function ros(');
 const end=connector.indexOf('\nlet token=',begin);
 assert.ok(begin>0&&end>begin);
 const calls=[];
 const request=async(url,opts)=>{calls.push({url,opts});return [];};
 const fn=new Function('router','request','basic','URLSearchParams','encodeURIComponent','readOnlyInventoryProjection',
  connector.slice(begin,end)+'\nreturn ros;');
 const ros=fn('https://192.0.2.1',request,'Basic mock',URLSearchParams,encodeURIComponent,readOnlyInventoryProjection);
 const fields=readOnlyInventoryProjection('ip/address');
 await ros('ip/address','GET',undefined,fields);
 assert.equal(calls.length,1);
 const url=new URL(calls[0].url);
 assert.equal(url.pathname,'/rest/ip/address');
 assert.equal(url.searchParams.get('.proplist'),fields.join(','));
 assert.equal(calls[0].opts.method,'GET');
 await assert.rejects(()=>ros('ip/address','DELETE',undefined,fields),/Unsafe RouterOS REST projection/);
 await assert.rejects(()=>ros('ip/address','GET',undefined,['password']),/Unsafe RouterOS REST projection/);
 assert.equal(calls.length,1);
});

test('VLAN, DHCP client and ARP are end-to-end read-only sources',()=>{
 for(const kind of ['vlan','dhcp-client','arp']){
  assert.ok(connector.includes("kind:'"+kind+"'"),kind);
  assert.ok(backend.includes("'"+kind+"'"),kind);
  assert.ok(migration.includes("'"+kind+"'"),kind);
  assert.ok(ui.includes('value="'+kind+'"'),kind);
 }
});

test('partial RouterOS snapshots cannot mark unseen clients offline',()=>{
 const preflight=backend.indexOf('const completeKinds=new Set<string>();');
 const write=backend.indexOf("service.from('network_observations').upsert(");
 assert.ok(preflight>0&&write>preflight,'validate source statuses before database writes');
 assert.ok(backend.includes('if(!completeKinds.has(kind))continue;'));
 assert.ok(backend.includes('if(item.complete&&actual!==collected)'));
 assert.ok(backend.includes('if(item.complete)completeKinds.add(kind);'));
 assert.ok(backend.includes("sourceEntries,{onConflict:'router_id,observed_kind'}"));
});
