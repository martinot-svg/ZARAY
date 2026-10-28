import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const style=read('src/app/form-proportions.css');
const layout=read('src/app/layout.tsx');
test('compact form CSS is loaded last after legacy and premium layers',()=>{
 const foundation=layout.indexOf("import './globals.css'");
 const premium=layout.indexOf("import './zaray-total-redesign.css'");
 const compact=layout.indexOf("import './form-proportions.css'");
 assert.ok(foundation>=0 && premium>foundation && compact>premium);
});
test('standalone, workspace, modal forms all have responsive natural height',()=>{
 for (const term of ['--zf-form-standalone-width:468px','--zf-form-workspace-width:440px',
    '.form-shell.auth-motion > .form-card','.workspace-grid > .panel:has(form)',
    ':is(dialog,[role="dialog"],.modal):has(form)','height:auto!important','overflow-y:auto',
    '@media(max-width:700px)','@media(min-width:701px) and (max-width:1099px)']){
    assert.ok(style.includes(term),term);
 }
 assert.match(style,/html:has\(\.form-shell\)\{[\s\S]*scrollbar-gutter:auto/);
 assert.doesNotMatch(style,/#(?:fff|ffffff)\s*!important\s*;\s*height:100vh/);
});
test('authentication, enterprise creation, forms retain existing business logic',()=>{
 for (const [path,marker] of [
  ['src/app/connexion/page.tsx','signInWithPassword'],
  ['src/app/inscription/page.tsx','verifyOtp'],
  ['src/app/entreprises/nouvelle/page.tsx',"/api/companies"],
  ['src/app/clients/page.tsx','form-stack'],
  ['src/app/offres/page.tsx','form-stack'],
  ['src/app/tickets/page.tsx','WifiTicketGenerator']
 ])assert.ok(read(path).includes(marker),path);
 assert.match(style,/@media print/);
});


test('ZARAY login exposes a logo outside form and a single left/right footer row',()=>{
 const login=read('src/app/connexion/page.tsx');
 const logoPosition=login.indexOf('<div className="login-brand">');
 const cardPosition=login.indexOf('<section className="form-card login-card"');
 const left=login.indexOf('<a href="/mot-de-passe-oublie">Mot de passe oublié ?</a>');
 const right=login.indexOf('<a href="/inscription">Créer un compte</a>');
 assert.ok(logoPosition>=0 && cardPosition>logoPosition,'logo must be outside the card');
 assert.ok(left>cardPosition && right>left,'forgotten password left, account creation right');
 assert.ok(login.includes('<h1 id="login-title">Votre univers vous attend</h1>'));
 assert.ok(!login.includes('Votre univers ZARAY vous attend'));
 assert.ok(!login.includes('Connexion à mon compte ZARAY'));
 assert.ok(!login.includes('ZARAY · ACCÈS SÉCURISÉ'));
 assert.match(style,/\.login-shell > \.login-card #login-title/);
 assert.match(style,/white-space:nowrap/);
 assert.match(style,/\.login-footer-links\{[\s\S]*?justify-content:space-between/);
 assert.match(style,/\.global-auth-theme \.zaray-theme-switch \.zaray-theme-switch-label\{[\s\S]*?display:none!important/);
 assert.match(style,/\.login-brand \.brand-logo/);
 assert.match(style,/\.form-shell\.auth-motion\.login-shell\{/);
 assert.match(style,/justify-content:center/);
 assert.match(style,/\.login-card #login-title\{[\s\S]*?text-align:center!important/);
 assert.match(style,/\.login-footer-links a:last-child\{[\s\S]*?font-weight:400!important/);
 assert.match(style,/\.login-footer-links a:last-child:focus-visible\{[\s\S]*?text-decoration-line:none!important/);
});


test('login green submit button always uses black text and opts out of gradient-blind contrast repair',()=>{
 const login=read('src/app/connexion/page.tsx');
 assert.match(login,/className="primary-link" data-contrast-ignore/);
 assert.match(style,/\.login-card button\.primary-link:focus-visible/);
 assert.match(style,/\.login-card button\.primary-link:active/);
 assert.match(style,/\.login-card button\.primary-link:disabled/);
 assert.match(style,/color:#000000!important/);
 assert.match(style,/-webkit-text-fill-color:#000000!important/);
 assert.match(read('src/components/contrast-guardian.tsx'),/closest\('\[data-contrast-ignore\]/);
});


test('mobile login keyboard glide is restricted to mobile VisualViewport changes',()=>{
 const login=read('src/app/connexion/page.tsx');
 const hook=read('src/components/use-mobile-login-keyboard-glide.ts');
 assert.match(login,/useMobileLoginKeyboardGlide\(\)/);
 assert.match(login,/ref=\{mobileLoginRef\} className="form-shell auth-motion login-shell"/);
 assert.match(hook,/window\.matchMedia\('\(max-width: 700px\)'\)/);
 assert.match(hook,/window\.visualViewport/);
 assert.match(hook,/viewport\?\.addEventListener\('resize', schedule\)/);
 assert.match(hook,/viewport\?\.addEventListener\('scroll', schedule\)/);
 assert.match(hook,/card\.contains\(focused\)/);
 assert.match(hook,/largestVisibleHeight - height < 130/);
 assert.match(hook,/getComputedStyle\(card\)\.transform/);
 assert.match(hook,/new DOMMatrixReadOnly\(cssTransform\)\.m42/);
 assert.match(hook,/--login-keyboard-lift/);
 assert.match(hook,/login-keyboard-open/);
 assert.match(hook,/shell\.classList\.remove\('login-keyboard-open'\)/);
 assert.match(hook,/viewport\?\.removeEventListener\('resize', schedule\)/);
 assert.match(style,/@media\(max-width:700px\)\{[\s\S]*?\.form-shell\.auth-motion\.login-shell/);
 assert.match(style,/520ms cubic-bezier\(\.16,1,\.3,1\)/);
 assert.match(style,/@media\(max-width:700px\) and \(prefers-reduced-motion:reduce\)/);
 // Desktop/tablet transform rules must not be placed outside mobile media.
 assert.ok(style.lastIndexOf('/* Mobile-only login keyboard choreography') > style.indexOf('/* Login visual refinement'));
});
