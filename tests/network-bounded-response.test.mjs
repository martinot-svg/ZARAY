import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAX_CONNECTOR_RESPONSE_BYTES,readBoundedResponseText}
 from '../network-connector/routeros/bounded-response.mjs';

test('bounded HTTP parser decodes UTF-8 across separate chunks',async()=>{
 const bytes=new TextEncoder().encode('Routeur connecté — réseau');
 const chunks=[bytes.slice(0,20),bytes.slice(20,24),bytes.slice(24)];
 const body=new ReadableStream({start(controller){
  for(const chunk of chunks)controller.enqueue(chunk);
  controller.close();
 }});
 assert.equal(await readBoundedResponseText(new Response(body)),'Routeur connecté — réseau');
});
test('overstated Content-Length rejects before consuming the stream',async()=>{
 let consumed=false;
 const stream=new ReadableStream({pull(controller){consumed=true;controller.enqueue(new Uint8Array(1));controller.close();}});
 const response=new Response(stream,{headers:{'Content-Length':String(MAX_CONNECTOR_RESPONSE_BYTES+1)}});
 await assert.rejects(()=>readBoundedResponseText(response),/exceeds the safe size limit/);
 assert.equal(consumed,false);
});
test('chunked responses are stopped at the byte limit',async()=>{
 const chunk=new Uint8Array(768);
 const stream=new ReadableStream({start(c){c.enqueue(chunk);c.enqueue(chunk);c.close();}});
 await assert.rejects(()=>readBoundedResponseText(new Response(stream),{maxBytes:1024}),/exceeds the safe size limit/);
});
test('empty bodies and interrupted transport failures are not presented as data',async()=>{
 const response=new Response(null,{status:204});
 assert.equal(await readBoundedResponseText(response),'');
 const stream=new ReadableStream({start(c){c.error(new Error('connection terminated'));}});
 await assert.rejects(()=>readBoundedResponseText(new Response(stream)),/connection terminated/);
});
test('size guard cannot be disabled via an oversized limit',async()=>{
 await assert.rejects(
  ()=>readBoundedResponseText(new Response('ok'),{maxBytes:MAX_CONNECTOR_RESPONSE_BYTES+1}),
  /Invalid RouterOS response size limit/
 );
});
test('production connector parses bounded responses, not unbounded response.text()',()=>{
 const connector=readFileSync('network-connector/agent.mjs','utf8');
 assert.ok(connector.includes('readBoundedResponseText(r)'));
 assert.ok(!connector.includes('await r.text()'));
});
