/**
 * Run the exact ZARAY RouterOS ping/projection library against an isolated CHR.
 * This is a manually invoked CI laboratory helper, NOT a production service.
 * The runner's private QEMU port forward is bound strictly to loopback.
 */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {boundedRouterOsPing} from '../../network-connector/routeros/bounded-ping.mjs';
import {readOnlyInventoryProjection} from '../../network-connector/routeros/inventory-projections.mjs';
import {operationReadProjection} from '../../network-connector/routeros/operation-read-projections.mjs';
import {executeManagedConfig} from '../../network-connector/routeros/managed-config.mjs';

const password=process.env.CHR_LAB_PASSWORD;
const filename=process.env.CHR_EVIDENCE_PATH;
if(!password||!filename)throw Error('Ephemeral CHR lab environment missing.');
const base='http://127.0.0.1:18080/rest/';
const authorization='Basic '+Buffer.from('admin:'+password).toString('base64');

async function ros(path,method='GET',body,fields){
 const configPaths=['ip/dns/static','interface/vlan'];
 const configPath=configPaths.find(x=>path===x||path.startsWith(x+'/*'));
 if(!['system/resource','interface','ip/address','ping'].includes(path)&&!configPath)
  throw Error('Unapproved CHR lab path');
 const allowed=configPath&&path===configPath?operationReadProjection(configPath):
  path==='interface'||path==='ip/address'?readOnlyInventoryProjection(path):null;
 if(fields&&(method!=='GET'||!allowed||!fields.every(x=>allowed.includes(x))))
  throw Error('Unsafe projection in CHR lab');
 const query=fields?'?'+new URLSearchParams({'.proplist':fields.join(',')}).toString():'';
 const response=await fetch(base+path+query,{
  method,redirect:'error',signal:AbortSignal.timeout(10000),
  headers:{Authorization:authorization,'Content-Type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body)
 });
 if(!response.ok)throw Error('CHR lab RouterOS REST HTTP '+response.status);
 const raw=await response.text();
 if(raw.length>1024*1024)throw Error('CHR response exceeds safe limit');
 // RouterOS DELETE is successful with HTTP 204 and deliberately no body.
 // Treat empty content as an expected success, not a JSON syntax error.
 return raw?JSON.parse(raw):null;
}

const resource=await ros('system/resource');
assert.match(resource.version,/^7\.24\.6/);
const iface=await ros('interface','GET',undefined,readOnlyInventoryProjection('interface'));
assert.ok(Array.isArray(iface)&&iface.some(x=>x.name==='ether1'));
const addresses=await ros('ip/address','GET',undefined,readOnlyInventoryProjection('ip/address'));
assert.ok(Array.isArray(addresses)&&addresses.some(x=>x.address==='10.0.2.15/24'));
const ping=await boundedRouterOsPing(ros,'127.0.0.1');
assert.equal(ping.length,3);
assert.deepEqual(ping.map(s=>s.seq),['0','1','2']);
assert.ok(ping.every(s=>s.status==='received'&&s.time));
const assertManaged=(result,stage)=>{
 if(result.state!=='success')console.error('[CHR-'+stage+'] '+result.message);
 assert.equal(result.state,'success',stage+': '+result.message);
};
const dnsCreated=await executeManagedConfig(ros,{
 id:'11111111-1111-4111-8111-111111111111',kind:'dns-static',
 operation:'create',targetId:null,values:{name:'zaraylab.example',address:'192.0.2.10'}
});
assertManaged(dnsCreated,'dns create');
const dnsId=dnsCreated.after['.id'];
assert.ok(dnsId?.startsWith('*'));
const dnsUpdated=await executeManagedConfig(ros,{
 id:'22222222-2222-4222-8222-222222222222',kind:'dns-static',
 operation:'update',targetId:dnsId,values:{name:'zaraylab.example',address:'192.0.2.11'}
});
assertManaged(dnsUpdated,'dns update');
assert.equal(dnsUpdated.after.address,'192.0.2.11');
const dnsDisabled=await executeManagedConfig(ros,{
 id:'33333333-3333-4333-8333-333333333333',kind:'dns-static',
 operation:'disable',targetId:dnsId,values:{}
});
assertManaged(dnsDisabled,'dns disable');
const dnsDeleted=await executeManagedConfig(ros,{
 id:'44444444-4444-4444-8444-444444444444',kind:'dns-static',
 operation:'delete',targetId:dnsId,values:{}
});
assertManaged(dnsDeleted,'dns delete');
const vlanCreated=await executeManagedConfig(ros,{
 id:'55555555-5555-4555-8555-555555555555',kind:'vlan',
 operation:'create',targetId:null,
 values:{name:'zaraylab100',interface:'ether1','vlan-id':'100'}
});
assertManaged(vlanCreated,'vlan create');
const vlanDisabled=await executeManagedConfig(ros,{
 id:'66666666-6666-4666-8666-666666666666',kind:'vlan',
 operation:'disable',targetId:vlanCreated.after['.id'],values:{}
});
assertManaged(vlanDisabled,'vlan disable');
const configVerified={
 dnsCreate:dnsCreated.state,
 dnsUpdate:dnsUpdated.state,
 dnsDisable:dnsDisabled.state,
 dnsDelete:dnsDeleted.state,
 vlanCreate:vlanCreated.state,
 vlanDisable:vlanDisabled.state
};
const result={
 engine:'ZARAY JavaScript boundedRouterOsPing and official readOnlyInventoryProjection, managed RouterOS config',
 routerosVersion:resource.version,
 interfaces:iface.map(i=>({name:i.name,type:i.type,running:i.running})),
 addresses:addresses.map(i=>({address:i.address,interface:i.interface})),
 ping,
 managedConfig:configVerified,
 verified:true,
 transport:'isolated QEMU loopback HTTP only; ZARAY deployment requires trusted HTTPS'
};
await writeFile(filename,JSON.stringify(result,null,2)+'\n',{mode:0o600});
console.log('ZARAY RouterOS REST live: resources, interfaces, addresses, ping and DNS/VLAN create/update/disable/delete verified.');
