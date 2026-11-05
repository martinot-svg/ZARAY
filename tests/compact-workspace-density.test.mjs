import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const styles = read('src/app/zaray-compact-workspace.css');

test('compact workspace styles override older layouts without changing branding or business code', () => {
  const layout = read('src/app/layout.tsx');
  assert.ok(layout.indexOf("import './zaray-compact-workspace.css'") > layout.indexOf("import './zaray-icon-topbar.css'"));
  assert.match(styles, /\.app-no-sidebar \.page-header\.studio-page-header/);
  assert.match(styles, /\.app-no-sidebar \.app-content \.panel/);
  assert.match(styles, /\.app-no-sidebar \.app-content \.kpi-grid \.kpi/);
  assert.match(styles, /\.app-no-sidebar \.app-content \.quick-action/);
  assert.match(styles, /\.app-no-sidebar \.app-content \.data-table :is\(th,td\)/);
  assert.doesNotMatch(styles,/\.landing\b|\.personal-home-shell(?!\))/);
});

test('dashboard shows denser real KPIs and two compact work panels without hiding functionality', () => {
  const dashboard=read('src/components/dashboard-workspace.tsx');
  assert.match(dashboard, /className="kpi-grid dashboard-metrics-grid"/);
  assert.match(dashboard, /className="module-grid dashboard-operations-grid"/);
  for (const action of ['/clients','/commandes','/paiements/verification','/tickets','/caisse','/offres'])
    assert.ok(dashboard.includes("contextual('"+action+"')"),action);
  assert.match(dashboard, /values\[key\]===null/);
  assert.match(dashboard, /recentOrders\.map/);
  assert.match(styles, /repeat\(6, minmax\(0,1fr\)\)/);
  assert.match(styles, /repeat\(2, minmax\(0,1fr\)\)/);
});

test('responsive density preserves two-column mobile metrics and accessible touch targets', () => {
  assert.match(styles, /@media \(max-width: 800px\)/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /@media \(max-width: 380px\)/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /min-height: 91px/);
  assert.match(styles, /:not\(\.personal-home-shell\)/);
  assert.match(styles, /@media print/);
  assert.match(styles, /receipt-preview/);
});
