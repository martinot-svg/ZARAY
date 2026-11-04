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
 assert.match(galaxy,/className="zaray-starfield"/);
 assert.match(galaxy,/RadioWaveCanvas/);
});

test('galactic visual styles are global yet keep legible cards/tables and existing pages',()=>{
 assert.match(css,/body > \.zaray-galaxy-backdrop\s*\{/);
 assert.match(css,/body > main,/);
 assert.match(css,/\.landing \.landing-section/);
 assert.match(css,/\.form-shell\s*\{/);
 assert.match(css,/\[data-zaray-theme="light"\] body > \.zaray-galaxy-backdrop/);
 assert.match(css,/\.zaray-original-backdrop \.zaray-starfield/);
 assert.match(css,/\.zaray-original-backdrop \.zaray-wifi-wave-canvas/);
 assert.doesNotMatch(css,/\.form-card\s*\{|\.data-table\s*\{|\.kpi\s*\{/);
 assert.match(css,/@media print\s*\{/);
});

test('theme switch remains accessible while decorative waveforms are rendered separately',()=>{
 const wave=read('src/components/radio-wave-canvas.tsx');
 assert.match(theme,/className="zaray-theme-icon"/);
 assert.match(theme,/aria-pressed=\{theme === 'light'\}/);
 assert.match(theme,/onClick=\{toggle\}/);
 assert.match(theme,/window\.localStorage\.setItem\(KEY, next\)/);
 assert.match(wave,/\.zaray-theme-switch \.zaray-theme-icon/);
 assert.match(css,/\.zaray-original-backdrop \.zaray-wifi-wavefield/);
 assert.match(css,/pointer-events: none/);
 assert.match(css,/prefers-reduced-motion: reduce/);
});
test('starfield and canvas respect accessibility, visibility and device limits',()=>{
 const wave=read('src/components/radio-wave-canvas.tsx');
 assert.match(galaxy,/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
 assert.match(galaxy,/!reducedMotion && meteors\.map/);
 assert.match(wave,/document\.hidden/);
 assert.match(wave,/visibilitychange/);
 assert.match(wave,/Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
 assert.match(wave,/window\.cancelAnimationFrame\(frame\)/);
 assert.match(css,/\.zaray-original-backdrop \.zaray-shooting-star/);
 assert.match(css,/@keyframes zaray-twinkle-drift/);
 assert.match(css,/@media print/);
 assert.match(css,/pointer-events:none/);
});

