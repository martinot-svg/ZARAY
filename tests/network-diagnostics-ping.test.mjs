import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boundedRouterOsPing} from '../network-connector/routeros/bounded-ping.mjs';

const load=p=>readFileSync(p,'utf8');
const connector=load('network-connector/agent.mjs');
const api=load('src/app/api/network/agent/route.ts');
const ui=load('src/components/network/network-diagnostics-panel.tsx');
const page=load('src/app/gestion-reseau/page.tsx');
const route=load('src/app/api/network/diagnostics/route.ts');
const migration=load('supabase/migrations/20261110152239_mikrotik_administration_inventory.sql');

test('actual connector uses the same bounded and validated RouterOS ping function',async()=>{
 assert.ok(connector.includes("import {boundedRouterOsPing} from './routeros/bounded-ping.mjs'"));
 assert.ok(connector.includes('return boundedRouterOsPing(ros,address)'));
 const calls=[];
 const ros=async(path,method,params)=>{
  calls.push({path,method,params});
  return [{seq:'0',time:'6ms',ttl:'64'},{seq:'1',time:'7ms',ttl:'64'},
   {seq:'2',status:'timeout'},{seq:'3',time:'should-be-capped'},
   {seq:'4',private_key:'must-not-leak'}];
 };
 const records=await boundedRouterOsPing(ros,'192.0.2.7');
 assert.deepEqual(calls,[{path:'ping',method:'POST',params:{address:'192.0.2.7',count:'3'}}]);
 assert.equal(records.length,3);
 assert.equal(records[0].status,'received');
 assert.equal(records[2].status,'timeout');
 assert.ok(!JSON.stringify(records).includes('private_key'));
 for(const invalid of ['example.com','192.0.2.256','172.16.0.1;reboot','1.1.1.1/24','::1','001.2.3.4']){
  await assert.rejects(()=>boundedRouterOsPing(ros,invalid),/Cible IPv4/);
 }
 assert.equal(calls.length,1);
 await assert.rejects(()=>boundedRouterOsPing(async()=>[],'192.0.2.7'),/Aucun résultat/);
 await assert.rejects(()=>boundedRouterOsPing(async()=>[null],'192.0.2.7'),/mal formé/);
 await assert.rejects(()=>boundedRouterOsPing(async()=>[{seq:'0',time:'1ms'+String.fromCharCode(0)}],'192.0.2.7'),/invalide/);
});

test('ping can be requested only for company-owned, recent, observed device',()=>{
 for(const part of [
  'networkWritesBlockedInPreview()','authorizeTenant(client,companyId)',
  "['owner','admin'].includes(auth.member.role)",
  ".eq('router_id',routerId).maybeSingle()",
  ".eq('company_id',companyId).eq('router_id',routerId)",
  "const pingAvailable=router.agent_kind==='node-local'||",
  "router.native_ping_supported===true",
  "fresh(observation.observed_at)",
  "observation.ip_address",
  "kind:'ping',status:'queued'",
  "target=ipv4(String(observation.ip_address))",
  ".in('status',['queued','dispatched'])",
  ".lt('requested_at',cutoff)"
 ])assert.ok(route.includes(part),part);
 assert.ok(!route.includes('destination:body'));
 assert.ok(!route.includes('b?.address'));
 assert.ok(!route.includes("api('ping'"));
});

test('agent actually accepts normal RouterOS ping samples and rejects control characters',()=>{
 const sourceLine=api.split('\n').find(line=>line.includes('v.length>64||'));
 assert.ok(sourceLine,'Actual server sanitizer must be present');
 const literal=sourceLine.match(/\|\|(\/\[[^\]]+\]\/)\.test\(v\)/)?.[1];
 assert.ok(literal,'Extract a testable regex from the production server validation');
 const invalid=new Function('return '+literal)();
 for(const sample of ['0','1','2','u','64','3ms','timeout'])
  assert.equal(invalid.test(sample),false,'Valid value rejected: '+sample);
 for(const sample of [String.fromCharCode(0),String.fromCharCode(1),String.fromCharCode(31),String.fromCharCode(127)])
  assert.equal(invalid.test(sample),true,'Control character accepted');
});

test('browser cannot modify queued diagnostic records directly',()=>{
 for(const part of [
  'CREATE TABLE IF NOT EXISTS public.network_diagnostic_jobs',
  'network_diagnostic_one_pending',
  "status IN ('queued','dispatched')",
  'ALTER TABLE public.network_diagnostic_jobs ENABLE ROW LEVEL SECURITY',
  'GRANT SELECT ON public.network_diagnostic_jobs TO authenticated',
  'REVOKE ALL ON public.network_diagnostic_jobs FROM PUBLIC,anon,authenticated',
  "FOREIGN KEY(router_id,company_id)",
  'octet_length(reply::text)<2048'
 ])assert.ok(migration.includes(part),part);
 assert.ok(!migration.includes('GRANT INSERT ON public.network_diagnostic_jobs TO authenticated'));
});

test('paired agent acknowledges only dispatched jobs and validates size',()=>{
 for(const part of [
  "action==='diagnostic-result'","Array.isArray(b?.samples)","b.samples.length>3",
  "JSON.stringify(samples).length>1900",
  ".eq('id',id).eq('router_id',routerId).eq('company_id',router.company_id)",
  ".eq('status','dispatched')",
  ".in('status',['queued','dispatched'])",
  ".eq('status',job.status)",
  "diagnostics.push({id:job.id,kind:'ping',target:job.target,dispatchedAt:claimed.dispatched_at})",
  "router.agent_kind==='node-local'",
  ".eq('status','dispatched').eq('dispatched_at',dispatchedAt)",
  "dispatchableDiagnosticJob(job,now)",
  "claim=claim.eq('dispatched_at',job.dispatched_at)",
  "data:claimed,error:claimError",
  "ok&&b.samples.length===0",
  "!out.seq||!/^[0-2]$/.test(out.seq)"
 ])assert.ok(api.includes(part),part);
 assert.ok(readFileSync('network-connector/routeros/bounded-ping.mjs','utf8').includes("ros('ping','POST'"));
 assert.ok(connector.includes("api('diagnostic-result'"));
 assert.ok(connector.includes('dispatchedAt:job.dispatchedAt'));
 assert.ok(api.includes("if(!recorded)return json("));
});

test('WinBox-style diagnostics panel displays actual queued/readback state',()=>{
 assert.ok(page.includes('<NetworkDiagnosticsPanel'));
 assert.ok(page.includes('observationId={selectedInventory.id}'));
 assert.ok(ui.includes("fetch('/api/network/diagnostics'"));
 assert.ok(ui.includes("method:'POST'"));
 assert.ok(ui.includes("kind:'ping'"));
 assert.ok(ui.includes("job.status==='success'"));
 assert.ok(ui.includes("sample.status==='timeout'"));
 assert.ok(ui.includes('hasPending?15000:60000'));
 assert.ok(route.includes("status:'expired'"));
 assert.ok(route.includes('if(expiryError)return fail('));
 assert.ok(ui.includes('job.reply.map'));
 assert.ok(!ui.includes('MIKROTIK_PASSWORD'));
});
