import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('login starts in personal space, never in an arbitrary company',()=>{
 const login=source('src/app/connexion/page.tsx');
 assert.match(login,/window\.location\.replace\('\/mon-compte'\)/);
 assert.doesNotMatch(login,/window\.location\.assign\('\/tableau-de-bord'\)/);
});
test('personal welcome uses the signed-in user profile and active memberships',()=>{
 const account=source('src/lib/personal-context.ts');
 assert.match(account,/auth\.getUser\(\)/);
 assert.match(account,/user\.user_metadata\?\.full_name/);
 assert.match(account,/\.eq\('user_id', user\.id\)/);
 assert.match(account,/\.eq\('status', 'active'\)/);
 assert.match(account,/email_confirmed_at/);
 const page=source('src/app/mon-compte/page.tsx');
 assert.match(page,/Bonjour, \$\{identity\.name\}/);
 assert.doesNotMatch(page,/Martinot|Maleka|1 248|12 450 000/);
});
test('personal navigation has exactly the requested three primary destinations',()=>{
 const nav=source('src/components/personal-shell.tsx');
 for(const path of ['/mon-compte','/entreprises','/finance-globale'])assert.ok(nav.includes("href: '"+path+"'"));
 assert.match(nav,/aria-expanded=\{open\}/);
 assert.match(nav,/event\.key === 'Escape'/);
 assert.match(nav,/inert=\{!desktop && !open\}/);
 assert.match(nav,/name\?\.trim\(\)/);
 assert.match(nav,/personal-profile-copy/);
 assert.match(nav,/Espace personnel/);
 const css=source('src/app/globals.css');
 assert.match(css,/@media\(min-width:901px\)/);
 assert.match(css,/grid-template-columns:280px minmax\(0,1fr\)/);
});
test('company menu uses three named groups, retains routes and excludes public website link',()=>{
 const nav=source('src/components/app-shell.tsx');
 for(const section of ['GESTION','ACTIVITÉ','FINANCE & RÉSEAU'])assert.ok(nav.includes(section));
 for(const path of ['/tableau-de-bord','/entreprises','/sites','/membres','/clients','/offres','/commandes','/tickets','/paiements/verification','/parametres-paiement','/portail'])assert.ok(nav.includes("'"+path+"'"),path);
 assert.doesNotMatch(nav,/Voir le site public/);
 assert.match(nav,/aria-controls="zaray-app-nav"/);
 assert.match(nav,/Retour au compte personnel/);
 assert.match(nav,/SignOutButton/);
});
test('company list preserves creation route and never uses example records',()=>{
 const page=source('src/app/entreprises/page.tsx');
 const creation=source('src/app/entreprises/nouvelle/page.tsx');
 assert.match(page,/Mes entreprises/);
 assert.match(page,/\+ Créer une entreprise/);
 assert.match(page,/company\.legal_name/);
 assert.match(page,/companyId=/);
 assert.match(creation,/\/api\/companies/);
 assert.doesNotMatch(page,/Maleka|Entreprise 2|Entreprise 3/);
});
test('global finance uses RLS, confirmed ledger entries, and no truncation-based totals',()=>{
 const page=source('src/app/finance-globale/page.tsx');
 assert.match(page,/client\.from\('payments'\)/);
 assert.match(page,/\.eq\('status', 'succeeded'\)/);
 assert.match(page,/count > 1000/);
 assert.match(page,/new Map<string, number>\(\)/);
 assert.match(page,/financeRoles\.has\(c\.role\)/);
 assert.doesNotMatch(page,/service_role|Math\.random|faker/);
});
test('company and site URLs are server-authorized before any dashboard data is shown',()=>{
 const company=source('src/app/tableau-de-bord/page.tsx');
 const site=source('src/app/sites/[siteId]/page.tsx');
 for(const page of [company,site]){
  assert.match(page,/authorizeTenant\(client, companyId/);
  assert.match(page,/redirect\('\/connexion'\)/);
  assert.match(page,/redirect\('\/entreprises'\)/);
 }
 assert.match(site,/companyId, siteId/);
});
test('company dashboard scope stays visible, navigation remains compact and mobile-friendly',()=>{
 const dashboard=source('src/components/dashboard-workspace.tsx');
 const css=source('src/app/globals.css');
 assert.match(dashboard,/company\.legal_name\+' — Tableau de bord'/);
 assert.match(dashboard,/site\.name\+' — Tableau de bord'/);
 assert.match(css,/\.app-shell \.app-main\{margin-left:0\}/);
 assert.match(css,/\.app-shell \.app-nav\.is-open/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('site filtering is limited to operational pages and company-wide site directory remains global',()=>{
 const shell=source('src/components/app-shell.tsx');
 assert.match(shell,/const siteOperational = \['\/clients','\/commandes','\/tickets','\/paiements\/verification'\]/);
 assert.match(shell,/activeSite && siteOperational/);
 assert.match(shell,/href === '\/entreprises'/);
});
