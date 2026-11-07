import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const read = path => readFileSync(path, 'utf8');
const layout = read('src/app/layout.tsx');
const cssPaths = [...layout.matchAll(/import '\.\/(.+?\.css)';/g)].map(match => 'src/app/' + match[1]);
const browser = await chromium.launch({headless:true, args:['--no-sandbox']});
const directory = 'artifacts/premium-visual';
mkdirSync(directory, {recursive:true});

function luminance(rgb) {
  return rgb.slice(0,3).map(x => {
    const value = x / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
}
function rgba(value) {
  const numbers = [...value.matchAll(/[\d.]+/g)].map(match => Number(match[0]));
  assert.ok(numbers.length >= 3, 'Unparseable CSS color ' + value);
  return [...numbers.slice(0, 3), numbers[3] ?? 1];
}
function ratio(foreground, background) {
  const f = rgba(foreground);
  const b = rgba(background);
  assert.ok(b[3] > .99, 'Reference background must be opaque: ' + background);
  const shown = f.slice(0,3).map((v,i) => v * f[3] + b[i] * (1-f[3]));
  const [l, d] = [luminance(shown), luminance(b)].sort((a,b)=>b-a);
  return (l+.05)/(d+.05);
}
try {
  const page = await browser.newPage({viewport:{width:1366,height:768}, reducedMotion:'reduce'});
  await page.setContent(`<!doctype html><html lang="fr" data-zaray-theme="dark"><meta charset="utf-8"><body>
    <div class="app-shell app-no-sidebar"><div class="app-main">
    <header class="app-topbar zaray-icon-topbar">
      <div class="app-topbar-links"><div class="app-menu-container">
        <button class="app-menu-button">Menu</button>
        <nav id="zaray-app-nav" class="app-nav-dropdown is-open">
          <div class="app-nav-current-context"><span class="app-nav-label">ENTREPRISE</span><strong>Entreprise Mlay</strong></div>
          <div class="app-nav-rail"><div class="app-nav-flyout">
            <button class="app-nav-flyout-trigger is-active"><span>Pilotage</span></button>
            <div class="app-nav-flyout-panel is-open">
              <div class="app-nav-flyout-heading">Pilotage</div>
              <a class="app-nav-link" href="#client">Tableau de bord du site</a>
            </div>
          </div></div>
          <div class="app-nav-footer">
            <a class="app-nav-link" href="#account">Mon compte</a>
            <button class="zaray-theme-switch app-nav-theme-switch"><span class="zaray-theme-switch-label">Mode clair</span></button>
            <div class="account-signout"><button>Se déconnecter</button></div>
          </div>
        </nav>
      </div></div>
    </header></div></div>
    <div class="zaray-flyout-portal" data-side="left" id="flyout" style="left:600px;top:180px">
      <div class="app-nav-flyout-heading">Pilotage</div>
      <a class="app-nav-link" href="#site">Tableau de bord du site</a>
      <a class="app-nav-link active" href="#general">Vue générale</a>
      <a class="app-nav-link" href="#sites">Sites de l'entreprise</a>
    </div>
  </body></html>`);
  for (const file of cssPaths) await page.addStyleTag({content:read(file)});
  for (const theme of ['dark','light']) {
    await page.locator('html').evaluate((element, next) => element.setAttribute('data-zaray-theme', next), theme);
    await page.waitForTimeout(100);
    const colors = await page.evaluate(() => {
      const props = selector => {
        const element = document.querySelector(selector);
        if (!element) throw Error('Missing ' + selector);
        const style = getComputedStyle(element);
        return { fg:style.color, bg:style.backgroundColor, image:style.backgroundImage };
      };
      return {
        main:props('.app-nav-dropdown'),
        siteName:props('.app-nav-current-context strong'),
        trigger:props('.app-nav-flyout-trigger'),
        footerLink:props('.app-nav-footer .app-nav-link'),
        themeButton:props('.app-nav-footer .app-nav-theme-switch'),
        themeLabel:props('.app-nav-footer .zaray-theme-switch-label'),
        logout:props('.app-nav-footer .account-signout button'),
        touchPanel:props('.app-nav-flyout-panel'),
        touchLink:props('.app-nav-flyout-panel .app-nav-link'),
        flyout:props('#flyout'),
        flyoutTitle:props('#flyout .app-nav-flyout-heading'),
        flyoutLink:props('#flyout .app-nav-link:not(.active)'),
        selected:props('#flyout .app-nav-link.active'),
      };
    });
    const mainLum = luminance(rgba(colors.main.bg));
    const flyoutLum = luminance(rgba(colors.flyout.bg));
    if (theme==='dark') {
      assert.ok(mainLum < .08 && flyoutLum < .08, 'dark menus should have dark surfaces');
    } else {
      assert.ok(mainLum > .8 && flyoutLum > .8, 'light menus should have light surfaces');
    }
    for (const [name, backgroundKey] of [
      ['siteName','main'],['trigger','main'],['footerLink','main'],
      ['themeButton','main'],['themeLabel','main'],['logout','main'],
      ['touchLink','touchPanel'],['flyoutTitle','flyout'],['flyoutLink','flyout']
    ]) {
      const computedRatio = ratio(colors[name].fg, colors[backgroundKey].bg);
      assert.ok(computedRatio >= 4.5, theme+' '+name+' should have AA contrast; got '+computedRatio.toFixed(2));
    }
    const selectedRatio = ratio(colors.selected.fg, colors.selected.bg);
    assert.ok(selectedRatio >= 4.5, theme+' selected item should have AA contrast; got '+selectedRatio.toFixed(2));
    await page.screenshot({path:directory+'/flyout-theme-'+theme+'.png',animations:'disabled'});
    console.log(theme+' navigation and curtain contrast verified, normal link '+ratio(colors.flyoutLink.fg,colors.flyout.bg).toFixed(2));
  }
  await page.close();
} finally {
  await browser.close();
}
