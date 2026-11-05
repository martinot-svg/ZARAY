import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('legacy authenticated admin modules use the same title-and-icon workspace shell',()=>{
 for(const [path,route,title] of [
  ['src/app/invitations/page.tsx','/invitations','Mes invitations'],
  ['src/app/autorisations-paiement/page.tsx','/autorisations-paiement','Autorisations des validateurs'],
  ['src/app/paiements/page.tsx','/paiements','Suivi des paiements'],
  ['src/app/entreprises/nouvelle/page.tsx','/entreprises/nouvelle','Enregistrer mon entreprise'],
 ]){
  const s=read(path);
  assert.match(s,new RegExp('<AppShell activePath="'+route.replaceAll('/','\\/')+'" title="'+title+'"'));
  assert.doesNotMatch(s,/<main className="form-shell"|className="workspace-brand"|<h1>/);
  assert.match(s,/className="panel global-workspace-module"/);
 }
});
test('enterprise and finance pages no longer repeat the topbar module heading',()=>{
 const personal=read('src/components/personal-shell.tsx');
 const enterprises=read('src/app/entreprises/page.tsx');
 const finance=read('src/app/finance-globale/page.tsx');
 const alliance=read('src/app/z-alliance/page.tsx');
 assert.match(personal,/personal-topbar-module-title/);
 assert.doesNotMatch(enterprises,/personal-page-heading personal-enterprises-heading/);
 assert.doesNotMatch(finance,/personal-finance-page-heading/);
 assert.match(alliance,/<PersonalShell active="\/z-alliance"/);
 assert.doesNotMatch(read('src/components/z-alliance-workspace.tsx'),/className="zalliance-info"/);
});
test('all newly unified admin modules keep operational controls and actual data',()=>{
 const authorization=read('src/app/autorisations-paiement/page.tsx');
 const invitations=read('src/app/invitations/page.tsx');
 const payments=read('src/app/paiements/page.tsx');
 const creation=read('src/app/entreprises/nouvelle/page.tsx');
 assert.match(authorization,/setAuthorization\(reviewer, e\.target\.checked\)/);
 assert.match(invitations,/accept\(inv\.id\)/);
 assert.match(payments,/provider_payment_id/);
 assert.match(creation,/onSubmit=\{submit\}/);
 assert.match(payments,/fetchWorkspaceDirectory\(\)/);
 assert.match(authorization,/fetchWorkspaceDirectory\(\)/);
});
test('shared density styles cover old pages without hiding descriptions',()=>{
 const css=read('src/app/zaray-compact-workspace.css');
 assert.match(css,/\.global-workspace-module/);
 assert.match(css,/min-height: 0 !important/);
 assert.doesNotMatch(css,/\.global-workspace-module\s*\{[^}]*display:\s*none/s);
});
