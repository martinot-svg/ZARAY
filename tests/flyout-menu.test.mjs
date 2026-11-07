import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const shell = source('src/components/app-shell.tsx');
const css = source('src/app/zaray-flyout-navigation.css');
const layout = source('src/app/layout.tsx');

test('six accessible flyout rubrics preserve every operational ZARAY module', () => {
  for (const section of [
    'Pilotage', 'Clients & abonnements', 'Ventes & commandes',
    'Finances', 'Portail & réseau', 'Administration'
  ]) assert.ok(shell.includes("label: '" + section + "'"), section);
  for (const path of [
    '/tableau-de-bord', '/sites', '/clients', '/abonnements',
    '/offres', '/commandes', '/tickets', '/caisse',
    '/paiements/verification', '/parametres-paiement',
    '/parametres-paiement/fiveonepay', '/portail', '/gestion-reseau',
    '/membres', '/notifications'
  ]) assert.ok(shell.includes("href: '" + path + "'"), path);
  for (const path of ['site-dashboard', 'site-domain', 'site-notifications'])
    assert.ok(shell.includes("href: '" + path + "'"), path);
  assert.match(shell, /activeSite && operational\.includes\(href\)/);
  assert.match(shell, /encodeURIComponent\(activeCompany\)/);
});

test('flyout interaction supports mouse hover, touch click, escape and outside close', () => {
  assert.match(shell, /onMouseEnter=\{\(\) => \{ if \(hoverMenus\(\)\) setActiveFlyout\(index\)/);
  assert.match(shell, /onClick=\{\(\) => setActiveFlyout\(previous => previous === index \? null : index\)/);
  assert.match(shell, /aria-controls=\{'zaray-nav-flyout-' \+ index\} aria-expanded=\{activeFlyout === index\}/);
  assert.match(shell, /aria-hidden=\{activeFlyout !== index\} inert=\{activeFlyout !== index \|\| !menuOpen\}/);
  assert.match(shell, /event\.key === 'Escape'/);
  assert.match(shell, /document\.addEventListener\('pointerdown', closeOutside\)/);
  assert.match(shell, /menuButton\.current\?\.focus\(\)/);
  assert.match(shell, /<SignOutButton \/>/);
});

test('desktop curtain flyout, touch accordion and reduced motion all have responsive rules', () => {
  assert.match(layout, /import '\.\/zaray-flyout-navigation\.css'/);
  assert.match(css, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /right: calc\(100% - 2px\)/);
  assert.match(css, /clip-path: inset\(0 0 0 100% round 16px\)/);
  assert.match(css, /\.app-nav-flyout-panel\.is-open/);
  assert.match(css, /\(pointer: coarse\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /:focus-visible/);
});

test('redundant header actions move into the menu without removing site and notifications', () => {
  assert.doesNotMatch(shell, /className="topbar-icon-group topbar-theme-control"/);
  assert.match(shell, /<ThemeSwitch className="app-nav-theme-switch" \/>/);
  assert.match(shell, /className="app-site-container"/);
  assert.match(shell, /Centre de notifications/);
  assert.match(shell, /href="\/mon-compte"/);
  assert.match(shell, /Changer d’entreprise/);
});
