import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const read=(file)=>readFileSync(file,'utf8');
const source=read('src/lib/network-voucher-secret.ts').replace("import 'server-only';",'');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandbox={exports:{},require:createRequire(import.meta.url),Buffer,process:{env:{ZARAY_WIFI_VOUCHER_HMAC_KEY:'ab'.repeat(32)}}};
runInNewContext(js,sandbox);
const derive=sandbox.exports.deriveVoucherPassword;

test('new vouchers use numeric-only PINs with exact 3, 4 and 5-digit lengths',()=>{
 for(const length of [3,4,5]){
  for(let i=0;i<50;i++){
   const pin=derive('voucher-'+i,'site-id',length,'hmac-numeric-v2');
   assert.match(pin,/^[0-9]+$/);
   assert.equal(pin.length,length);
   assert.equal(derive('voucher-'+i,'site-id',length,'hmac-numeric-v2'),pin);
  }
 }
 assert.throws(()=>derive('voucher','site',6,'hmac-numeric-v2'));
 assert.throws(()=>derive('voucher','site',2,'hmac-numeric-v2'));
});
test('leading zeroes are preserved as characters',()=>{
 const pins=Array.from({length:100},(_,i)=>derive('voucher-leading-'+i,'site',5,'hmac-numeric-v2'));
 assert.ok(pins.some(pin=>pin.startsWith('0')),'A leading zero should be possible');
});
test('legacy alphanumeric vouchers still derive their previous passwords',()=>{
 for(const length of [3,5,12,32]){
  const previous=derive('legacy-voucher','site',length,'hmac-v1');
  assert.equal(previous.length,length);
  assert.match(previous,/^[A-Z0-9]+$/);
  assert.equal(derive('legacy-voucher','site',length),previous);
 }
});
test('generator and agent both select versioned credentials',()=>{
 const generator=read('src/app/api/wifi-vouchers/route.ts');
 const dispatcher=read('src/app/api/network/agent/route.ts');
 const connector=read('network-connector/agent.mjs');
 const schema=read('supabase/migrations/20261029143500_wifi_numeric_voucher_scheme_v2.sql');
 assert.match(generator,/deriveVoucherPassword\(id,siteId,passwordLength,'hmac-numeric-v2'\)/);
 assert.match(generator,/credential_scheme:'hmac-numeric-v2'/);
 assert.match(dispatcher,/net!\.credential_scheme as 'hmac-v1'\|'hmac-numeric-v2'/);
 assert.match(connector,/\^\[0-9\]\{3,5\}\$/);
 assert.match(schema,/hmac-v1','hmac-numeric-v2/);
});
