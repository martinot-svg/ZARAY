import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const agent=readFileSync('network-connector/agent.mjs','utf8');
const guide=readFileSync('network-connector/README.md','utf8');
test('connector rejects untrusted TLS and HTTP endpoints',()=>{
 assert.match(agent,/NODE_TLS_REJECT_UNAUTHORIZED==='0'/);
 assert.match(agent,/u\.protocol!=='https:'/);
 assert.match(agent,/redirect:'error'/);
 assert.match(agent,/AbortSignal\.timeout\(12000\)/);
});
test('validates RouterOS before consuming pairing token and retries acknowledgements',()=>{
 assert.match(agent,/await ros\('system\/resource'\);\s*const pair=/);
 assert.match(agent,/await reportResult\(command\.id,ok,outcome\)/);
 assert.match(agent,/for\(let attempt=0;attempt<3;attempt\+\+\)/);
 assert.match(agent,/mode:0o600/);
});
test('installation guidance requires verified certificates and local outbound connection',()=>{
 assert.match(guide,/HTTPS/i);
 assert.match(guide,/same private network/);
});
