import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const css = source('src/app/globals.css');
const motion = source('src/components/motion.tsx');
const shell = source('src/components/app-shell.tsx');
const dashboard = source('src/components/dashboard-workspace.tsx');
const login = source('src/app/connexion/page.tsx');
const oldTickets = source('src/components/wifi-ticket-history-legacy.tsx');
const currentTickets = source('src/components/wifi-voucher-sales.tsx');

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
  assert.ok(oldTickets.includes('MotionFeedback'), 'legacy tickets retain accessible animated feedback');
  assert.match(currentTickets,/role="alert"/);
  assert.match(currentTickets,/role="status"/);
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
test('Login retains its local ambient motion while the global galaxy is shared', () => {
  assert.ok(login.includes('form-shell auth-motion'));
  assert.ok(css.includes('.auth-motion::before'));
});

test('Company and site dashboards use validated tenant context',()=>{const api=source('src/app/api/dashboard/route.ts');const data=source('src/lib/dashboard-data.ts');const auth=source('src/lib/tenant-context.ts');assert.ok(api.includes('authorizeTenant'));assert.ok(api.includes('getDashboardData'));assert.ok(data.includes("count:'exact'"));assert.ok(data.includes("subscription_orders.site_id"));assert.ok(auth.includes(".eq('company_id',companyId)"));});


test('original animated stars and the shared route-local canvas use one persistent backdrop',()=>{
 const galaxy=source('src/components/galaxy-backdrop.tsx');
 const wave=source('src/components/radio-wave-canvas.tsx');
 const styles=source('src/app/galactic-system.css');
 assert.match(galaxy,/Array\.from\(\{ length: 74 \}/);
 assert.match(galaxy,/Math\.sin\(/);
 assert.doesNotMatch(galaxy,/Math\.random\(/);
 for(const name of ['zaray-starfield','zaray-twinkle-star','zaray-shooting-star'])
  assert.ok(galaxy.includes('className="'+name+'"'),name);
 assert.match(galaxy,/!reducedMotion && meteors\.map/);
 assert.match(styles,/@keyframes zaray-twinkle-drift/);
 assert.match(styles,/@keyframes zaray-shooting-flight/);
 assert.match(wave,/getContext\('2d'/);
 assert.match(wave,/frame = window\.requestAnimationFrame\(draw\)/);
 assert.match(wave,/const WAVE_DURATION = 15/);
 assert.match(wave,/const WAVE_COUNT = 16/);
 assert.match(wave,/publicBackdrop = pathname === '\/'/);
 assert.match(wave,/\.some\(route => pathname === route/);
 assert.doesNotMatch(wave,/Math\.random\(/);
});
test('reduced motion, background visibility, GPU-free cleanup and decorative isolation',()=>{
 const galaxy=source('src/components/galaxy-backdrop.tsx');
 const wave=source('src/components/radio-wave-canvas.tsx');
 const styles=source('src/app/galactic-system.css');
 assert.match(galaxy,/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
 assert.match(galaxy,/preference\.addEventListener\('change', sync\)/);
 assert.match(galaxy,/preference\.removeEventListener\('change', sync\)/);
 assert.match(wave,/if \(disposed \|\| document\.hidden \|\| motionPreference\.matches\) return/);
 assert.match(wave,/document\.addEventListener\('visibilitychange', updatePlayback\)/);
 assert.match(wave,/document\.removeEventListener\('visibilitychange', updatePlayback\)/);
 assert.match(wave,/window\.cancelAnimationFrame\(frame\)/);
 assert.match(wave,/motionPreference\.removeEventListener\('change', updatePlayback\)/);
 assert.match(wave,/observer\.disconnect\(\)/);
 assert.match(wave,/Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
 assert.match(galaxy,/aria-hidden="true"/);
 assert.match(styles,/\.zaray-original-backdrop \.zaray-starfield/);
 assert.match(styles,/@media \(prefers-reduced-motion: reduce\)/);
 assert.match(styles,/animation: none !important/);
 assert.match(styles,/pointer-events: none/);
});
