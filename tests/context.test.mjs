import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('src/lib/workspace-url.ts');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function scope(search){
 const target={};
 const browser={location:{search,assign(url){target.url=url;},replace(url){target.url=url;}}};
 const exports={};
 runInNewContext(compiled,{exports,window:browser,URLSearchParams,encodeURIComponent});
 return {api:exports,target,browser};
}
const companies=[{id:'a'},{id:'b'}];
const sites=[{id:'a1',company_id:'a'},{id:'b1',company_id:'b'}];

test('a legacy company route without a selection redirects to Mes entreprises',()=>{
 const {api,target}=scope('');
 assert.equal(api.selectedCompany(companies,sites),'');
 assert.equal(target.url,'/entreprises');
});
test('explicit company selection is honored',()=>{
 const {api}=scope('?companyId=b');
 assert.equal(api.selectedCompany(companies,sites),'b');
});
test('unknown company identifiers fail closed',()=>{
 const {api}=scope('?companyId=x');
 assert.throws(()=>api.selectedCompany(companies,sites),/Entreprise inaccessible/);
});
test('site must belong to selected company',()=>{
 const {api}=scope('?companyId=b&siteId=a1');
 assert.throws(()=>api.selectedCompany(companies,sites),/Site inaccessible/);
});
test('switching company clears site context',()=>{
 const {api,target}=scope('?companyId=a&siteId=a1');
 api.switchCompany('/tableau-de-bord','b');
 assert.equal(target.url,'/tableau-de-bord?companyId=b');
});
test('site-aware links preserve both tenant and site',()=>{
 const {api}=scope('?companyId=a&siteId=a1');
 const p=new URLSearchParams(api.scopedQuery('a'));
 assert.equal(p.get('companyId'),'a');
 assert.equal(p.get('siteId'),'a1');
});
test('no site scoped metrics derived from company-global offers',()=>{
 const api=read('src/app/api/dashboard/route.ts');
 assert.match(api,/table === 'offers'\) return null/);
 assert.match(api,/authorizeTenant/);
 assert.match(api,/subscription_orders\.site_id/);
 assert.match(api,/count:'exact'/);
});
test('all high-volume operational reads validate tenant context',()=>{
 for (const path of ['customers','subscription-orders','payments','wifi-tickets','caisse','offers']){
  const code=read('src/app/api/'+path+'/route.ts');
  assert.match(code,/authorizeTenant\(supabase,companyId,siteId\)/,path);
 }
});
