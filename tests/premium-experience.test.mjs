import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const publicPage = read('src/app/page.tsx');
const stage = read('src/components/premium-experience.tsx');
const shell = read('src/components/app-shell.tsx');
const personal = read('src/components/personal-shell.tsx');
const layout = read('src/app/layout.tsx');
const theme = read('src/app/premium-foundation.css');
const theater = read('src/app/premium-experience.css');

test('premium design layers are registered without replacing the core application', () => {
  assert.match(layout, /import '\.\/globals\.css'/);
  assert.match(layout, /import '\.\/premium-foundation\.css'/);
  assert.match(layout, /import '\.\/premium-experience\.css'/);
  assert.match(publicPage, /<PremiumExperience \/>/);
  assert.match(publicPage, /THE FUTURE OF BUSINESS EXPERIENCE/);
});

test('public product tour has distinct desktop, tablet and mobile compositions', () => {
  for (const device of ['desktop', 'tablet', 'mobile']) {
    assert.match(stage, new RegExp("id: '" + device + "'"));
    assert.match(theater, new RegExp('\\.experience-device-' + device));
  }
  for (const scene of ['pilotage', 'clients', 'wifi', 'finance']) assert.match(stage, new RegExp("id: '" + scene + "'"));
  assert.match(stage, /aria-pressed=\{device === item\.id\}/);
  assert.match(stage, /aria-pressed=\{scene === item\.id\}/);
  assert.match(stage, /onClick=\{\(\) => setDevice\(item\.id\)\}/);
  assert.doesNotMatch(stage, /Math\.random|faker|succeeded payments|mockRevenue/i);
  assert.match(stage, /Aucun chiffre ni client fictif/);
});

test('tenant-safe mobile docks keep the existing auth and server context model', () => {
  assert.match(shell, /activeCompany && <nav className="workspace-mobile-dock"/);
  assert.match(shell, /encodeURIComponent\(activeCompany\)/);
  assert.match(shell, /encodeURIComponent\(activeSite\)/);
  assert.match(shell, /activePath === item\.href/);
  assert.match(personal, /<nav className="personal-mobile-dock"/);
  assert.match(personal, /aria-current=\{active === item\.href \? 'page'/);
  for (const rule of ['\.workspace-mobile-dock', '\.personal-mobile-dock', 'env(safe-area-inset-bottom']) {
    assert.ok(theater.includes(rule.replace('\\','')), rule);
  }
  assert.match(theater, /min-height:56px/);
});

test('motion remains progressive and all print surfaces are excluded', () => {
  assert.match(theater, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(theme, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(theme, /@media print/);
  assert.match(theme, /\.wifi-voucher-print-canvas/);
  assert.match(theater, /@media print\{\.experience-root\{display:none!important\}\}/);
  assert.doesNotMatch(stage, /fetch\(|supabase|service_role|localStorage/i);
});
