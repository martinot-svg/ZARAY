import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchableNetworkCommand,dispatchableDiagnosticJob} from '../src/lib/network-command-lease.ts';
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

const diagnostic=(status,requestedAgo,dispatchedAgo)=>({
 status,requested_at:new Date(now-requestedAgo).toISOString(),
 dispatched_at:dispatchedAgo===null?null:new Date(now-dispatchedAgo).toISOString()
});
test('queued diagnostics expire after ten minutes even if the connector was offline',()=>{
 assert.equal(dispatchableDiagnosticJob(diagnostic('queued',0,null),now),true);
 assert.equal(dispatchableDiagnosticJob(diagnostic('queued',599999,null),now),true);
 assert.equal(dispatchableDiagnosticJob(diagnostic('queued',600000,null),now),false);
 assert.equal(dispatchableDiagnosticJob(diagnostic('queued',-1000,null),now),false);
});
test('diagnostic retries require an exact 90-second lease and a sane timestamp',()=>{
 assert.equal(dispatchableDiagnosticJob(diagnostic('dispatched',180000,89999),now),false);
 assert.equal(dispatchableDiagnosticJob(diagnostic('dispatched',180000,90000),now),true);
 assert.equal(dispatchableDiagnosticJob(diagnostic('dispatched',180000,90001),now),true);
 assert.equal(dispatchableDiagnosticJob(diagnostic('dispatched',180000,null),now),false);
 assert.equal(dispatchableDiagnosticJob(diagnostic('dispatched',180000,180001),now),false);
 assert.equal(dispatchableDiagnosticJob(diagnostic('dispatched',180000,-1),now),false);
});
test('diagnostic acknowledgements cannot resurrect expired or terminal jobs',()=>{
 for(const status of ['success','failed','expired','cancelled'])
  assert.equal(dispatchableDiagnosticJob(diagnostic(status,200000,100000),now),false);
 assert.equal(dispatchableDiagnosticJob(diagnostic('dispatched',600000,100000),now),false);
 assert.equal(dispatchableDiagnosticJob({...diagnostic('dispatched',200000,100000),dispatched_at:'bad'},now),false);
 assert.equal(dispatchableDiagnosticJob({...diagnostic('queued',200000,null),requested_at:'bad'},now),false);
});
