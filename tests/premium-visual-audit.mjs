import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const host = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const destination = 'artifacts/premium-visual';
mkdirSync(destination, { recursive: true });

const devices = [
 { name: 'desktop', width: 1440, height: 920 },
 { name: 'tablet', width: 820, height: 1180 },
 { name: 'mobile', width: 390, height: 844 },
];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
 for (const device of devices) {
  const page = await browser.newPage({
   viewport: { width: device.width, height: device.height },
   deviceScaleFactor: 1,
   reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(12000);
  const url = new URL('/', host);
  url.searchParams.set('visual_audit', device.name);
  const response = await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45000 });
  assert.equal(response?.status(), 200, device.name + ': public route should serve HTTP 200');
  await page.locator('#landing-title').waitFor({ state: 'visible', timeout: 30000 });
  assert.match(await page.locator('#landing-title').innerText(), /nouvelle dimension/i);
  const frame = page.locator('.experience-device-frame');
  await frame.waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Tickets Wi-Fi', exact: true }).first().click();
  assert.match(await page.locator('.experience-workspace-header').innerText(), /Espace tickets/);
  await page.getByRole('button', { name: 'Mobile', exact: true }).click();
  assert.ok((await frame.getAttribute('class'))?.includes('experience-device-mobile'));
  await page.getByRole('button', { name: 'Ordinateur', exact: true }).click();
  assert.ok((await frame.getAttribute('class'))?.includes('experience-device-desktop'));
  await page.screenshot({ path: destination + '/' + device.name + '-dark.png', fullPage: false, animations: 'disabled', timeout: 20000 });

  const themeSwitch = page.getByRole('button', { name: 'Activer le thème clair' }).first();
  await themeSwitch.click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-zaray-theme') === 'light');
  await page.screenshot({ path: destination + '/' + device.name + '-light.png', fullPage: false, animations: 'disabled', timeout: 20000 });
  assert.equal(await page.locator('html').getAttribute('data-zaray-theme'), 'light');
  const mainWidth = await page.locator('.landing-hero-grid').evaluate(el => el.getBoundingClientRect().width);
  assert.ok(mainWidth <= device.width, device.name + ': hero should fit viewport');
  console.log(device.name + ': public page, scene controls, responsive switch, dark/light passed');
  await page.close();
 }
} finally {
 await browser.close();
}
