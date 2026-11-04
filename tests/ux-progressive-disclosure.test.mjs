import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const shell=read('src/components/app-shell.tsx');
test('module headers expose help on request instead of repeating lengthy descriptions',()=>{
 assert.match(shell,/className="workspace-help"/);
 assert.match(shell,/<summary>À propos du module<\/summary>/);
 assert.match(shell,/\{description\}/);
 assert.doesNotMatch(shell,/ZARAY EXPERIENCE · 2026/);
});
test('network cockpit shows router management first and preserves secondary operations',()=>{
 const s=read('src/app/gestion-reseau/page.tsx');
 for(const name of ['Cartographie et préparation','Sessions et appareils','Associer un abonnement',
  'Règles des impayés','Comptes et suspensions','Historique des commandes'])
  assert.ok(s.includes('<summary>'+name+'</summary>'),name);
 for(const action of ['/api/network','/api/network/access','/api/network/pair','/api/network/device-action'])
  assert.ok(s.includes(action),action);
});
test('creation forms are expandable and existing business actions remain callable',()=>{
 for(const [file,id,method] of [
 ['src/app/sites/page.tsx','site-form','onSubmit={create}'],
 ['src/app/offres/page.tsx','offer-form','onSubmit={save}']
 ]){
  const s=read(file);
  assert.match(s,new RegExp('className="workspace-disclosure workspace-form-disclosure" id="'+id+'"'));
  assert.ok(s.includes(method));
  assert.ok(s.includes('el.open=true'));
 }
 assert.match(read('src/app/clients/page.tsx'),/Origine des clients/);
});
test('sensitive finance actions remain outside optional transaction metadata',()=>{
 const s=read('src/app/paiements/verification/page.tsx');
 assert.match(s,/<summary>Informations de transaction<\/summary>/);
 assert.match(s,/review\(item,'approve'\)/);
 assert.match(s,/review\(item,'reject'\)/);
 assert.match(s,/item.proofUrl/);
 assert.match(read('src/app/parametres-paiement/page.tsx'),/<summary>Configurer \{provider.label\}<\/summary>/);
});
test('ticket printing, Hotspot identity and advanced options survive decluttering',()=>{
 const e=read('src/components/wifi-ticket-customization.tsx');
 for(const title of ['Effets et typographie','Options et codes d’accès','Aperçu et installation du portail captif'])
  assert.ok(e.includes(title),title);
 for(const original of ['Enregistrer comme modèle','Télécharger la page MikroTik','paletteFromLogo','logo_data_uri'])
  assert.ok(e.includes(original),original);
 const t=read('src/app/tickets/page.tsx');
 for(const tab of ['generate','sell','history','customize'])assert.ok(t.includes("'"+tab+"'"));
 assert.match(read('src/components/wifi-ticket-generator.tsx'),/Lots et stock/);
});
test('public Z’Accueil globe and satellites stay untouched',()=>{
 const layout=read('src/app/layout.tsx');
 assert.match(layout,/WorkspaceBackdrop/);
 assert.match(read('src/components/galaxy-backdrop.tsx'),/zaray-starfield/);
 assert.ok(read('src/components/starlink-satellites-3d.tsx').length>100);
 assert.ok(read('src/components/earth-satellites.tsx').length>100);
});
