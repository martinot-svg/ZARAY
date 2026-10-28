import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url),'utf8');
const layout=read('src/app/layout.tsx');
const galaxy=read('src/components/galaxy-backdrop.tsx');
const mount=read('src/components/workspace-backdrop.tsx');
const theme=read('src/components/theme-switch.tsx');
const css=read('src/app/galactic-system.css');

test('all routes and future modules inherit exactly one persistent galaxy in root layout',()=>{
 assert.match(layout,/<WorkspaceBackdrop\s*\/>/);
 assert.match(mount,/return <GalaxyBackdrop\s*\/>;/);
 assert.doesNotMatch(mount,/usePathname|prefixes|return workspace\s*\?/);
 assert.match(layout,/import '\.\/galactic-system\.css'/);
 assert.ok(layout.indexOf("import './galactic-system.css'")>layout.indexOf("import './form-proportions.css'"));
 assert.match(galaxy,/className="zaray-galaxy-backdrop"/);
 assert.match(galaxy,/className="zaray-galaxy-canvas"/);
});

test('galactic visual styles are global yet keep legible cards/tables and existing pages',()=>{
 assert.match(css,/body > \.zaray-galaxy-backdrop\s*\{/);
 assert.match(css,/body > main,/);
 assert.match(css,/\.landing \.landing-section/);
 assert.match(css,/\.form-shell\s*\{/);
 assert.match(css,/\[data-zaray-theme="light"\] body > \.zaray-galaxy-backdrop/);
 assert.match(css,/\.zaray-galaxy-canvas/);
 assert.doesNotMatch(css,/\.form-card\s*\{|\.data-table\s*\{|\.kpi\s*\{/);
 assert.match(css,/@media print\s*\{/);
});

test('existing theme switch emits passive three-wave WiFi signals in both themes',()=>{
 assert.match(theme,/className="zaray-theme-radio-waves" aria-hidden="true"/);
 assert.equal((theme.match(/className="zaray-theme-radio-wave"\s*\/>/g)||[]).length,3);
 assert.match(theme,/aria-pressed=\{theme === 'light'\}/);
 assert.match(theme,/onClick=\{toggle\}/);
 assert.match(css,/pointer-events:none;/);
 assert.match(css,/@keyframes zaray-theme-signal/);
 assert.match(css,/\[data-zaray-theme="light"\]/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/animation:none!important/);
});

test('galaxy pauses on saveData and reduced motion, and keeps dynamic resolution bounds',()=>{
 assert.match(galaxy,/navigator as Navigator & \{ connection\?: \{ saveData\?: boolean \} \}/);
 assert.match(galaxy,/mobile\.matches \? 24/);
 assert.match(galaxy,/!motionPreference\.matches && !dataSaver/);
 assert.match(galaxy,/maxPixels\s*=\s*mobile\.matches/);
 assert.match(galaxy,/document\.hidden/);
 assert.match(galaxy,/visibilitychange/);
 assert.match(galaxy,/webglcontextlost/);
});
