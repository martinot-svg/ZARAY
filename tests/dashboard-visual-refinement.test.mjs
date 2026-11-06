import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const dashboard=read('src/components/dashboard-workspace.tsx');
const css=read('src/app/zaray-dashboard-refinement.css');
const layout=read('src/app/layout.tsx');

test('dashboard refinement is limited to its own CSS and loaded after existing design layers',()=>{
 assert.ok(layout.indexOf("import './zaray-dashboard-refinement.css'")>
   layout.indexOf("import './zaray-module-consistency.css'"));
 assert.match(dashboard,/data-zaray-dashboard/);
 assert.match(css,/\.app-no-sidebar \.dashboard-surface/);
 assert.doesNotMatch(css,/\.landing\b|\.personal-home-shell|body\s*\{|\.receipt-preview/);
});

test('existing real KPIs, site scope and finance links remain intact',()=>{
 assert.match(dashboard,/metrics:values,recentOrders/);
 assert.match(dashboard,/values\[key\]===null/);
 assert.match(dashboard,/toLocaleString\('fr-FR'\)/);
 assert.match(dashboard,/site\?\.id/);
 assert.match(dashboard,/new URLSearchParams\(\{companyId:company\.id\}\)/);
 assert.match(dashboard,/className="kpi-grid dashboard-metrics-grid"/);
 assert.match(dashboard,/className="module-grid dashboard-operations-grid"/);
 for(const route of ['/clients','/commandes','/paiements/verification','/tickets','/caisse','/offres','/sites'])
   assert.ok(dashboard.includes("contextual('"+route+"')"),route);
 assert.match(dashboard,/recentOrders\.map/);
 assert.match(dashboard,/sites\.map/);
 assert.match(dashboard,/href=\{companyLink\}/);
});

test('clear context once, eliminate repeated KPI explanations and site icons',()=>{
 assert.match(dashboard,/aria-label="Périmètre du tableau de bord"/);
 assert.match(dashboard,/site\?site\.name:company\.legal_name/);
 assert.doesNotMatch(dashboard,/kpi-note|label\.toUpperCase\(\)/);
 assert.match(dashboard,/<strong>\{s\.name\}<\/strong>/);
 assert.doesNotMatch(dashboard,/<strong><ZarayIcon name="site"/);
});

test('accessible and responsive style preserves all touch actions and reduced motion',()=>{
 assert.match(dashboard,/<nav className="quick-grid dashboard-quick-links" aria-label="Accès rapide aux opérations">/);
 assert.match(dashboard,/<h2 className="panel-title">Activité récente<\/h2>/);
 assert.match(dashboard,/dashboard-site-link/);
 assert.match(css,/@media\(min-width:801px\) and \(max-width:1199px\)/);
 assert.match(css,/@media\(max-width:800px\)/);
 assert.match(css,/@media\(max-width:380px\)/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(css,/min-height:48px/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media print/);
 assert.match(css,/var\(--zf-panel\)/);
 assert.match(css,/var\(--zf-border\)/);
});
