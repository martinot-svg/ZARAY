import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('enterprise toolbar keeps the logo, menu, alerts and site while moving secondary controls into the menu', () => {
  const shell = read('src/components/app-shell.tsx');
  const head = shell.slice(shell.indexOf('<header className="app-topbar zaray-icon-topbar">'), shell.indexOf('</header>'));
  const brand = head.indexOf('className="app-topbar-brand"');
  const actions = head.indexOf('className="app-topbar-links"');
  const menu = head.indexOf('className="app-menu-container"');
  const site = head.indexOf('className="app-site-container"');
  const notifications = head.indexOf('aria-label="Centre de notifications"');
  assert.ok(brand >= 0 && brand < actions && actions < menu && menu < notifications && notifications < site);
  assert.doesNotMatch(head, /className="topbar-icon-group topbar-theme-control"/);
  assert.doesNotMatch(head, /aria-label="Mon compte"/);
  assert.match(shell, /<ThemeSwitch className="app-nav-theme-switch" \/>/);
  assert.match(shell, /Changer d’entreprise/);
  assert.doesNotMatch(head,/className="workspace-context"/);
  assert.doesNotMatch(head,/<select\b/);
  assert.match(head,/aria-label="ZARAY · Espace personnel"/);
});
test('site picker remains fully functional and accessible without header text', () => {
  const shell = read('src/components/app-shell.tsx');
  assert.match(shell,/aria-controls="zaray-site-picker" aria-expanded=\{siteOpen\}/);
  assert.match(shell,/inert=\{!siteOpen\} aria-hidden=\{!siteOpen\}/);
  assert.match(shell,/onClick=\{\(\) => selectSite\(site.id\)\}/);
  assert.match(shell,/setSiteOpen\(false\)/);
  assert.match(shell,/router\.push\(next/);
  assert.match(shell,/setMenuOpen\(false\)/);
  assert.match(shell,/siteButton\.current\?\.focus\(\)/);
  assert.match(shell,/className="app-nav-current-context"/);
  assert.match(shell,/companies\.find\(c => c.id === activeCompany\)/);
  assert.match(shell,/sites\.filter\(s => s.company_id === activeCompany\)/);
});
test('the responsive toolbar never wraps, keeps readable menus and respects reduced motion', () => {
  const css=read('src/app/zaray-icon-topbar.css');
  const layout=read('src/app/layout.tsx');
  assert.match(layout,/import '\.\/zaray-icon-topbar\.css'/);
  assert.match(css,/flex-wrap: nowrap !important/);
  assert.match(css,/justify-content: flex-end/);
  assert.match(css,/\.app-site-dropdown\.is-open/);
  assert.match(css,/@media \(max-width: 700px\)/);
  assert.match(css,/position: fixed !important/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css,/\.topbar-icon-label/);
  assert.match(css,/\.zaray-theme-switch-label/);
});
