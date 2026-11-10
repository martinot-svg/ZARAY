import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {executeManagedConfig,reconcileManagedConfig,validateManagedChange} from '../network-connector/routeros/managed-config.mjs';
import {parseManagedConfigRequest} from '../src/lib/network-managed-config.ts';

const job=(operation,values={},kind='dns-static',targetId=operation==='create'?null:'*1')=>({
 id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',kind,operation,targetId,values
});
const tag='zaray:managed:cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function fakeRouter(records=[]){
 const state=records.map(v=>({...v}));
 const calls=[];
 async function ros(path,method='GET',body,projection){
  calls.push({path,method,body,projection});
  if(path==='interface')return [{'.id':'*99',name:'ether1',type:'ether'}];
  const listPath=path.startsWith('interface/vlan')?'interface/vlan':'ip/dns/static';
  if(method==='GET')return state.filter(v=>v.path===listPath).map(v=>{
   const out={};for(const prop of projection)if(v[prop]!==undefined)out[prop]=v[prop];return out;
  });
  if(method==='PUT'){
   state.push({...body,'.id':'*'+(state.length+1).toString(16),path:listPath});return {ret:state.at(-1)['.id']};
  }
  const id=path.slice(listPath.length+1),index=state.findIndex(v=>v['.id']===id);
  if(index===-1)throw Error('Not found');
  if(method==='PATCH'){Object.assign(state[index],body);return [];}
  if(method==='DELETE'){state.splice(index,1);return [];}
  throw Error('Unexpected path or command');
 }
 return {state,calls,ros};
}
function dnsOriginal(managed=true){
 return {path:'ip/dns/static','.id':'*1',name:'internal.example',address:'192.0.2.1',
  disabled:'false',comment:managed?tag:'configured-by-admin'};
}
test('input contract rejects arbitrary menus, scripts, credentials and missing confirmation fields',()=>{
 const base={category:'dns-static',operation:'create',
  values:{name:'internal.example',address:'192.0.2.10'},reason:'Créer un DNS interne'};
 assert.deepEqual(parseManagedConfigRequest(base)?.values,base.values);
 for(const entry of [
  {...base,category:'firewall'}, {...base,operation:'run'},
  {...base,values:{...base.values,password:'123'}},
  {...base,values:{name:'internal.example;reboot',address:'192.0.2.10'}},
  {...base,values:{name:'internal.example',address:'192.0.2.999'}},
  {...base,reason:'bad'},
  {...base,operation:'disable'},
  {...base,operation:'delete',observationId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}
 ])assert.equal(parseManagedConfigRequest(entry),null);
 assert.ok(parseManagedConfigRequest({category:'vlan',operation:'create',
  values:{name:'vlan100',interface:'ether1','vlan-id':'100'},reason:'Isoler un réseau'}));
});
test('DNS create is real PUT followed by exact projected RouterOS readback',async()=>{
 const r=fakeRouter();
 const result=await executeManagedConfig(r.ros,job('create',{name:'internal.example',address:'192.0.2.10'}));
 assert.equal(result.state,'success');
 assert.equal(result.after.comment,tag);
 assert.equal(r.calls.filter(x=>x.method==='PUT').length,1);
 assert.deepEqual(r.calls.find(x=>x.method==='PUT').body,
  {name:'internal.example',address:'192.0.2.10',comment:tag,disabled:'false'});
 assert.ok(r.calls.filter(x=>x.method==='GET').every(x=>x.projection.every(k=>!/(password|private-key|secret)/i.test(k))));
});
test('create replays are idempotent; unrelated names cannot be overwritten',async()=>{
 const r=fakeRouter([{...dnsOriginal(),address:'192.0.2.10'}]);
 const result=await executeManagedConfig(r.ros,job('create',{name:'internal.example',address:'192.0.2.10'}));
 assert.equal(result.state,'success');assert.equal(r.calls.filter(x=>x.method==='PUT').length,0);
 const conflict=fakeRouter([dnsOriginal(false)]);
 const denied=await executeManagedConfig(conflict.ros,job('create',{name:'internal.example',address:'192.0.2.10'}));
 assert.equal(denied.state,'failed');
 assert.equal(conflict.calls.filter(x=>x.method!=='GET').length,0);
});
test('update and disable protected resources with verified RouterOS readback',async()=>{
 const r=fakeRouter([dnsOriginal()]);
 const update=await executeManagedConfig(r.ros,job('update',{name:'internal.example',address:'192.0.2.20'}));
 assert.equal(update.state,'success');assert.equal(update.after.address,'192.0.2.20');
 const disabled=await executeManagedConfig(r.ros,job('disable'));
 assert.equal(disabled.state,'success');assert.equal(disabled.after.disabled,'true');
 const enabled=await executeManagedConfig(r.ros,job('enable'));
 assert.equal(enabled.state,'success');assert.equal(enabled.after.disabled,'false');
 assert.deepEqual(r.calls.filter(x=>x.method==='PATCH').map(x=>x.body),
  [{name:'internal.example',address:'192.0.2.20'},{disabled:'true'},{disabled:'false'}]);
});
test('unowned records cannot be modified, disabled, or removed',async()=>{
 for(const operation of ['update','disable','delete']){
  const r=fakeRouter([dnsOriginal(false)]);
  const result=await executeManagedConfig(r.ros,
   job(operation,operation==='update'?{name:'internal.example',address:'192.0.2.100'}:{}));
  assert.equal(result.state,'failed');assert.equal(r.calls.filter(x=>x.method!=='GET').length,0);
 }
});
test('DNS deletion requires disable and proves disappearance',async()=>{
 const r=fakeRouter([{...dnsOriginal(),disabled:'true'}]);
 const result=await executeManagedConfig(r.ros,job('delete'));
 assert.equal(result.state,'success');assert.equal(r.state.length,0);
 const active=fakeRouter([dnsOriginal()]);
 const denied=await executeManagedConfig(active.ros,job('delete'));
 assert.equal(denied.state,'failed');assert.equal(active.state.length,1);
});
test('DELETE 204 with no body and a lost response are both verified by reads, never replayed',async()=>{
 const r=fakeRouter([{...dnsOriginal(),disabled:'true'}]);
 const ros=async(path,method,body,fields)=>{
  const result=await r.ros(path,method,body,fields);
  if(method==='DELETE')throw Error('Transport lost response after HTTP 204');
  return result;
 };
 const outcome=await executeManagedConfig(ros,job('delete'));
 assert.equal(outcome.state,'success');
 assert.equal(r.state.length,0);
 assert.equal(r.calls.filter(x=>x.method==='DELETE').length,1);
 const stuck=fakeRouter([{...dnsOriginal(),disabled:'true'}]);
 const noRemoval=async(path,method,body,fields)=>{
  if(method==='DELETE')return null; // Pretend 204 but no state change.
  return stuck.ros(path,method,body,fields);
 };
 const uncertain=await executeManagedConfig(noRemoval,job('delete'));
 assert.equal(uncertain.state,'manual_review');
 assert.equal(stuck.state.length,1);
});
test('VLAN creates only on present parent interface and rejects unsafe IDs',async()=>{
 const r=fakeRouter();
 const ok=await executeManagedConfig(r.ros,job('create',{name:'vlan100',interface:'ether1','vlan-id':'100'},'vlan'));
 assert.equal(ok.state,'success');
 assert.equal(ok.after['vlan-id'],'100');
 for(const value of ['0','4095','200;:reboot','-1']){
  assert.throws(()=>validateManagedChange('vlan','create',
   {name:'vlan100',interface:'ether1','vlan-id':value},null),/Invalid/);
 }
 assert.throws(()=>validateManagedChange('vlan','delete',{},'*1'),/cannot be deleted/);
});
test('failed PATCH verification restores known prior values; unknown outcome blocks further work',async()=>{
 const before=dnsOriginal();
 const r=fakeRouter([before]);let patched=false;
 const ros=async(path,method='GET',body,fields)=>{
  if(method==='PATCH'&&!patched){patched=true;return [];}
  return r.ros(path,method,body,fields);
 };
 const result=await executeManagedConfig(ros,job('update',{name:'internal.example',address:'192.0.2.30'}));
 assert.equal(result.state,'failed');
 assert.match(result.message,/restored/);
 assert.equal(r.state[0].address,before.address);
 const uncertain=await executeManagedConfig(async(path,method)=>{
  if(method==='GET')return [];throw Error('Timeout');
 },job('create',{name:'internal.example',address:'192.0.2.22'}));
 assert.equal(uncertain.state,'manual_review');
});
test('lost create acknowledgement is recovered from the RouterOS owned marker without new writes',async()=>{
 const state=fakeRouter([{...dnsOriginal(),address:'192.0.2.10'}]);
 const result=await reconcileManagedConfig(state.ros,job('create',{
  name:'internal.example',address:'192.0.2.10'
 }));
 assert.equal(result.state,'success');
 assert.equal(state.calls.filter(c=>c.method!=='GET').length,0);
 const absent=fakeRouter([]);
 const failed=await reconcileManagedConfig(absent.ros,job('create',{
  name:'internal.example',address:'192.0.2.10'
 }));
 assert.equal(failed.state,'failed');
});
test('read-only reconciliation distinguishes already applied, rolled back and unknown updates',async()=>{
 const applied=fakeRouter([{...dnsOriginal(),address:'192.0.2.30'}]);
 const desired=job('update',{name:'internal.example',address:'192.0.2.30'});
 desired.before={name:'internal.example',address:'192.0.2.1',disabled:'false',comment:tag};
 assert.equal((await reconcileManagedConfig(applied.ros,desired)).state,'success');
 const unchanged=fakeRouter([dnsOriginal()]);
 assert.equal((await reconcileManagedConfig(unchanged.ros,desired)).state,'failed');
 const unknown=fakeRouter([{...dnsOriginal(),address:'192.0.2.99'}]);
 assert.equal((await reconcileManagedConfig(unknown.ros,desired)).state,'manual_review');
 assert.equal(unknown.calls.filter(c=>c.method!=='GET').length,0);
});
test('read-only reconciliation can confirm a previously deleted owned DNS record',async()=>{
 const deleted=job('delete');
 deleted.before={...dnsOriginal()};
 const r=fakeRouter([]);
 assert.equal((await reconcileManagedConfig(r.ros,deleted)).state,'success');
 assert.equal(r.calls.filter(c=>c.method!=='GET').length,0);
});
test('RLS, single-flight and web-to-agent integration stay explicit',()=>{
 const sql=readFileSync('supabase/migrations/20261110163450_network_managed_routeros_config.sql','utf8');
 const api=readFileSync('src/app/api/network/config/route.ts','utf8');
 const agent=readFileSync('src/app/api/network/agent/route.ts','utf8');
 const connector=readFileSync('network-connector/agent.mjs','utf8');
 const page=readFileSync('src/app/gestion-reseau/page.tsx','utf8');
 for(const part of [
  'ENABLE ROW LEVEL SECURITY','REVOKE ALL ON public.network_managed_config_jobs',
  "WHERE status IN ('queued','dispatched','manual_review')",
  'network_managed_config_router_fk','created_at timestamptz',
  "GRANT SELECT ON public.network_managed_config_jobs TO authenticated"
 ])assert.ok(sql.includes(part),part);
 for(const part of [
  'networkWritesBlockedInPreview()','authorizeTenant(client,companyId)',
  "['owner','admin'].includes(auth.member.role)",
  "router.agent_kind!=='node-local'",'routerHeartbeatIsFresh(router.last_seen_at)',
  "site.status!=='active'",'parseManagedConfigRequest(body)',
  ".in('status',['queued','dispatched'])",
  "status:'queued'"
 ])assert.ok(api.includes(part),part);
 for(const part of [
  "action==='config-result'","network_managed_config_jobs",
  "job.status!=='dispatched'","configJobs.push(",
  ".eq('status','dispatched').eq('dispatched_at',dispatchedAt)"
 ])assert.ok(agent.includes(part),part);
 assert.ok(connector.includes('executeManagedConfig(ros'));
 assert.ok(connector.includes('reconcileManagedConfig(ros'));
 assert.ok(agent.includes("action==='config-review-result'"));
 assert.ok(agent.includes('configReviewJobs.push('));
 assert.ok(page.includes('<ManagedConfigPanel'));
});
