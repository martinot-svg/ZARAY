/**
 * Run the exact ZARAY RouterOS ping/projection library against an isolated CHR.
 * This is a manually invoked CI laboratory helper, NOT a production service.
 * The runner's private QEMU port forward is bound strictly to loopback.
 */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {boundedRouterOsPing} from '../../network-connector/routeros/bounded-ping.mjs';
import {readOnlyInventoryProjection} from '../../network-connector/routeros/inventory-projections.mjs';

const password=process.env.CHR_LAB_PASSWORD;
const filename=process.env.CHR_EVIDENCE_PATH;
if(!password||!filename)throw Error('Ephemeral CHR lab environment missing.');
const base='http://127.0.0.1:18080/rest/';
const authorization='Basic '+Buffer.from('admin:'+password).toString('base64');

async function ros(path,method='GET',body,fields){
 if(!['system/resource','interface','ip/address','ping'].includes(path))
  throw Error('Unapproved CHR lab path');
 const allowed=path==='interface'||path==='ip/address'?readOnlyInventoryProjection(path):null;
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
 return JSON.parse(raw);
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
const result={
 engine:'ZARAY JavaScript boundedRouterOsPing and official readOnlyInventoryProjection',
 routerosVersion:resource.version,
 interfaces:iface.map(i=>({name:i.name,type:i.type,running:i.running})),
 addresses:addresses.map(i=>({address:i.address,interface:i.interface})),
 ping,
 verified:true,
 transport:'isolated QEMU loopback HTTP only; ZARAY deployment requires trusted HTTPS'
};
await writeFile(filename,JSON.stringify(result,null,2)+'\n',{mode:0o600});
console.log('ZARAY JavaScript RouterOS REST library checks succeeded: resources, interfaces, addresses, ping (3/3).');
