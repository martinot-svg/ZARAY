import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchableNetworkCommand} from '../src/lib/network-command-lease.ts';
const now=Date.parse('2026-11-09T11:00:00.000Z');
const command=(status,dispatchedAgo,expiresIn)=>({
 status,dispatched_at:dispatchedAgo===null?null:new Date(now-dispatchedAgo).toISOString(),
 expires_at:new Date(now+expiresIn).toISOString()
});
test('queued commands are dispatchable only before their expiry',()=>{
 assert.equal(dispatchableNetworkCommand(command('queued',null,60000),now),true);
 assert.equal(dispatchableNetworkCommand(command('queued',null,0),now),false);
 assert.equal(dispatchableNetworkCommand(command('queued',null,-1),now),false);
});
test('dispatched commands become retryable at exactly 90 seconds',()=>{
 assert.equal(dispatchableNetworkCommand(command('dispatched',89999,60000),now),false);
 assert.equal(dispatchableNetworkCommand(command('dispatched',90000,60000),now),true);
 assert.equal(dispatchableNetworkCommand(command('dispatched',90001,60000),now),true);
});
test('expired commands cannot be resurrected by a late acknowledgement timeout',()=>{
 assert.equal(dispatchableNetworkCommand(command('dispatched',180000,-1),now),false);
 assert.equal(dispatchableNetworkCommand({...command('dispatched',180000,30000),dispatched_at:null},now),false);
 assert.equal(dispatchableNetworkCommand({...command('dispatched',180000,30000),dispatched_at:'bad'},now),false);
});
test('terminal status and malformed timestamps never become dispatchable',()=>{
 for(const status of ['success','failed','cancelled','unknown'])
  assert.equal(dispatchableNetworkCommand(command(status,180000,60000),now),false);
 assert.equal(dispatchableNetworkCommand({status:'queued',expires_at:'bad',dispatched_at:null},now),false);
});
