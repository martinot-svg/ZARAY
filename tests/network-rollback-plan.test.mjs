import test from 'node:test';
import assert from 'node:assert/strict';
import {ADVANCED_ROUTEROS_WRITES_ENABLED,proposeReversibleToggle,simulateWatchdog} from '../network-connector/routeros/rollback-plan.mjs';

const args={
 kind:'firewall-filter',routerId:'11111111-1111-4111-8111-111111111111',
 resourceId:'*A',resourceComment:'zaray:managed:22222222-2222-4222-8222-222222222222',
 previousDisabled:true,nextDisabled:false,ttlSeconds:180
};
test('dangerous RouterOS configuration writes remain disabled',()=>{
 assert.equal(ADVANCED_ROUTEROS_WRITES_ENABLED,false);
 const plan=proposeReversibleToggle(args);
 assert.equal(plan.executable,false);
 assert.equal(plan.approval,'HARDWARE_CHR_TEST_REQUIRED');
 assert.equal(plan.apply.disabled,false);
 assert.equal(plan.rollback.disabled,true);
 assert.equal(plan.requiredPhases[1],'arm_local_watchdog');
});
test('reject unowned resources, unsafe paths, invalid TTL and no-op changes',()=>{
 for(const change of [
  {resourceComment:'manually-added'},
  {kind:'shell'},
  {kind:'wifi'},
  {ttlSeconds:301},
  {ttlSeconds:0},
  {resourceId:'../firewall/filter'},
  {nextDisabled:true}
 ]){
  assert.throws(()=>proposeReversibleToggle({...args,...change}));
 }
});
test('the modeled local watchdog restores state when cloud confirmation is missing',()=>{
 const plan=proposeReversibleToggle(args);
 const result=simulateWatchdog(plan,['arm','apply','verify','timeout']);
 assert.equal(result.disabled,true);
 assert.equal(result.restored,true);
 assert.equal(result.armed,false);
 assert.deepEqual(result.events,['watchdog_armed','changed','verified','rolled_back']);
});
test('no change is possible without an armed local watchdog',()=>{
 const plan=proposeReversibleToggle(args);
 assert.throws(()=>simulateWatchdog(plan,['apply']),/watchdog/);
 assert.throws(()=>simulateWatchdog(plan,['arm','confirm']),/unverified/);
});
test('a confirmed change can be committed only after read-back',()=>{
 const plan=proposeReversibleToggle(args);
 const result=simulateWatchdog(plan,['arm','apply','verify','confirm','timeout']);
 assert.equal(result.disabled,false);
 assert.equal(result.restored,false);
 assert.ok(result.events.includes('committed'));
});
