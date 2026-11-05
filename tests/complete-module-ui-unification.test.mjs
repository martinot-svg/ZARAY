import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path,import.meta.url),'utf8');

test('one accessible title sits immediately to the right of the logo in shared enterprise/personal headers',()=>{
 const enterprise=read('src/components/app-shell.tsx');
 const personal=read('src/components/personal-shell.tsx');
 for(const [src,start,logo,title,menu] of [
  [enterprise,'<header className="app-topbar zaray-icon-topbar">','className="app-topbar-brand"','className="app-topbar-title"','className="app-topbar-links"'],
  [personal,'<header className="personal-topbar">','className="personal-logo"','className="personal-topbar-module-title"','className="personal-home-nav-control"'],
 ]) {
  const head=src.slice(src.indexOf(start),src.indexOf('</header>',src.indexOf(start)));
  assert.ok(head.indexOf(logo)>=0 && head.indexOf(title)>head.indexOf(logo) && head.indexOf(menu)>head.indexOf(title));
 }
 assert.match(personal,/active !== '\/mon-compte' && personalModuleTitle/);
 assert.doesNotMatch(personal,/<span className="personal-profile-copy"|topbar-icon-label">Mon espace Zaray/);
 assert.doesNotMatch(enterprise,/À propos du module|workspace-help/);
});

test('every remaining standalone route uses a real shared logo and title, never a separate banner',()=>{
 const component=read('src/components/standalone-module-header.tsx');
 assert.match(component,/<BrandLogo priority surface=\{surface\} \/>/);
 assert.match(component,/<h1 title=\{title\}>\{title\}<\/h1>/);
 for(const path of [
  'src/app/autorisations-paiement/page.tsx',
  'src/app/invitations/page.tsx',
  'src/app/paiements/page.tsx',
  'src/app/entreprises/nouvelle/page.tsx',
  'src/app/z-alliance/accepter/page.tsx',
  'src/app/portail/[slug]/page.tsx',
  'src/app/paiement/[reference]/page.tsx',
  'src/app/inscription/page.tsx',
  'src/app/mot-de-passe-oublie/page.tsx',
  'src/app/reinitialiser-mot-de-passe/page.tsx'
 ]) {
  const page=read(path);
  assert.match(page,/<StandaloneModuleHeader title=/,path);
  assert.doesNotMatch(page,/className="(auth-brand|workspace-brand)"/,path);
  assert.doesNotMatch(page,/<p className="eyebrow">ZARAY ·/,path);
 }
 const login=read('src/app/connexion/page.tsx');
 assert.ok(login.indexOf('<h1 id="login-title">Connexion</h1>')<login.indexOf('<section className="form-card login-card"'));
});

test('personal pages do not duplicate the title and ZAlliance guides are removed from JSX',()=>{
 const enterprise=read('src/app/entreprises/page.tsx');
 const finance=read('src/app/finance-globale/page.tsx');
 const alliance=read('src/components/z-alliance-workspace.tsx');
 assert.doesNotMatch(enterprise,/<h1>Mes entreprises<\/h1>/);
 assert.doesNotMatch(finance,/<h1>Finance globale<\/h1>/);
 assert.doesNotMatch(alliance,/zalliance-info|zalliance-heading"[^>]*>\s*<div>\s*<p className="eyebrow"/);
 assert.match(alliance,/onSubmit=\{event => void createInvitation\(event\)\}/);
 assert.match(alliance,/Mes invitations reçues/);
});

test('public landing removes the how-it-works guide and decorative module numbering at source',()=>{
 const page=read('src/app/page.tsx');
 assert.doesNotMatch(page,/id="fonctionnement"|#fonctionnement|landing-step-grid|feature\.number|landing-benefit-index/);
 assert.match(page,/href="\/connexion"/);
 assert.match(page,/href="\/inscription"/);
 assert.match(page,/landing-feature-grid/);
});

test('responsive brand and density styles remain live in three themes and widths',()=>{
 const layout=read('src/app/layout.tsx');
 const css=read('src/app/zaray-module-consistency.css');
 assert.ok(layout.indexOf("import './zaray-module-consistency.css'")>layout.indexOf("import './zaray-compact-workspace.css'"));
 for(const marker of ['zaray-standalone-module-header','personal-topbar-module-title','login-brand','@media (max-width: 700px)','zaray-logo-on-light.svg','zaray-logo.svg'])
  assert.ok(css.includes(marker),marker);
 assert.match(css,/min-width:0/);
 assert.match(read('src/app/zaray-compact-workspace.css'),/dashboard-metrics-grid/);
});

test('functional payment and network operations survive guide removal',()=>{
 assert.match(read('src/app/autorisations-paiement/page.tsx'),/setAuthorization\(reviewer, e\.target\.checked\)/);
 assert.match(read('src/app/paiements/page.tsx'),/api\/payments/);
 assert.match(read('src/app/paiement/[reference]/page.tsx'),/justificatif/);
 assert.match(read('src/app/portail/[slug]/page.tsx'),/companyName/);
 assert.match(read('src/app/inscription/page.tsx'),/verifyOtp/);
 assert.match(read('src/app/connexion/page.tsx'),/signInWithPassword/);
 assert.match(read('src/components/z-alliance-workspace.tsx'),/createInvitation/);
});
