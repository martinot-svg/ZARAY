import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('the official ZARAY colors remain identical to the SVG assets', () => {
  const css = read('src/app/zaray-ui-contract.css');
  const dark = read('public/brand/zaray-logo.svg');
  const light = read('public/brand/zaray-logo-on-light.svg');
  assert.match(css, /--zaray-brand-green:\s*#21f728/i);
  assert.match(css, /--zaray-brand-black:\s*#111914/i);
  assert.match(dark, /fill="#21f728"/);
  assert.match(light, /fill="#21f728"/);
  assert.match(light, /fill="#111914"/);
});
test('shared contract is loaded after the existing theme and galactic styles', () => {
  const layout = read('src/app/layout.tsx');
  assert.ok(layout.indexOf("import './zaray-ui-contract.css'") > layout.indexOf("import './galactic-system.css'"));
});
test('UI contract retains accessibility and readable financial data', () => {
  const css = read('src/app/zaray-ui-contract.css');
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /min-height:\s*44px/);
});
