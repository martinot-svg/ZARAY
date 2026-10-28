import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const css = read('src/app/zaray-total-redesign.css');
const layout = read('src/app/layout.tsx');
const theme = read('src/components/theme-switch.tsx');
const app = read('src/components/app-shell.tsx');
const personal = read('src/components/personal-shell.tsx');
const home = read('src/app/mon-compte/page.tsx');
const landing = read('src/app/page.tsx');
const ticket = read('src/app/tickets/page.tsx');

test('refonte is really loaded after all older styles, not a standalone concept', () => {
  const files = ['globals.css','premium-foundation.css','premium-experience.css','zaray-total-redesign.css'];
  let previous = -1;
  for (const file of files) {
    const current = layout.indexOf("import './" + file + "'");
    assert.ok(current > previous, file + ' must load after prior theme');
    previous = current;
  }
  assert.ok(layout.includes('data-zaray-theme="dark"'));
  assert.ok(landing.includes('<PremiumExperience />'));
});

test('a real toggle is available in the public, personal and company headers', () => {
  assert.ok(theme.includes("window.localStorage.setItem(KEY, next)"));
  assert.ok(theme.includes("document.documentElement.setAttribute('data-zaray-theme', next)"));
  for (const source of [app, personal, landing]) assert.ok(source.includes('<ThemeSwitch />'));
  assert.ok(css.includes('[data-zaray-theme="light"]'));
  assert.ok(css.includes('[data-zaray-theme="dark"]'));
});

test('new visual language extends to all shared primitives, not only landing', () => {
  for (const selector of ['.app-no-sidebar .page-header','.app-no-sidebar .kpi-grid',
    '.app-no-sidebar .data-table td','.app-no-sidebar .module-grid',
    '.app-no-sidebar .quick-action','.personal-no-sidebar.personal-home-shell .personal-home-stage',
    '.personal-no-sidebar .personal-business-card','.form-shell .form-card']) {
    assert.ok(css.includes(selector), selector);
  }
  assert.ok(css.includes('linear-gradient('));
  assert.ok(css.includes('radial-gradient('));
  assert.ok(css.includes('--zf-border'));
  assert.ok(css.includes('--zf-mint'));
  assert.ok(css.includes('--zf-heading'));
});

test('mobile, tablet, desktop, reduced motion and printable output are all addressed', () => {
  for (const marker of ['@media(max-width:700px)','@media(min-width:701px) and (max-width:1299px)',
    '@media(min-width:1300px)','@media(prefers-reduced-motion:reduce)','@media print']) {
    assert.ok(css.includes(marker), marker);
  }
  for (const marker of ['.wifi-voucher-print-canvas','.zaray-voucher-print-canvas',
    '.receipt-preview','.workspace-mobile-dock','.personal-mobile-dock']) {
    assert.ok(css.includes(marker) || read('src/app/premium-experience.css').includes(marker), marker);
  }
  assert.ok(home.includes('<DailyInspiration />'));
  assert.ok(!home.includes('personal-home-commandline'));
  assert.ok(!home.includes('personal-command-card'));
  assert.ok(css.includes('text-align:justify!important'));
  assert.ok(css.includes('.personal-home-quote-footer'));
  assert.ok(ticket.includes("type Tab = 'generate' | 'history' | 'customize'"));
  assert.ok(app.includes('encodeURIComponent(activeCompany)'));
  assert.ok(!theme.includes('supabase'));
});

test('personal welcome remains centered while daily quote attribution and source retain separate alignment', () => {
  const daily = read('src/components/daily-inspiration.tsx');
  assert.ok(home.includes('personal-welcome-title'));
  assert.ok(home.includes('companyForInvitations'));
  assert.ok(personal.includes("href: '/entreprises'"));
  assert.ok(personal.includes("href: '/finance-globale'"));
  assert.ok(personal.includes('Z’Alliance'));
  assert.ok(daily.includes('className="personal-home-quote-author"'));
  assert.ok(daily.includes('className="personal-home-quote-footer"'));
  assert.ok(daily.includes('Consulter le recueil'));
  assert.ok(daily.includes('daily.quote.sourceTitle'));
  assert.ok(css.includes('text-align:right!important'));
  assert.ok(css.includes('text-align:center!important'));
});
