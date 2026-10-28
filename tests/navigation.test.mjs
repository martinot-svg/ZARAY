import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
test('personal navigation distinguishes home and enterprise dashboard without a sidebar',()=>{
 const nav=source('src/components/personal-shell.tsx');
 for(const path of ['/mon-compte','/entreprises','/finance-globale'])
  assert.ok(nav.includes("href: '"+path+"'"));
 assert.match(nav,/personal-shell personal-no-sidebar/);
 assert.doesNotMatch(nav,/<aside\b|className=\{'personal-drawer'|personal-menu-backdrop/);
 assert.match(nav,/aria-expanded=\{homeNavOpen\}/);
 assert.match(nav,/event\.key !== 'Escape'/);
 assert.match(nav,/inert=\{!homeNavOpen\}/);
 assert.match(nav,/name\?\.trim\(\)/);
 assert.match(nav,/personal-profile-copy/);
 assert.match(nav,/Espace personnel/);
 const css=source('src/app/globals.css');
 assert.match(css,/\.personal-shell\.personal-no-sidebar\{/);
 assert.match(css,/display:flex;flex-direction:column;min-height:100dvh;width:100%/);
});
test('personal profile stays top-right and the navigation works from the topbar on every page',()=>{
 const shell=source('src/components/personal-shell.tsx');
 const topbar=shell.slice(shell.indexOf('<header className="personal-topbar">'),shell.indexOf('</header>'));
 assert.match(topbar,/Mon espace Zaray/);
 assert.match(topbar,/name="menu"/);
 assert.match(topbar,/aria-controls="personal-home-navigation-links" aria-expanded=\{homeNavOpen\}/);
 assert.match(topbar,/inert=\{!homeNavOpen\}/);
 assert.match(topbar,/navigationLinks\.map/);
 assert.match(topbar,/className="personal-topbar-profile"/);
 assert.match(topbar,/personal-profile-avatar/);
 assert.match(topbar,/\{displayName\}/);
 assert.match(topbar,/Espace personnel/);
 assert.match(shell,/setHomeNavOpen\(value => !value\)/);
 assert.doesNotMatch(shell,/Mahasiloke Tinot/);
 const css=source('src/app/globals.css');
 assert.match(css,/\.personal-home-nav-menu\.is-open\{/);
 assert.match(css,/\.personal-no-sidebar \.personal-topbar\{/);
});

test('topbar menu replaces personal sidebar with outside-click, Escape and reduced-motion support',()=>{
 const shell=source('src/components/personal-shell.tsx');
 const css=source('src/app/globals.css');
 assert.doesNotMatch(shell,/Mon compte ZARAY|personal-drawer-head|<nav id="personal-navigation"/);
 assert.equal((shell.match(/Mon espace Zaray/g)??[]).length,1);
 assert.match(shell,/className="personal-home-nav-toggle"/);
 assert.match(shell,/className=\{'personal-home-nav-menu'/);
 assert.match(shell,/inert=\{!homeNavOpen\}/);
 assert.match(shell,/document\.addEventListener\('pointerdown', closeOutside\)/);
 assert.match(shell,/homeNavRef\.current\?\.contains\(event\.target\)/);
 assert.match(shell,/event\.key !== 'Escape'/);
 for(const label of ['Mes entreprises','Finances des entreprises'])
  assert.ok(shell.includes("label: '"+label+"'"));
 assert.match(css,/\.personal-home-nav-menu\.is-open\{/);
 assert.match(css,/210ms cubic-bezier/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('company menu uses three named groups, retains routes and excludes public website link',()=>{
 const nav=source('src/components/app-shell.tsx');
 for(const section of ['GESTION','ACTIVITÉ','FINANCE & RÉSEAU'])assert.ok(nav.includes(section));
 for(const path of ['/tableau-de-bord','/sites','/membres','/clients','/offres','/commandes','/tickets','/paiements/verification','/parametres-paiement','/portail'])assert.ok(nav.includes("'"+path+"'"),path);
 assert.doesNotMatch(nav,/Voir le site public/);
 assert.match(nav,/aria-controls="zaray-app-nav"/);
 assert.match(nav,/Retour au compte personnel/);
 assert.match(nav,/SignOutButton/);
});
test('company list preserves creation route and never uses example records',()=>{
 const page=source('src/app/entreprises/page.tsx');
 const creation=source('src/app/entreprises/nouvelle/page.tsx');
 assert.match(page,/Mes entreprises/);
 assert.match(source('src/components/personal-shell.tsx'),/\+ Créer une entreprise/);
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

test('personal home and other personal pages have no sidebar or reserved left column',()=>{
 const page=source('src/app/mon-compte/page.tsx');
 const shell=source('src/components/personal-shell.tsx');
 const css=source('src/app/globals.css');
 assert.match(page,/<PersonalShell home/);
 assert.match(page,/<DailyInspiration/);
 assert.match(page,/identity\.name \? 'Bonjour, ' \+ identity\.name/);
 for(const forbidden of ['MON COMPTE ZARAY','Votre accueil personnel','Voir toutes mes entreprises','personal-business-list','personal-quick-actions','PersonalFinanceOverview','personal-email'])
  assert.doesNotMatch(page,new RegExp(forbidden));
 assert.match(shell,/personal-no-sidebar/);
 assert.match(shell,/\{!home && email &&/);
 assert.doesNotMatch(shell,/personal-drawer|personal-menu-backdrop/);
 assert.match(css,/\.personal-shell\.personal-home-shell\{/);
 assert.match(css,/\.personal-no-sidebar \.personal-content\{/);
 assert.match(css,/max-width:none/);
});
test('daily inspiration uses sourced four-topic curated library and preserves local day',()=>{
 const quote=source('src/components/daily-inspiration.tsx');
 const library=source('src/lib/daily-quote-library.ts');
 const curated=source('src/data/quotations/curated.ts');
 const route=source('src/app/api/daily-quote/route.ts');
 assert.match(curated,/export const curatedQuotes/);
 assert.match(curated,/sagesse-africaine/);
 assert.match(curated,/attraction-etat-esprit/);
 assert.match(curated,/discipline-reussite/);
 assert.match(curated,/entrepreneuriat/);
 assert.match(library,/Date\.UTC\(year, month - 1, day\)/);
 assert.match(library,/categoryIndex =/);
 assert.match(library,/inCategory\.length/);
 assert.doesNotMatch(library,/collection-[1-5]\.json/);
 assert.match(route,/getDailyQuote\(date\)/);
 assert.match(route,/Cache-Control': 'no-store'/);
 assert.match(quote,/getFullYear\(\)/);
 assert.match(quote,/getMonth\(\)/);
 assert.match(quote,/getDate\(\)/);
 assert.match(quote,/visibilitychange/);
 assert.match(quote,/Vérifier la source/);
 assert.match(quote,/daily\.quote\.author/);
 assert.match(quote,/daily\.quote\.sourceTitle/);
 assert.match(quote,/daily\.quote\.country/);
 assert.match(quote,/daily\.quote\.principle/);
 assert.doesNotMatch(quote,/Math\.random|dailyInspirationQuotes/);
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
 assert.match(shell,/Z’Alliance/);
 assert.match(shell,/href="\/z-alliance"/);
 assert.match(shell,/inviteCompanyId \?/);
 assert.match(shell,/aria-disabled="true"/);
 assert.match(shell,/<SignOutButton profile \/>/);
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


test('profile sign out says Quitter mon espace with Sidebar icon and preserves existing session logic',()=>{
 const signout=source('src/components/sign-out-button.tsx');
 const shell=source('src/components/personal-shell.tsx');
 const icons=source('src/components/ui/zaray-icon.tsx');
 const css=source('src/app/globals.css');
 assert.match(shell,/<SignOutButton profile \/>/);
 assert.match(shell,/Z’Alliance/);
 assert.match(shell,/href="\/z-alliance"/);
 assert.match(shell,/aria-disabled="true"/);
 assert.match(signout,/profile \? "sidebar" : "logout"/);
 assert.match(signout,/profile \? 'Quitter mon espace' : 'Se déconnecter'/);
 assert.match(icons,/sidebar: PanelLeft/);
 assert.match(css,/\.personal-profile-dropdown \.account-signout button\{transition:background-color 180ms ease,color 180ms ease\}/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.personal-profile-dropdown \.account-signout button\{transition:none\}\}/);
 assert.match(signout,/createClient\(\)\.auth\.signOut\(\)/);
 assert.match(signout,/window\.location\.replace\('\/connexion'\)/);
});


test('company selection only comes from the personal enterprise list',()=>{
 const shell=source('src/components/personal-shell.tsx');
 const workspace=source('src/components/app-shell.tsx');
 assert.doesNotMatch(shell,/label: 'Tableau de bord'/);
 assert.match(shell,/label: 'Mes entreprises'/);
 assert.match(workspace,/Changer d’entreprise/);
 assert.doesNotMatch(workspace,/aria-label="Entreprise active" value=/);
 const management=source('src/app/tableau-de-bord/page.tsx');
 assert.match(management,/authorizeTenant\(client, companyId\)/);
});

test('daily inspirations are curated in French with original verifiable sources',()=>{
 const route=source('src/app/api/daily-quote/route.ts');
 const translation=source('src/lib/french-daily-quote.ts');
 const page=source('src/components/daily-inspiration.tsx');
 const library=source('src/lib/daily-quote-library.ts');
 const curated=source('src/data/quotations/curated.ts');
 assert.match(route,/await getFrenchDailyQuote\(date\)/);
 assert.match(route,/quoteLibrary\.length/);
 assert.match(route,/Date\.UTC\(today\.getUTCFullYear\(\)/);
 assert.match(translation,/return getDailyQuote\(localDate\)/);
 assert.doesNotMatch(translation,/mymemory|TRANSLATION_ENDPOINT|originalFrenchFallback/);
 assert.match(curated,/language: 'fr'/);
 assert.match(page,/lang="fr"/);
 assert.match(page,/Adaptation française d’un texte original/);
 assert.match(page,/daily\.quote\.sourceUrl/);
 assert.match(page,/Vérifier la source/);
 assert.match(page,/daily\.quote\.country/);
 assert.match(page,/daily\.quote\.principle/);
 assert.doesNotMatch(page,/lang="en"|Texte en anglais/);
 assert.match(library,/quoteLibrary: CuratedQuote\[\]/);
});

test('navigation has no fullscreen loading boundaries or placeholder skeletons',()=>{
 const appRoot=fileURLToPath(new URL('../src/app/',import.meta.url));
 const files=[];
 const visit=(dir)=>{
   for(const entry of readdirSync(dir)){
     const full=join(dir,entry);
     if(statSync(full).isDirectory()) visit(full);
     else files.push(full);
   }
 };
 visit(appRoot);
 assert.equal(files.filter(f=>f.endsWith('/loading.tsx')).length,0,'do not insert route loading screens');
 for(const full of files.filter(f=>f.endsWith('/page.tsx'))){
   const page=readFileSync(full,'utf8');
   assert.doesNotMatch(page,/<MotionSkeleton\b|className="skeleton-list"/,full+' should not flash a placeholder');
 }
 const dashboard=source('src/components/dashboard-workspace.tsx');
 assert.doesNotMatch(dashboard,/if\(busy\)return null;/);
 assert.match(dashboard,/if\(busy\|\|error\|\|!payload\)return <AppShell/);
 assert.doesNotMatch(dashboard,/Chargement du tableau de bord|MotionSkeleton/);
 const shell=source('src/components/app-shell.tsx');
 assert.doesNotMatch(shell,/Chargement du contexte…/);
});


test('ZARAY uses no permanent or off-canvas black sidebars in personal or company pages',()=>{
 const personal=source('src/components/personal-shell.tsx');
 const company=source('src/components/app-shell.tsx');
 const css=source('src/app/globals.css');
 assert.doesNotMatch(personal,/<aside\b|personal-drawer|personal-menu-backdrop/);
 assert.doesNotMatch(company,/<aside\b|app-nav-scrim|className=\{\`app-nav/);
 assert.match(company,/className="app-shell app-no-sidebar"/);
 assert.match(company,/className="app-menu-container"/);
 assert.match(company,/className=\{'app-nav-dropdown'/);
 assert.match(company,/aria-controls="zaray-app-nav" aria-expanded=\{menuOpen\}/);
 assert.match(company,/inert=\{!menuOpen\} aria-hidden=\{!menuOpen\}/);
 assert.match(company,/document\.addEventListener\('pointerdown', closeOutside\)/);
 assert.match(company,/firstMenuLink\.current\?\.focus\(\)/);
 assert.match(company,/<SignOutButton \/>/);
 assert.match(css,/\.app-shell\.app-no-sidebar \.app-main\{\s*margin-left:0/);
 assert.match(css,/\.app-no-sidebar \.app-menu-button\{\s*display:inline-flex/);
 assert.match(css,/\.app-no-sidebar \.app-nav-dropdown\{/);
 assert.match(css,/@media\(max-width:700px\)/);
});

test('Z’Alliance is a real protected workspace with existing Supabase invitation flow',()=>{
 const shell=source('src/components/personal-shell.tsx');
 const route=source('src/app/z-alliance/page.tsx');
 const ui=source('src/components/z-alliance-workspace.tsx');
 const api=source('src/app/api/company-members/route.ts');
 const icon=source('src/components/ui/zaray-icon.tsx');
 const css=source('src/app/globals.css');
 assert.match(shell,/href="\/z-alliance"/);
 assert.match(shell,/Z’Alliance/);
 assert.doesNotMatch(shell,/Inviter un collaborateur/);
 assert.match(icon,/alliance: UsersRound/);
 assert.match(route,/loadPersonalContext\(\)/);
 assert.match(route,/<PersonalShell home active="\/z-alliance"/);
 assert.match(ui,/manageable\(company\.role\)/);
 assert.match(ui,/company\?\.role === 'owner'/);
 assert.match(ui,/role\.value !== 'admin' && role\.value !== 'finance'/);
 assert.match(ui,/emailConfigured \? '\/api\/z-alliance' : '\/api\/company-members'/);
 assert.match(ui,/fetch\('\/api\/audit-logs/);
 assert.match(ui,/submitting\.current/);
 assert.match(ui,/Aucun e-mail n’a été envoyé/);
 assert.match(ui,/état d’envoi est indiqué séparément/);
 assert.match(ui,/Mes invitations reçues/);
 assert.match(ui,/member\.status === 'active'/);
 assert.match(api,/rpc\('create_company_invitation'/);
 assert.match(api,/rpc\('list_company_members'/);
 assert.match(css,/\.zalliance-sections/);
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(shell,/<SignOutButton profile \/>/);
});


test('Z’Alliance secure emails and atomic invitation acceptance are guarded',()=>{
 const sql=source('db/migrations/20261027173000_zalliance_invitation_security.sql');
 const api=source('src/app/api/z-alliance/route.ts');
 const email=source('src/lib/zalliance-email.ts');
 const accept=source('src/app/api/z-alliance/accept/route.ts');
 const preview=source('src/app/api/z-alliance/preview/route.ts');
 const welcome=source('src/app/z-alliance/accepter/page.tsx');
 const login=source('src/app/connexion/page.tsx');
 assert.match(sql,/extensions.gen_random_bytes\(32\)/);
 assert.match(sql,/extensions.digest\(p_token,'sha256'\)/);
 assert.match(sql,/for update/);
 assert.match(sql,/zalliance_accept_invitation/);
 assert.match(sql,/zalliance_preview_invitation/);
 assert.match(sql,/zalliance_revoke_invitation/);
 assert.match(sql,/zalliance_resend_invitation/);
 assert.match(sql,/grant execute on function public.zalliance_mark_delivery\(uuid,text,boolean\) to service_role/);
 assert.match(sql,/v_inv.email<>v_email/);
 assert.match(api,/mailReadiness\(\).ready/);
 assert.match(api,/authorizeTenant\(client, companyId\)/);
 assert.match(api,/markInvitationDelivery\(invitation,true\)/);
 assert.match(email,/createHash\('sha256'\)/);
 assert.match(email,/https:\/\/api.resend.com\/emails/);
 assert.match(email,/\/z-alliance\/accepter#token=/);
 assert.doesNotMatch(email,/NEXT_PUBLIC_RESEND_API_KEY/);
 assert.match(accept,/zalliance_accept_invitation/);
 assert.match(preview,/zalliance_preview_invitation/);
 assert.match(welcome,/window.history.replaceState/);
 assert.match(welcome,/sessionStorage.setItem\(STORAGE,raw\)/);
 assert.match(welcome,/company_name/);
 assert.match(login,/sessionStorage.getItem\('zaray:pending-alliance-invitation'\)/);
});

test('shared living galaxy replaces the bitmap without altering application navigation',()=>{
 const css=source('src/app/globals.css');
 const personal=source('src/components/personal-shell.tsx');
 const company=source('src/components/app-shell.tsx');
 const galaxy=source('src/components/galaxy-backdrop.tsx');
 assert.match(css,/\.zaray-galaxy-backdrop\{/);
 assert.match(css,/position:fixed;inset:0;z-index:0/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/background-image:none/);
 assert.doesNotMatch(css,/zaray-reference-texture\.avif/);
 const backdrop=source('src/components/workspace-backdrop.tsx');
 const root=source('src/app/layout.tsx');
 assert.match(backdrop,/return <GalaxyBackdrop\s*\/>;/);
 assert.doesNotMatch(backdrop,/usePathname|const prefixes/);
 assert.match(root,/<WorkspaceBackdrop \/>/);
 assert.doesNotMatch(personal,/<GalaxyBackdrop \/>/);
 assert.doesNotMatch(company,/<GalaxyBackdrop \/>/);
 assert.match(personal,/aria-controls="personal-home-navigation-links"/);
 assert.match(company,/aria-controls="zaray-app-nav"/);
 assert.match(galaxy,/aria-hidden="true"/);
 assert.match(css,/\.personal-no-sidebar \.personal-home-quote-author\{/);
 assert.match(css,/\.app-no-sidebar \.page-header \.app-title/);
});


test('Wi-Fi tickets has exactly one main navigation entry and three internal views',()=>{
 const app=source('src/components/app-shell.tsx');
 const menu=app.match(/\{ label: 'ACTIVITÉ', items: \[(.+?)\] \}/)?.[1]??'';
 assert.equal((menu.match(/'\/tickets', 'Tickets Wi-Fi'/g)??[]).length,1);
 assert.doesNotMatch(menu,/Planches A4|Personnaliser tickets|\/tickets\/planches|\/personnalisation-tickets/);
 const page=source('src/app/tickets/page.tsx');
 assert.match(page,/WifiTicketGenerator/);
 assert.match(page,/WifiTicketHistory/);
 assert.match(page,/WifiTicketCustomization/);
 for(const name of ['Générer','Historique','Personnalisation'])assert.ok(page.includes(name));
 assert.match(page,/isManager\(company\.role\)/);
 assert.match(page,/setVisited/);
 assert.match(page,/aria-label="Onglets du module Tickets Wi-Fi"/);
 for(const filename of ['wifi-ticket-generator.tsx','wifi-ticket-history.tsx','wifi-ticket-customization.tsx']){
  const view=source('src/components/'+filename);
  assert.doesNotMatch(view,/<AppShell\b/);
 }
 const sheets=source('src/app/tickets/planches/page.tsx');
 const settings=source('src/app/personnalisation-tickets/page.tsx');
 for(const old of [sheets,settings])assert.match(old,/redirect\('\/tickets\?' \+ qs\.toString\(\)\)/);
});


test('premium Wi-Fi templates use the existing single module and preserve 33 A4 tickets',()=>{
 const page=source('src/app/tickets/page.tsx');
 const generator=source('src/components/wifi-ticket-generator.tsx');
 const customize=source('src/components/wifi-ticket-customization.tsx');
 const pdf=source('src/lib/ticket-pdf.ts');
 const canvas=source('src/components/voucher-canvas.tsx');
 const api=source('src/app/api/ticket-templates/route.ts');
 const issue=source('src/app/api/wifi-vouchers/route.ts');
 const migration=source('db/migrations/20261027_wifi_premium_visual_templates.sql');
 assert.match(page,/WifiTicketGenerator/);
 assert.match(page,/WifiTicketCustomization/);
 assert.match(page,/type Tab = 'generate' \| 'history' \| 'customize'/);
 for(const k of ['pageWidthMm:210','pageHeightMm:297','voucherWidthMm:60','voucherHeightMm:20',
 'columns:3','rows:11','perPage:33','leftMm:10','topMm:21','columnGapMm:5','rowGapMm:3.5','dpi:150'])
  assert.ok(pdf.includes(k),'Print geometry must remain fixed: '+k);
 assert.match(generator,/voucherPages\(tickets\)/);
 assert.match(generator,/grid-template-columns:repeat\(3,60mm\)/);
 assert.match(generator,/grid-template-rows:repeat\(11,20mm\)/);
 assert.match(generator,/@page\{size:A4 portrait;margin:0\}/);
 assert.match(generator,/<VoucherCanvas ticket=\{ticket\}/);
 assert.match(canvas,/paintVoucher\(ctx,0,0,ticket,design,siteName/);
 assert.match(pdf,/paintVoucher\(ctx,x,y,arr\[i\],sheet\.design/);
 assert.match(generator,/generateA4Pdf\(/);
 assert.match(customize,/<VoucherCanvas preview/);
 for(const style of ["classic","event","minimal","corporate"])assert.ok(customize.includes("key:'"+style+"'"));
 assert.match(customize,/Enregistrer comme modèle/);
 assert.match(customize,/Aperçu en direct/);
 assert.match(api,/authorizeTenant\(supabase,companyId,siteId\)/);
 assert.match(migration,/alter table public.ticket_templates/);
 assert.match(pdf,/NON ACTIVÉ/);
 assert.match(pdf,/ticket.duration_minutes\+' min/);
 assert.match(pdf,/String\(ticket.price_amount\)/);
 assert.match(issue,/credential_hash:await sha256\(siteId\+':'\+username\+':'\+password\)/);
 assert.match(issue,/const batchId=crypto.randomUUID\(\)/);
 assert.match(issue,/status:'available'/);
 assert.doesNotMatch(customize,/AppShell/);
});


test('personal topbar places logo first and company creation beside profile, without extra items',()=>{
 const shell=source('src/components/personal-shell.tsx');
 const page=source('src/app/entreprises/page.tsx');
 const css=source('src/app/globals.css');
 const header=shell.slice(shell.indexOf('<header className="personal-topbar">'),shell.indexOf('</header>'));
 const logo=header.indexOf('className="personal-logo"');
 const menu=header.indexOf('className="personal-home-nav-control"');
 const create=header.indexOf('className="primary-link personal-topbar-create"');
 const profile=header.indexOf('className="personal-profile-control"');
 assert.ok(logo>=0 && logo<menu && menu<create && create<profile);
 assert.match(header,/active === '\/entreprises' &&/);
 assert.match(header,/href="\/entreprises\/nouvelle"/);
 assert.match(shell,/!home && email && active !== '\/entreprises'/);
 assert.doesNotMatch(page,/ESPACE PERSONNEL|Uniquement les organisations|href="\/entreprises\/nouvelle"/);
 assert.match(page,/personal-page-heading personal-enterprises-heading/);
 assert.match(page,/company\.legal_name/);
 assert.match(css,/\.personal-no-sidebar \.personal-enterprises-heading\{/);
 assert.match(css,/\.personal-topbar-actions \.personal-profile-control\{margin-left:0\}/);
});


test('Open enterprise is a client route and dashboard never returns a blank frame while awaiting data',()=>{
 const enterprises=source('src/app/entreprises/page.tsx');
 const route=source('src/app/tableau-de-bord/page.tsx');
 const site=source('src/app/sites/[siteId]/page.tsx');
 const dashboard=source('src/components/dashboard-workspace.tsx');
 const shell=source('src/components/app-shell.tsx');
 const personal=source('src/components/personal-shell.tsx');
 const root=source('src/app/layout.tsx');
 const css=source('src/app/globals.css');
 assert.match(enterprises,/import Link from 'next\/link'/);
 assert.match(enterprises,/<Link prefetch=\{true\} className="primary-link" href=\{'\/tableau-de-bord\?companyId='/);
 assert.match(route,/authorizeTenant\(client, companyId\)/);
 assert.match(route,/<DashboardWorkspace companyId=\{companyId\} \/>/);
 assert.match(site,/<DashboardWorkspace companyId=\{companyId\} siteId=\{siteId\} \/>/);
 assert.doesNotMatch(dashboard,/if\(busy\)return null/);
 assert.match(dashboard,/if\(busy\|\|error\|\|!payload\)return <AppShell/);
 assert.match(dashboard,/aria-busy=\{busy\}/);
 assert.match(dashboard,/const query=new URLSearchParams\(\{companyId\}\)/);
 assert.match(dashboard,/fetch\('\/api\/dashboard\?'\+query\.toString\(\)/);
 assert.doesNotMatch(dashboard,/fetch\('\/api\/sites'/);
 assert.doesNotMatch(dashboard,/window\.location\.replace\(/);
 assert.match(shell,/router\.push\(next\?/);
 assert.doesNotMatch(shell,/window\.location\.assign/);
 assert.match(shell,/import Link from 'next\/link'/);
 assert.doesNotMatch(personal,/prefetch=\{false\}/);
 assert.match(root,/<WorkspaceBackdrop \/>/);
 assert.match(css,/body:has\(\.app-shell\.app-no-sidebar\)/);
 assert.match(css,/\.app-no-sidebar \.app-content,/);
});


test('personal header remains sticky only on the three requested personal pages',()=>{
 const shell=source('src/components/personal-shell.tsx');
 const css=source('src/app/globals.css');
 assert.match(shell,/\['\/mon-compte', '\/entreprises', '\/finance-globale'\]\.includes\(active\)/);
 assert.match(shell,/personal-sticky-topbar/);
 assert.match(css,/\.personal-shell\.personal-sticky-topbar > \.personal-topbar\{\s*position:sticky;\s*top:0;\s*z-index:90;/);
 assert.match(css,/html:has\(\.personal-sticky-topbar\)/);
 assert.match(css,/scrollbar-width:none/);
 assert.match(css,/::-webkit-scrollbar/);
 assert.doesNotMatch(css.slice(css.indexOf('/* Personal workspace (Z\'Accueil, Mes entreprises, Finance globale):')),/overflow:\s*hidden/);
 assert.match(shell,/active === '\/entreprises' &&/);
});

test('finance page has only its title above the existing payments and filters',()=>{
 const page=source('src/app/finance-globale/page.tsx');
 const shell=source('src/components/personal-shell.tsx');
 const css=source('src/app/globals.css');
 assert.match(page,/<header className="personal-page-heading personal-finance-page-heading"><h1>Finance globale<\/h1><\/header>/);
 assert.doesNotMatch(page,/COMPTE PERSONNEL · FINANCE|Consolidation des paiements confirmés du registre uniquement/);
 assert.match(shell,/active !== '\/entreprises' && active !== '\/finance-globale'/);
 assert.match(page,/PersonalFinanceOverview/);
 assert.match(page,/filtersAction="\/finance-globale"/);
 assert.match(page,/hasPayments/);
 assert.match(css,/\.personal-no-sidebar \.personal-finance-page-heading\{/);
 assert.match(css,/\.personal-no-sidebar \.personal-finance-page-heading h1\{margin:0\}/);
});
