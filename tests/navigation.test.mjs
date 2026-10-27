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
 assert.match(page,/identity\.name \? 'Bonjour, ' \+ identity\.name/);
 assert.doesNotMatch(page,/Martinot|Maleka|1 248|12 450 000/);
});
test('personal navigation has exactly the requested three primary destinations',()=>{
 const nav=source('src/components/personal-shell.tsx');
 for(const path of ['/mon-compte','/entreprises','/finance-globale'])assert.ok(nav.includes("href: '"+path+"'"));
 assert.match(nav,/aria-expanded=\{open\}/);
 assert.match(nav,/event\.key !== 'Escape'/);
 assert.match(nav,/inert=\{!desktop && !open\}/);
 assert.match(nav,/name\?\.trim\(\)/);
 assert.match(nav,/personal-profile-copy/);
 assert.match(nav,/Espace personnel/);
 const css=source('src/app/globals.css');
 assert.match(css,/@media\(min-width:901px\)/);
 assert.match(css,/grid-template-columns:280px minmax\(0,1fr\)/);
});
test('personal profile card moves to top-right and sidebar menu toggle controls existing links',()=>{
 const shell=source('src/components/personal-shell.tsx');
 const sidebar=shell.slice(shell.indexOf('<nav id="personal-navigation"'),shell.indexOf('</nav>'));
 const topbar=shell.slice(shell.indexOf('<header className="personal-topbar">'),shell.indexOf('</header>'));
 assert.match(sidebar,/Mon espace Zaray/);
 assert.match(sidebar,/className="personal-space-toggle"/);
 assert.match(sidebar,/name="menu"/);
 assert.match(sidebar,/aria-controls="personal-space-links" aria-expanded=\{spaceMenuOpen\}/);
 assert.match(sidebar,/inert=\{!spaceMenuOpen\}/);
 assert.match(sidebar,/links\.map/);
 assert.doesNotMatch(sidebar,/personal-profile-avatar/);
 assert.match(topbar,/className="personal-topbar-profile"/);
 assert.match(topbar,/personal-profile-avatar/);
 assert.match(topbar,/\{displayName\}/);
 assert.match(topbar,/Espace personnel/);
 assert.doesNotMatch(topbar,/personal-topbar-identity/);
 assert.match(shell,/setSpaceMenuOpen\(value => !value\)/);
 assert.doesNotMatch(shell,/Mahasiloke Tinot/);
 const css=source('src/app/globals.css');
 assert.match(css,/\.personal-space-reveal\.is-open\{/);
 assert.match(css,/\.personal-topbar-profile\{/);
 assert.match(css,/@media\(max-width:480px\)/);
});

test('personal space curtain stays in sidebar header and supports outside click, keyboard and motion',()=>{
 const shell=source('src/components/personal-shell.tsx');
 const css=source('src/app/globals.css');
 const drawer=shell.slice(shell.indexOf('<nav id="personal-navigation"'),shell.indexOf('</nav>'));
 const header=drawer.slice(drawer.indexOf('<div className="personal-drawer-head">'),drawer.indexOf('</div>'));
 assert.doesNotMatch(drawer,/Mon compte ZARAY/);
 assert.match(header,/className="personal-space-toggle"/);
 assert.match(header,/Mon espace Zaray/);
 assert.equal((drawer.match(/Mon espace Zaray/g)??[]).length,1);
 assert.ok(drawer.indexOf('personal-drawer-head')<drawer.indexOf('personal-space-reveal'));
 assert.match(drawer,/className=\{'personal-space-reveal' \+ \(spaceMenuOpen \? ' is-open' : ''\)\}/);
 assert.match(drawer,/inert=\{!spaceMenuOpen\}/);
 assert.match(shell,/useState\(false\)/);
 assert.match(shell,/document\.addEventListener\('pointerdown', closeOutside\)/);
 assert.match(shell,/spaceMenuButton\.current\?\.contains\(event\.target\)/);
 assert.match(shell,/spaceMenuPanel\.current\?\.contains\(event\.target\)/);
 assert.match(shell,/event\.key !== 'Escape'/);
 for(const label of ['Tableau de bord','Mes entreprises','Finances des entreprises']) assert.ok(shell.includes("label: '"+label+"'"));
 assert.match(css,/grid-template-rows:0fr/);
 assert.match(css,/grid-template-rows:1fr/);
 assert.match(css,/210ms cubic-bezier/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.personal-shell \.personal-drawer-head \.personal-drawer-close\{display:none\}/);
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

test('personal dashboard uses only authorized enterprise finance data and clear KPI semantics',()=>{
 const page=source('src/app/mon-compte/page.tsx');
 const finance=source('src/components/personal-finance-overview.tsx');
 assert.doesNotMatch(page,/PersonalFinanceOverview/);
 const financePage=source('src/app/finance-globale/page.tsx');
 assert.match(financePage,/PersonalFinanceOverview/);
 assert.match(finance,/financeRoles\.has\(company\.role\)/);
 assert.match(finance,/\.eq\('company_id', company\.id\)/);
 assert.match(finance,/\.eq\('status', 'succeeded'\)/);
 assert.match(finance,/\.gte\('confirmed_at', start\.toISOString\(\)\)/);
 assert.match(finance,/count > 1000/);
 assert.match(finance,/financeCompanyId/);
 assert.match(finance,/monthlyByCurrency/);
 assert.match(finance,/amountsByCompany/);
 assert.match(finance,/Aucune finance privée/);
 assert.doesNotMatch(finance,/Mes finances personnelles|Solde de trésorerie disponible/);
});

test('personal home removes sidebar and business cards without deleting any business data',()=>{
 const page=source('src/app/mon-compte/page.tsx');
 const shell=source('src/components/personal-shell.tsx');
 const css=source('src/app/globals.css');
 assert.match(page,/<PersonalShell home/);
 assert.match(page,/<DailyInspiration/);
 assert.match(page,/identity\.name \? 'Bonjour, ' \+ identity\.name/);
 for(const forbidden of ['MON COMPTE ZARAY','Votre accueil personnel','Voir toutes mes entreprises','personal-business-list','personal-quick-actions','PersonalFinanceOverview','personal-email']){
   assert.doesNotMatch(page,new RegExp(forbidden));
 }
 assert.match(shell,/\{!home && <>/);
 assert.match(shell,/\{!home && email &&/);
 assert.match(css,/\.personal-shell\.personal-home-shell\{/);
 assert.match(css,/\.personal-home-shell \.personal-content\{/);
 assert.match(css,/max-width:none/);
 assert.match(css,/min-height:calc\(100dvh - 76px\)/);
});
test('daily inspiration is locally date-stable, originals-only and accessible with reduced motion',()=>{
 const quote=source('src/components/daily-inspiration.tsx');
 const match=quote.match(/dailyInspirationQuotes = (\[[\s\S]*?\]) as const;/);
 assert.ok(match,'the original quote collection must exist');
 const quotes=JSON.parse(match[1]);
 assert.ok(quotes.length >= 50);
 assert.equal(new Set(quotes).size,quotes.length);
 assert.match(quote,/Date\.UTC\(now\.getFullYear\(\), now\.getMonth\(\), now\.getDate\(\)\)/);
 assert.match(quote,/calendarDay % dailyInspirationQuotes\.length/);
 assert.match(quote,/visibilitychange/);
 assert.match(quote,/Pensée originale/);
 assert.doesNotMatch(quote,/Math\.random/);
 const css=source('src/app/globals.css');
 assert.match(css,/@keyframes zaray-home-rise/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('profile menu uses real invitation permissions and existing sign out workflow',()=>{
 const shell=source('src/components/personal-shell.tsx');
 const page=source('src/app/mon-compte/page.tsx');
 const members=source('src/app/membres/page.tsx');
 assert.match(shell,/aria-controls="personal-profile-actions" aria-expanded=\{profileOpen\}/);
 assert.match(shell,/className=\{'personal-profile-dropdown'/);
 assert.match(shell,/Inviter un collaborateur/);
 assert.match(shell,/\/membres\?companyId=/);
 assert.match(shell,/inviteCompanyId \?/);
 assert.match(shell,/aria-disabled="true"/);
 assert.match(shell,/<SignOutButton \/>/);
 assert.match(shell,/setProfileOpen\(false\)/);
 assert.match(shell,/profileRef\.current\?\.contains\(event\.target\)/);
 assert.match(page,/company\.role === 'owner' \|\| company\.role === 'admin'/);
 assert.match(members,/currentRole==='owner'\|\|currentRole==='admin'/);
 assert.match(members,/fetch\('\/api\/company-members',\{method:'POST'/);
 const signout=source('src/components/sign-out-button.tsx');
 assert.match(signout,/auth\.signOut\(\)/);
 assert.match(signout,/window\.location\.replace\('\/connexion'\)/);
});
test('home navigation remains usable after the sidebar disappears',()=>{
 const shell=source('src/components/personal-shell.tsx');
 const css=source('src/app/globals.css');
 assert.match(shell,/className="personal-home-nav-toggle"/);
 assert.match(shell,/aria-controls="personal-home-navigation-links" aria-expanded=\{homeNavOpen\}/);
 assert.match(shell,/homeNavRef\.current\?\.contains\(event\.target\)/);
 assert.match(shell,/className=\{'personal-home-nav-menu'/);
 for (const path of ['/mon-compte','/entreprises','/finance-globale']) assert.ok(shell.includes("href: '"+path+"'"));
 assert.match(css,/\.personal-home-nav-menu\.is-open/);
 assert.match(css,/position:absolute;top:calc\(100% \+ 10px\)/);
 assert.match(css,/210ms/);
});
test('the existing finance overview and its functional filters live on Finance globale',()=>{
 const financePage=source('src/app/finance-globale/page.tsx');
 const overview=source('src/components/personal-finance-overview.tsx');
 assert.match(financePage,/filtersAction="\/finance-globale"/);
 assert.match(financePage,/requestedCompanyId=\{financeCompanyId\}/);
 assert.match(financePage,/requestedCurrency=\{currency\}/);
 assert.match(overview,/action=\{filtersAction\}/);
 assert.match(overview,/\.eq\('company_id', company\.id\)/);
 assert.match(overview,/\.eq\('status', 'succeeded'\)/);
});
