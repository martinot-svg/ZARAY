import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const css = source('src/app/globals.css');
const motion = source('src/components/motion.tsx');
const shell = source('src/components/app-shell.tsx');
const dashboard = source('src/app/tableau-de-bord/page.tsx');
const login = source('src/app/connexion/page.tsx');
const tickets = source('src/app/tickets/page.tsx');

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
test('Count-up uses the actual data and hides transient visual numbers from assistive technology', () => {
  assert.ok(dashboard.includes('<MotionCount value={summary.customers}/>'));
  assert.ok(dashboard.includes('<MotionCount value={summary.pendingPayments}/>'));
  assert.ok(motion.includes('aria-hidden="true"'));
});
test('Background movement is limited to the existing login page', () => {
  assert.ok(login.includes('form-shell auth-motion'));
  assert.ok(css.includes('.auth-motion::before'));
});
