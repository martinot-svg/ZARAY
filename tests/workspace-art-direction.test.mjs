import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(path,'utf8');
const shell=read('src/components/app-shell.tsx');
const css=read('src/app/zaray-total-redesign.css');
const studio=css.slice(css.indexOf('ZARAY / OPERATOR STUDIO'));
const home=read('src/app/mon-compte/page.tsx');
const layout=read('src/app/layout.tsx');
test('enterprise module chapters are contextual and individually art-directed',()=>{
 for(const route of ['/tableau-de-bord','/sites','/clients','/offres','/tickets','/gestion-reseau','/paiements/verification'])
  assert.ok(shell.includes("'"+route+"'"),route);
 assert.match(shell,/data-workspace-chapter=\{chapter.accent\}/);
 assert.match(shell,/data-workspace-path=\{activePath\}/);
 assert.match(shell,/studio-chapter-number/);
 assert.match(shell,/studio-page-header/);
 assert.match(shell,/Espace du site/);
 assert.doesNotMatch(shell,/ZARAY EXPERIENCE · 2026/);
});
test('task layouts differ for dashboards, tables, forms and tickets',()=>{
 for(const selector of ['.studio-page-grid','.studio-kicker','.app-no-sidebar .workspace-grid','.app-no-sidebar .kpi-grid','.app-no-sidebar .data-table','.app-no-sidebar .toolbar.panel'])
  assert.ok(studio.includes(selector),selector);
 assert.match(studio,/data-workspace-path="\/tickets"/);
 assert.match(studio,/data-workspace-path="\/gestion-reseau"/);
 assert.match(studio,/data-workspace-path="\/clients"/);
});
test('new composition is scoped to company workspaces and leaves Z’Accueil visual sources alone',()=>{
 assert.ok(studio.length>7000,'workspace editorial stylesheet exists');
 assert.match(studio,/\.app-no-sidebar \.page-header\.studio-page-header/);
 assert.doesNotMatch(studio,/\.personal-home-stage/);
 assert.doesNotMatch(studio,/\.earth-satellite/);
 assert.match(layout,/WorkspaceBackdrop/);
 assert.match(home,/PersonalShell/);
 const earth=read('src/components/earth-satellites.tsx');
 const starlink=read('src/components/starlink-satellites-3d.tsx');
 const galaxy=read('src/components/galaxy-backdrop.tsx');
 assert.ok(earth.length>100);
 assert.ok(starlink.length>100);
 assert.match(galaxy,/zaray-starfield/);
});
test('three screen widths, dark/light contrast and reduced-motion are addressed',()=>{
 assert.match(studio,/data-zaray-theme="light"/);
 assert.match(studio,/prefers-reduced-motion:reduce/);
 assert.match(studio,/min-width:701px/);
 assert.match(studio,/max-width:700px/);
 assert.match(studio,/min-width:1100px/);
});
