import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const css = source('src/app/globals.css');
const motion = source('src/components/motion.tsx');
const shell = source('src/components/app-shell.tsx');
const dashboard = source('src/components/dashboard-workspace.tsx');
const login = source('src/app/connexion/page.tsx');
const tickets = source('src/components/wifi-ticket-history.tsx');

test('ZARAY motion durations and easing are centralized', () => {
  for (const token of ['--motion-fast:120ms', '--motion-standard:180ms', '--motion-page:240ms', '--motion-curve:', '--motion-distance:8px']) {
    assert.ok(css.includes(token), token);
  }
});
test('Ten requested animation categories have implementation anchors', () => {
  for (const marker of ['zaray-fade-in', 'zaray-fade-out', 'app-nav.is-open', 'motion-stagger', 'zaray-page-in', 'zaray-ambient', 'motion-disclosure-content', 'motion-skeleton', 'focus-visible', ':active:not(:disabled)']) {
    assert.ok((css + motion).includes(marker), marker);
  }
  assert.ok(motion.includes('requestAnimationFrame'), 'count-up interpolates on frame boundaries');
  assert.ok(tickets.includes('MotionFeedback'), 'success and error states are wired');
});
test('Reduced motion disables animation; count-up respects preference', () => {
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.ok(css.includes('animation:none!important'));
  assert.ok(motion.includes("matchMedia('(prefers-reduced-motion: reduce)')"));
});
test('Mobile navigation and disclosure expose accessible controls', () => {
  assert.ok(shell.includes('aria-expanded={menuOpen}'));
  assert.ok(shell.includes('aria-controls="zaray-app-nav"'));
  assert.ok(shell.includes("event.key === 'Escape'"));
  assert.ok(motion.includes('aria-expanded={open}'));
  assert.ok(motion.includes('inert={!open}'));
});
test('Dashboard shows exact KPI values immediately without counting from zero', () => {
  assert.ok(dashboard.includes("values[key]!.toLocaleString('fr-FR')"));
  assert.ok(dashboard.includes('values[key]===null'));
  assert.doesNotMatch(dashboard,/MotionCount|motion-stagger/);
  assert.ok(motion.includes('aria-hidden="true"')); // Other modules may retain accessible count-up.
});
test('Background movement is limited to the existing login page', () => {
  assert.ok(login.includes('form-shell auth-motion'));
  assert.ok(css.includes('.auth-motion::before'));
});

test('Company and site dashboards use validated tenant context',()=>{const api=source('src/app/api/dashboard/route.ts');const auth=source('src/lib/tenant-context.ts');assert.ok(api.includes('authorizeTenant'));assert.ok(api.includes("count:'exact'"));assert.ok(api.includes("subscription_orders.site_id"));assert.ok(auth.includes(".eq('company_id',companyId)"));});


test('galaxy is a true continuously rendered GPU animation with independent living layers',()=>{
 const galaxy=source('src/components/galaxy-backdrop.tsx');
 for(const feature of [
  "getContext('webgl2'", "requestAnimationFrame(draw)", "gl.drawArrays(gl.TRIANGLES, 0, 3)",
  "float fbm(vec2 p)", "float stars(vec2 p", "float vaporA", "float vaporB",
  "float streamA", "float streamB", "float farDust", "float midStars",
  "float nearStars", "uniform float u_time", "uniform vec2 u_resolution",
 ]) assert.ok(galaxy.includes(feature), 'missing '+feature);
 assert.match(galaxy,/if \(!motionPreference\.matches\) \{/);
 assert.match(galaxy,/sharedGalaxyClock = elapsed/);
 assert.match(galaxy,/let elapsed = sharedGalaxyClock/);
 assert.match(galaxy,/mobile\.matches \? 42 : 60/);
 assert.match(galaxy,/slowFrames > 90/);
 assert.match(galaxy,/Math\.sqrt\(maxPixels \/ \(width \* height\)\)/);
 assert.doesNotMatch(galaxy,/setInterval\(|setTimeout\(|Math\.random\(/);
});
test('galaxy pauses responsibly, cleans up GPU resources and respects reduced motion',()=>{
 const galaxy=source('src/components/galaxy-backdrop.tsx');
 assert.match(galaxy,/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
 assert.match(galaxy,/document\.hidden/);
 assert.match(galaxy,/document\.addEventListener\('visibilitychange', visibility\)/);
 assert.match(galaxy,/document\.removeEventListener\('visibilitychange', visibility\)/);
 assert.match(galaxy,/webglcontextlost/);
 assert.match(galaxy,/webglcontextrestored/);
 assert.match(galaxy,/cancelAnimationFrame\(frame\)/);
 assert.match(galaxy,/gl\.deleteProgram\(program\)/);
 assert.match(galaxy,/gl\.deleteVertexArray\(vao\)/);
 assert.match(galaxy,/motionPreference\.removeEventListener\('change', preferenceChanged\)/);
 assert.match(galaxy,/return <div className="zaray-galaxy-backdrop" aria-hidden="true">/);
 assert.match(css,/\.zaray-galaxy-backdrop\{/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
