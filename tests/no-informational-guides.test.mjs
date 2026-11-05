import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('enterprise module names are beside the official topbar logo',()=>{
 const shell=read('src/components/app-shell.tsx');
 const head=shell.slice(shell.indexOf('<header className="app-topbar zaray-icon-topbar">'),shell.indexOf('</header>'));
 const brand=head.indexOf('className="app-topbar-brand"');
 const title=head.indexOf('className="app-topbar-title"');
 const buttons=head.indexOf('className="app-topbar-links"');
 assert.ok(brand>=0 && title>brand && buttons>title);
 assert.ok(shell.includes("activePath.startsWith('/sites/')"));
 assert.doesNotMatch(shell,/className="page-header studio-page-header"|À propos du module|className="workspace-help"/);
 assert.match(shell,/className="workspace-page-actions"/);
 const css=read('src/app/zaray-icon-topbar.css');
 assert.match(css,/\.app-topbar-title/);
 assert.match(css,/text-overflow: ellipsis/);
});
test('personal workspace module names are beside the logo, without changing ZAccueil',()=>{
 const shell=read('src/components/personal-shell.tsx');
 const head=shell.slice(shell.indexOf('<header className="personal-topbar">'),shell.indexOf('</header>'));
 assert.ok(head.indexOf('personal-topbar-module-title')>head.indexOf('className="personal-logo"'));
 assert.match(shell,/!home && personalModuleTitle/);
});
test('nonfunctional guides were deleted from JSX and obsolete rules removed',()=>{
 for(const [path,term] of [
  ['src/app/clients/page.tsx','Origine des clients'],
  ['src/app/portail/page.tsx','Fonctionnement du portail'],
  ['src/app/tickets/page.tsx','Impression des tickets'],
  ['src/app/paiements/page.tsx','Fonctionnement technique des paiements'],
  ['src/app/gestion-reseau/page.tsx','Préparer le premier MikroTik'],
  ['src/components/wifi-ticket-generator.tsx','Chaque ticket possède un identifiant unique'],
  ['src/components/dashboard-workspace.tsx','schéma actuel ne possède pas de relation offre'],
 ])assert.ok(!read(path).includes(term),path+' still includes an informational guide');
 for(const path of ['src/app/zaray-total-redesign.css','src/app/zaray-compact-workspace.css'])
  assert.doesNotMatch(read(path),/\.workspace-help/);
});
test('functional screens and critical payments and network data remain',()=>{
 const network=read('src/app/gestion-reseau/page.tsx');
 const tickets=read('src/app/tickets/page.tsx');
 const payments=read('src/app/paiement/[reference]/page.tsx');
 assert.match(network,/Code d’association à usage unique/);
 assert.match(network,/<summary>Cartographie<\/summary>/);
 assert.match(tickets,/WifiTicketGenerator/);
 assert.match(tickets,/WifiTicketCustomization/);
 assert.match(payments,/justificatif|preuve/);
});
