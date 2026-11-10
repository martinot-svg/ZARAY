import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('network-connector/agent.mjs','utf8');
const start=source.indexOf('async function disconnect(');
const end=source.indexOf('\nasync function hotspotMacRestriction(',start);
assert.ok(start>=0&&end>start,'Fonction de déconnexion du connecteur introuvable');
const functionSource=source.slice(start,end);

function prepare(initial,{unavailable=false,deleteFails=false}={}){
 let active=initial.map(item=>({...item})),deletions=[];
 const ros=async(path,method='GET')=>{
  if(method==='DELETE'){
   deletions.push(path);
   if(!deleteFails)active=active.filter(item=>path.split('/').at(-1)!==item['.id']);
   return [];
  }
  if(unavailable)return null;
  return active.map(item=>({...item}));
 };
 const sandbox={ros,Error,operationReadProjection:()=>['.id','name','user']};
 vm.runInNewContext(functionSource+'\nthis.disconnect=disconnect;',sandbox,{timeout:1000});
 return {disconnect:sandbox.disconnect,deletions,remaining:()=>active};
}

for(const [protocol,username] of [['hotspot','customer'],['pppoe','subscriber']]){
 const userKey=protocol==='hotspot'?'user':'name';
 test(protocol+': absent targeted session is idempotent without deleting another session',async()=>{
  const t=prepare([{'.id':'*2',[userKey]:username}]);
  assert.equal(await t.disconnect(protocol,username,'*1'),0);
  assert.equal(t.deletions.length,0);
 });
 test(protocol+': targeted session removal is confirmed',async()=>{
  const t=prepare([{'.id':'*1',[userKey]:username},{'.id':'*2',[userKey]:username}]);
  assert.equal(await t.disconnect(protocol,username,'*1'),1);
  assert.equal(t.deletions.length,1);
  assert.equal(t.remaining().length,1);
  assert.equal(t.remaining()[0]['.id'],'*2');
 });
 test(protocol+': claimed deletion with a still-present session fails',async()=>{
  const t=prepare([{'.id':'*1',[userKey]:username}],{deleteFails:true});
  await assert.rejects(()=>t.disconnect(protocol,username,'*1'),/Session encore présente/);
 });
 test(protocol+': unavailable router inventory cannot be treated as empty',async()=>{
  const t=prepare([],{unavailable:true});
  await assert.rejects(()=>t.disconnect(protocol,username,'*1'),/Liste des sessions/);
 });
 test(protocol+': account-wide suspension can find zero active sessions',async()=>{
  const t=prepare([]);
  assert.equal(await t.disconnect(protocol,username),0);
 });
}
