import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bridge=read('src/components/seamless-navigation.tsx');
const layout=read('src/app/layout.tsx');
const css=read('src/app/seamless-navigation.css');
const directory=read('src/lib/workspace-directory-request.ts');
const sites=read('src/app/sites/page.tsx');
const tickets=read('src/app/tickets/page.tsx');

test('internal anchors use SPA router without intercepting downloads, Next Link or modified clicks',()=>{
 assert.match(layout,/\<SeamlessNavigation \/\>/);
 assert.match(bridge,/document\.addEventListener\('click',click\)/);
 assert.match(bridge,/event\.defaultPrevented/);
 for(const name of ['event.metaKey','event.ctrlKey','event.altKey','event.shiftKey'])
  assert.ok(bridge.includes(name),name);
 assert.match(bridge,/anchor\.hasAttribute\('download'\)/);
 assert.match(bridge,/url\.origin!==window\.location\.origin/);
 assert.match(bridge,/router\.push\(destination\.href/);
 assert.match(bridge,/router\.prefetch\(target\.href\)/);
 assert.match(bridge,/document\.removeEventListener\('click',click\)/);
 assert.doesNotMatch(bridge,/window\.location\.(?:assign|replace|href\s*=)/);
});

test('tenant directory data is session-bound, memory-only and short-lived',()=>{
 assert.match(directory,/MAX_AGE_MS=6000/);
 assert.match(directory,/data\.session\?\.user\.id/);
 assert.match(directory,/user!==currentUser/);
 assert.match(directory,/inFlight: Promise<Response> \| null/);
 assert.match(directory,/response\.clone\(\)/);
 assert.match(directory,/snapshot\.expires>Date\.now\(\)/);
 assert.match(directory,/event.*SIGNED_OUT/);
 assert.match(directory,/cache:'no-store'/);
 assert.match(directory,/invalidateWorkspaceDirectory/);
 assert.doesNotMatch(directory,/localStorage|sessionStorage|setTimeout/);
});

test('direct /sites navigation finds an authorized company, without false empty-state stats',async()=>{
 const source=read('src/lib/workspace-url.ts');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(js));
 const old=globalThis.window;
 try{
  globalThis.window={location:{search:''}};
  assert.equal(mod.selectedCompany([{id:'company-1'},{id:'company-2'}],[]),'company-1');
  globalThis.window.location.search='?companyId=company-2';
  assert.equal(mod.selectedCompany([{id:'company-1'},{id:'company-2'}],[]),'company-2');
  globalThis.window.location.search='?companyId=other';
  assert.throws(()=>mod.selectedCompany([{id:'company-1'}],[]),/Entreprise inaccessible/);
  globalThis.window.location.search='?siteId=site-1';
  assert.equal(mod.selectedCompany([{id:'company-1'}],[{id:'site-1',company_id:'company-1'}]),'company-1');
 }finally{globalThis.window=old;}
 assert.match(sites,/selectedCompany\(accessible,available\)/);
 assert.match(sites,/busy\?'…':filtered\.length/);
 assert.match(sites,/ModuleDataState label="Préparation du répertoire des sites/);
 assert.doesNotMatch(sites,/router\.replace\('\/entreprises'\)/);
});

test('no root loading overlay and short motion only on content sections',()=>{
 assert.match(css,/\.app-no-sidebar \.app-content/);
 assert.match(css,/animation:none!important/);
 assert.match(css,/@keyframes zaray-section-place/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(layout,/seamless-navigation\.css/);
 for(const path of [
  'src/app/clients/page.tsx','src/app/offres/page.tsx',
  'src/app/portail/page.tsx','src/app/membres/page.tsx',
  'src/app/notifications/page.tsx','src/app/commandes/page.tsx',
  'src/app/abonnements/page.tsx','src/app/tickets/page.tsx'
 ])assert.match(read(path),/ModuleDataState/,path);
 assert.match(tickets,/const companyId=selectedCompany\(data\.companies/);
 assert.doesNotMatch(tickets,/window\.location\.replace/);
});
