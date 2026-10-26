import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const svg=read('public/brand/zaray-logo.svg');
const css=read('src/app/globals.css');
const brand=read('src/components/brand-logo.tsx');

function relativeLuminance(hex){
 const channels=hex.replace('#','').match(/.{2}/g).map(h=>parseInt(h,16)/255).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
 return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
}
function contrast(one,two){
 const a=relativeLuminance(one),b=relativeLuminance(two);
 return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}
test('the uploaded wordmark silhouette is a local scalable asset',()=>{
 assert.match(svg,/viewBox="0 0 785 247"/);
 assert.match(svg,/fill="#fff"/);
 assert.match(svg,/fill="#21f728"/);
 assert.doesNotMatch(svg,/<(?:text|image|script|foreignObject)/);
 assert.match(brand,/src="\/brand\/zaray-light\.png"/);
 assert.match(brand,/src="\/brand\/zaray-dark\.png"/);
 assert.match(brand,/aria-label="ZARAY"/);
 assert.match(brand,/aria-label="ZARAY"/);
});
test('brand identity is present on public, workspace and all auth screens',()=>{
 for(const path of [
 'src/app/page.tsx','src/components/app-shell.tsx',
 'src/app/connexion/page.tsx','src/app/inscription/page.tsx',
 'src/app/entreprises/nouvelle/page.tsx','src/app/mot-de-passe-oublie/page.tsx',
 'src/app/reinitialiser-mot-de-passe/page.tsx',
 'src/app/paiement/[reference]/page.tsx','src/app/portail/[slug]/page.tsx'
 ]){
  assert.match(read(path),/<BrandLogo\b/,path);
 }
 assert.doesNotMatch(read('src/app/page.tsx'),/ZARAY<span className="dot"/);
 assert.doesNotMatch(read('src/components/app-shell.tsx'),/ZARAY<span>/);
});
test('logo is backed by a dark panel and all accent tokens are logo-derived',()=>{
 for(const fragment of ['--brand-ink:#0a0d0b','--brand-green:#21f728','--brand-white:#ffffff',
 '.app-nav{background:var(--brand-ink)', '.auth-brand{', '.hero{', '.brand-logo{']){
  assert.ok(css.includes(fragment),fragment);
 }
 assert.ok(!css.toLowerCase().includes('#10b89f'),'old turquoise accent removed');
 assert.ok(!css.toLowerCase().includes('#078a79'),'old turquoise text removed');
});
test('contrast of CTA and green link text meets WCAG AA',()=>{
 assert.ok(contrast('#2df135','#0b160c')>=4.5);
 assert.ok(contrast('#176d22','#ffffff')>=4.5);
 assert.ok(contrast('#ffffff','#0a0d0b')>=4.5);
});
test('responsiveness and reduced-motion are retained',()=>{
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/:focus-visible/);
});

test('favicon and browser metadata are configured with real transparent ZARAY artwork',()=>{
  const layout=read('src/app/layout.tsx');
  const favicon=read('src/app/icon.svg');
  const generated=read('scripts/generate-favicon.mjs');
  const manifest=read('public/site.webmanifest');
  assert.match(layout,/title: 'ZARAY'/);
  assert.match(layout,/url: '\/favicon\.svg'/);
  assert.match(layout,/favicon-16x16\.png/);
  assert.match(layout,/favicon-32x32\.png/);
  assert.match(layout,/favicon-48x48\.png/);
  assert.match(favicon,/viewBox="0 0 168 152"/);
  assert.doesNotMatch(favicon,/<rect\b/);
  assert.match(generated,/sizes = \[16, 32, 48\]/);
  assert.match(manifest,/favicon\.svg/);
  assert.match(layout,/apple-touch-icon\.png/);
  assert.match(manifest,/android-chrome-192x192\.png/);
});

test('official logo variants retain transparency, proportions, and automatic theme choice',()=>{
  const fs=awaitImportRead();
  const light=fs('public/brand/zaray-light.png');
  const dark=fs('public/brand/zaray-dark.png');
  assert.equal(light.toString('ascii',1,4),'PNG');
  assert.equal(light.readUInt32BE(16),512);
  assert.equal(light.readUInt32BE(20),150);
  assert.equal(dark.readUInt32BE(16),512);
  assert.equal(dark.readUInt32BE(20),150);
  assert.ok(light.includes(Buffer.from('tRNS')));
  assert.equal(dark[25],6);
  const code=read('src/components/theme-selector.tsx');
  const css=read('src/app/globals.css');
  for(const value of ["'auto'","'light'","'dark'"])assert.ok(code.includes(value));
  assert.ok(code.includes('localStorage'));
  assert.ok(code.includes('document.documentElement.dataset.theme'));
  assert.match(css,/prefers-color-scheme:dark/);
  assert.match(css,/\.brand-logo-on-dark/);
  assert.match(css,/\.brand-logo-on-light/);
  const authPages=['src/app/connexion/page.tsx','src/app/inscription/page.tsx'];
  for(const path of authPages)assert.match(read(path),/<ThemeSelector \/>/);
});
function awaitImportRead(){
  return (path)=>readFileSync(new URL('../'+path,import.meta.url));
}
