import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('network-connector/agent.mjs','utf8');
const begin=source.indexOf('async function disconnect(');
const end=source.indexOf('\nasync function hotspotMacRestriction(',begin);
assert.ok(begin>=0&&end>begin,'actual connector disconnect() function must remain discoverable');
const functionSource=source.slice(begin,end);
// The exact production function is exercised with an injectable fake RouterOS REST
// adapter. This does not claim a physical MikroTik has been exercised.
const makeDisconnect=(ros)=>new Function('ros','operationReadProjection','return ('+functionSource+')')(ros,()=>['.id','name','user']);
function simulatedRouter(path,records,{discardDelete=false,failDelete=false}={}){
 const state=[...records],requests=[];
 const ros=async(url,method='GET')=>{
  requests.push({url,method});
  if(method==='GET'&&url===path)return state.map(row=>({...row}));
  if(method==='DELETE'&&url.startsWith(path+'/')){
   if(failDelete)throw Error('RouterOS API unreachable');
   if(!discardDelete){
    const id=url.slice(path.length+1);
    const n=state.findIndex(row=>row['.id']===id);
    if(n>=0)state.splice(n,1);
   }
   return {};
  }
  throw Error('Unexpected RouterOS REST path: '+url);
 };
 return {ros,state,requests};
}
test('Hotspot: observed session is removed, then REST read confirms disappearance',async()=>{
 const router=simulatedRouter('ip/hotspot/active',[
  {'.id':'*A',user:'alice'},{'.id':'*B',user:'alice'},{'.id':'*C',user:'bob'}]);
 const count=await makeDisconnect(router.ros)('hotspot','alice','*A');
 assert.equal(count,1);
 assert.deepEqual(router.state.map(x=>x['.id']),['*B','*C']);
 assert.equal(router.requests.filter(x=>x.url==='ip/hotspot/active'&&x.method==='GET').length,2);
});
test('PPPoE: only the specified session is disconnected and confirmed',async()=>{
 const router=simulatedRouter('ppp/active',[{'.id':'*01',name:'abonne'},{'.id':'*02',name:'other'}]);
 const count=await makeDisconnect(router.ros)('pppoe','abonne','*01');
 assert.equal(count,1);
 assert.deepEqual(router.state,[{'.id':'*02',name:'other'}]);
});
test('Retry of an already disconnected session is idempotent',async()=>{
 const router=simulatedRouter('ip/hotspot/active',[]);
 assert.equal(await makeDisconnect(router.ros)('hotspot','alice','*A'),0);
 assert.equal(router.requests.filter(x=>x.method==='DELETE').length,0);
});
test('RouterOS refusing to delete must never produce a confirmed result',async()=>{
 const router=simulatedRouter('ip/hotspot/active',[{'.id':'*A',user:'alice'}],{discardDelete:true});
 await assert.rejects(makeDisconnect(router.ros)('hotspot','alice','*A'),/encore présente/);
});
test('RouterOS network error surfaces as a failure, not success',async()=>{
 const router=simulatedRouter('ppp/active',[{'.id':'*A',name:'abonne'}],{failDelete:true});
 await assert.rejects(makeDisconnect(router.ros)('pppoe','abonne','*A'),/unreachable/);
});
