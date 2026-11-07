import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const core=read('src/lib/site-portal-config.ts');
const editor=read('src/components/site-portal-studio.tsx');
const editorCss=read('src/components/site-portal-studio.css');
const portal=read('src/components/public-wifi-portal.tsx');
const portalCss=read('src/components/public-wifi-portal-themes.css');
const router=read('public/hotspot/zaray-login.html');
const portalApi=read('src/app/api/public/site-portal/route.ts');

test('four editable input colors are validated, site-scoped and compatible with old portal versions',()=>{
 for(const name of ['inputBackgroundColor','inputBorderColor','inputFocusColor','inputTextColor']){
  assert.match(core,new RegExp(name+':string;'));
  assert.match(core,new RegExp(name+':getColor\\(object\\.'+name+'\\?\\?DEFAULT_PORTAL_CONFIG\\.'+name+'\\)'));
  assert.match(editor,new RegExp("'"+name+"'"));
 }
 assert.match(core,/const allowed=new Set<keyof PortalConfig>\(Object\.keys\(DEFAULT_PORTAL_CONFIG\)/);
 assert.match(core,/export function readPortalConfig/);
 assert.match(portalApi,/\.select\('published,published_version'\)/);
 assert.match(editor,/expectedRevision:state\.revision/);
});

test('site-specific logo replaces Wi-Fi emblem and brand name in editor preview',()=>{
 assert.match(editor,/\/api\/ticket-templates\?'.*new URLSearchParams\(\{companyId,siteId\}\)/);
 assert.match(editor,/const currentLogo=siteLogo\?\.key===brandKey\?siteLogo:null/);
 assert.match(editor,/<div className="ps-site-logo"/);
 assert.match(editor,/<img src={visibleLogo} alt=/);
 assert.doesNotMatch(editor,/<div className="ps-brand-mark"><Wifi/);
 assert.doesNotMatch(editor,/<span className="ps-brand-name">\{site\.name\}/);
 assert.match(editorCss,/\.ps-site-logo img\{/);
 assert.match(editorCss,/max-height:76px;object-fit:contain/);
});

test('shared field palette generates readable, semi-transparent guide colors',()=>{
 assert.match(core,/export function portalFieldPalette/);
 assert.match(core,/contrast\(preferred,background\)>=4\.5/);
 assert.match(core,/mixedWithBackground\(base,background,opacity\),background\)<4\.5/);
 assert.match(core,/opacity=\.72/);
 assert.match(core,/rgba\(255,255,255,/);
 assert.match(editor,/portalFieldPalette\(config\)/);
 assert.match(editorCss,/\.ps-demo-portal input\.ps-demo-field::placeholder/);
 assert.match(editorCss,/opacity:1/);
 assert.match(portal,/portalFieldPalette\(portalDesign\)/);
 for(const token of ['--zw-input-bg','--zw-input-border','--zw-input-focus','--zw-input-text','--zw-input-guide'])
  assert.ok(portal.includes(token)&&portalCss.includes(token),token);
 assert.match(portalCss,/\.zw-simple-field input::placeholder/);
 assert.match(portalCss,/\.zw-simple-field:focus-within/);
});

test('public and RouterOS portal keep native login and never show a second site name under logo',()=>{
 assert.match(portal,/currentIdentity=siteIdentity\?\.siteId===selectedSiteId&&siteIdentity\.companySlug===slug/);
 assert.match(portal,/siteLogoForSurface\(currentIdentity/);
 assert.doesNotMatch(portal,/<strong className="zw-site-name">\{displayBrand\}/);
 assert.match(router,/id="siteLogo"/);
 assert.doesNotMatch(router,/id="siteBrand"/);
 assert.match(router,/function applyPortalFields\(portal\)/);
 assert.match(router,/styles\.setProperty\('--portal-input-guide',guide\)/);
 assert.match(router,/\.field input::placeholder/);
 assert.match(router,/placeholder="Identifiant du ticket"/);
 assert.match(router,/placeholder="Mot de passe"/);
 assert.match(router,/form name="login" method="post" action="\$\(link-login-only\)"/);
 assert.match(router,/hexMD5\('\$\(chap-id\)'\+password\+'\$\(chap-challenge\)'\)/);
});
