import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const style=read('src/app/form-proportions.css');
const layout=read('src/app/layout.tsx');
test('compact form CSS is loaded last after legacy and premium layers',()=>{
 const foundation=layout.indexOf("import './globals.css'");
 const premium=layout.indexOf("import './zaray-total-redesign.css'");
 const compact=layout.indexOf("import './form-proportions.css'");
 assert.ok(foundation>=0 && premium>foundation && compact>premium);
});
test('standalone, workspace, modal forms all have responsive natural height',()=>{
 for (const term of ['--zf-form-standalone-width:468px','--zf-form-workspace-width:440px',
    '.form-shell.auth-motion > .form-card','.workspace-grid > .panel:has(form)',
    ':is(dialog,[role="dialog"],.modal):has(form)','height:auto!important','overflow-y:auto',
    '@media(max-width:700px)','@media(min-width:701px) and (max-width:1099px)']){
    assert.ok(style.includes(term),term);
 }
 assert.match(style,/html:has\(\.form-shell\)\{[\s\S]*scrollbar-gutter:auto/);
 assert.doesNotMatch(style,/#(?:fff|ffffff)\s*!important\s*;\s*height:100vh/);
});
test('authentication, enterprise creation, forms retain existing business logic',()=>{
 for (const [path,marker] of [
  ['src/app/connexion/page.tsx','signInWithPassword'],
  ['src/app/inscription/page.tsx','verifyOtp'],
  ['src/app/entreprises/nouvelle/page.tsx',"/api/companies"],
  ['src/app/clients/page.tsx','form-stack'],
  ['src/app/offres/page.tsx','form-stack'],
  ['src/app/tickets/page.tsx','WifiTicketGenerator']
 ])assert.ok(read(path).includes(marker),path);
 assert.match(style,/@media print/);
});
