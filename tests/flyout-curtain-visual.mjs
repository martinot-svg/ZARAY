import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

// Visual regression for the clipping/stacking bug visible in the user's dashboard screenshot.
// The fixture uses the real ZARAY flyout stylesheet; authentication and business data are not mocked.
const css = readFileSync('src/app/zaray-flyout-navigation.css', 'utf8');
const folder = 'artifacts/premium-visual';
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.setContent(`<!doctype html><html lang="fr"><meta charset="utf-8">
  <style>
    body { margin: 0; background: #edf9f3; font-family: Arial, sans-serif; }
    .app-header { height: 70px; background: #06251c; }
    .dashboard { margin: 100px 68px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .dashboard > div { height: 100px; background: white; border-radius: 14px; }
    ${css}
  </style>
  <div class="app-header"></div>
  <div class="dashboard"><div></div><div></div><div></div><div></div></div>
  <div id="curtain" class="zaray-flyout-portal" data-side="left" style="left:719px;top:231px">
    <div class="app-nav-flyout-heading">Pilotage</div>
    <a class="app-nav-link" href="#site">Tableau de bord du site</a>
    <a class="app-nav-link" href="#company">Vue générale</a>
    <a class="app-nav-link" href="#sites">Sites de l'entreprise</a>
  </div>
  </html>`, { waitUntil: 'domcontentloaded' });
  await page.locator('#curtain').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  const result = await page.locator('#curtain').evaluate(element => {
    const b = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const middle = document.elementFromPoint(b.left + 40, b.top + 70);
    return { left:b.left, right:b.right, top:b.top, height:b.height,
      opacity:Number(style.opacity), position:style.position, zIndex:Number(style.zIndex),
      visibleAtPoint:!!middle?.closest('#curtain') };
  });
  assert.equal(result.position, 'fixed', 'curtain must escape header clipping');
  assert.ok(result.opacity >= 0.99, 'curtain must finish its entrance animation');
  assert.ok(result.zIndex > 1000, 'curtain must be above dashboard cards');
  assert.ok(result.left >= 0 && result.right <= 1366, 'curtain must remain inside viewport');
  assert.ok(result.visibleAtPoint, 'curtain must be topmost and pointer-interactive');
  assert.equal(await page.locator('#curtain .app-nav-link').count(), 3);
  await page.screenshot({ path: folder+'/flyout-curtain-desktop.png', animations: 'disabled' });
  await page.close();
  console.log('Desktop flyout curtain is visible, in viewport, and above dashboard content.');
} finally {
  await browser.close();
}
