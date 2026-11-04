import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const source=readFileSync('src/lib/network-voucher-secret.ts','utf8').replace("import 'server-only';",'');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function api(env){
 const sandbox={exports:{},require:createRequire(import.meta.url),Buffer,process:{env}};
 runInNewContext(js,sandbox);
 return sandbox.exports;
}
const legacy='ab'.repeat(32), modern='ef'.repeat(32);
test('new key never silently replaces the historical key',()=>{
 const a=api({ZARAY_WIFI_VOUCHER_HMAC_KEY:legacy,ZARAY_WIFI_VOUCHER_HMAC_KEY_V2:modern});
 const b=api({ZARAY_WIFI_VOUCHER_HMAC_KEY:legacy});
 const site='test-site',id='voucher-1234';
 assert.equal(a.deriveVoucherPassword(id,site,5,'hmac-numeric-v2',1),b.deriveVoucherPassword(id,site,5,'hmac-numeric-v2'));
 assert.notEqual(a.deriveVoucherPassword(id,site,5,'hmac-numeric-v2',1),a.deriveVoucherPassword(id,site,5,'hmac-numeric-v2',2));
 assert.throws(()=>b.deriveVoucherPassword(id,site,5,'hmac-numeric-v2',2));
 assert.throws(()=>a.deriveVoucherPassword(id,site,5,'hmac-numeric-v2',3));
});
test('new credential hashes are keyed and independent of legacy SHA256',()=>{
 const a=api({ZARAY_WIFI_VOUCHER_HMAC_KEY:legacy,ZARAY_WIFI_VOUCHER_HMAC_KEY_V2:modern});
 const site='s',user='u',pwd='01234';
 const weak=createHash('sha256').update(site+':'+user+':'+pwd).digest('hex');
 assert.equal(a.hashVoucherCredential(site,user,pwd,1),weak);
 assert.match(a.hashVoucherCredential(site,user,pwd,2),/^[a-f0-9]{64}$/);
 assert.notEqual(a.hashVoucherCredential(site,user,pwd,2),weak);
 assert.equal(a.hashVoucherCredential(site,user,pwd,2),a.hashVoucherCredential(site,user,pwd,2));
});
test('issuance, reprint and dispatch preserve the declared key version',()=>{
 const issue=readFileSync('src/app/api/wifi-vouchers/route.ts','utf8');
 const print=readFileSync('src/app/api/wifi-vouchers/batches/route.ts','utf8');
 const dispatch=readFileSync('src/app/api/network/agent/route.ts','utf8');
 const migration=readFileSync('supabase/migrations/20261104160000_wifi_voucher_key_versioning.sql','utf8');
 assert.match(issue,/key_version:2/);
 assert.match(issue,/hashVoucherCredential\(siteId,username,password,2\)/);
 assert.match(print,/n\.key_version as VoucherKeyVersion/);
 assert.match(dispatch,/net!\.key_version as VoucherKeyVersion/);
 assert.match(dispatch,/timingSafeEqual/);
 assert.match(migration,/default 1/);
 assert.doesNotMatch(migration,/update\s+public\.wifi_vouchers/i);
});
