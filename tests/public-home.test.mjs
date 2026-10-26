import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('public home starts with sign-in and sign-up, never sends visitors to the dashboard',()=>{
 const home=read('src/app/page.tsx');
 assert.match(home,/href="\/connexion"/);
 assert.match(home,/href="\/inscription"/);
 assert.match(home,/Se connecter/);
 assert.match(home,/Créer un compte/);
 assert.doesNotMatch(home,/Ouvrir le tableau de bord|href="\/tableau-de-bord"|href:\s*'\/tableau-de-bord'/);
});
test('public page contains structured, factual, user-oriented SaaS content',()=>{
 const home=read('src/app/page.tsx');
 for(const anchor of ['id="fonctionnalites"','id="fonctionnement"','id="avantages"','landing-final','landing-footer','aria-label="Navigation publique"'])assert.ok(home.includes(anchor),anchor);
 for(const feature of ['Entreprises et sites','Gestion des clients','Offres Internet','Commandes','Tickets Wi-Fi','Paiements','Tableaux de bord'])assert.ok(home.includes(feature),feature);
 assert.match(home,/configuration effective des équipements/);
 assert.doesNotMatch(home,/1 248|12 450 000|faker|Math\.random|entreprise de démonstration/i);
});
test('all identified company and site modules provide real route loading fallbacks',()=>{
 const modules=[
  'sites','sites/[siteId]','clients','offres','commandes','tickets','paiements',
  'paiements/verification','parametres-paiement','autorisations-paiement',
  'portail','membres','caisse','tableau-de-bord','invitations','entreprises/nouvelle'
 ];
 const component=read('src/components/module-loading.tsx');
 for(const module of modules){
  const path='src/app/'+module+'/loading.tsx';
  assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
  assert.match(read(path),/ModuleLoading/);
 }
 assert.match(component,/aria-busy="true"/);
 assert.match(component,/aria-hidden="true"/);
 assert.match(component,/Récupération des informations autorisées/);
 assert.doesNotMatch(component,/setTimeout|Math\.random|faker/);
});
test('loading transitions are reduced-motion friendly and errors offer a real retry action',()=>{
 const css=read('src/app/globals.css');
 const err=read('src/app/error.tsx');
 assert.match(css,/\.module-loading-screen/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.landing-hero-grid/);
 assert.match(css,/\.landing-feature-grid/);
 assert.match(err,/onClick=\{\(\) => reset\(\)\}/);
});

test('module navigation uses Next.js links so route skeletons work during transitions',()=>{
 const shell=read('src/components/app-shell.tsx');
 const personal=read('src/components/personal-shell.tsx');
 assert.match(shell,/import Link from 'next\/link'/);
 assert.match(shell,/<Link key=\{href\}/);
 assert.match(shell,/prefetch=\{false\}/);
 assert.match(personal,/import Link from 'next\/link'/);
 assert.match(personal,/<Link key=\{link\.href\}/);
});
