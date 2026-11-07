import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

// Browser rendering of the ACTUAL shared CSS, including all the legacy layers.
// Fixtures use the same classes/markup as authenticated React shells, without
// fabricating a logged-in session or interacting with production business data.
const read=path=>readFileSync(path,'utf8');
const layout=read('src/app/layout.tsx');
const cssPaths=[...layout.matchAll(/import '\.\/(.+?\.css)';/g)].map(m=>'src/app/'+m[1]);
cssPaths.push('src/app/commandes/orders-workspace.css','src/app/abonnements/residential-subscriptions.css');
const dir='artifacts/premium-visual';
mkdirSync(dir,{recursive:true});

const companyLabel='Mlay Connexion – Entreprise régionale de gestion des abonnements et accès sans fil';
const longest='Personnalisation et vérification complète des autorisations et des abonnements résidentiels';
const html=`<!doctype html><html lang="fr" data-zaray-theme="dark">
<head><meta charset="utf-8"></head><body>
  <div class="app-shell app-no-sidebar" data-workspace-chapter="mint">
    <div class="app-main"><nav class="workspace-breadcrumb"><span>Compte ZARAY /</span><a href="#company"><svg></svg><span class="zaray-nav-label-text">${companyLabel.repeat(3)} · Vue générale</span></a></nav>
      <header class="app-topbar zaray-icon-topbar">
        <a class="app-topbar-brand">ZARAY</a>
        <h1 class="app-topbar-title">Administration des abonnements résidentiels de l'entreprise</h1>
        <div class="app-topbar-links"><div class="app-menu-container">
          <button class="app-menu-button">Menu</button>
          <nav id="app-menu-fixture" class="app-nav-dropdown is-open" aria-label="Navigation de l'entreprise">
            <div class="app-nav-current-context"><span class="app-nav-label">ENTREPRISE</span><strong>${companyLabel}</strong>
              <span>Site de gestion des réseaux résidentiels métropolitains</span></div>
            <div class="app-nav-rail">
              <div class="app-nav-flyout">
                <button class="app-nav-flyout-trigger is-active">
                  <svg width="20" height="20"></svg><span class="zaray-nav-label-text">Pilotage et statistiques avancées</span><svg width="17" height="17"></svg>
                </button>
                <div class="app-nav-flyout-panel is-open">
                  <div class="app-nav-flyout-heading">Pilotage</div>
                  <a class="app-nav-link" href="#site"><svg></svg><span class="zaray-nav-label-text">Tableau de bord du site</span></a>
                  <a class="app-nav-link" href="#access"><svg></svg><span class="zaray-nav-label-text">${longest}</span></a>
                </div>
              </div>
              <div class="app-nav-flyout"><button class="app-nav-flyout-trigger">
                <svg width="20" height="20"></svg><span class="zaray-nav-label-text">Clients et abonnements résidentiels</span><svg width="17" height="17"></svg>
              </button></div>
            </div>
            <div class="app-nav-footer">
              <a class="app-nav-link"><svg></svg><span class="zaray-nav-label-text">Changer d'entreprise et revenir aux paramètres généraux</span></a>
              <button class="zaray-theme-switch app-nav-theme-switch"><span class="zaray-theme-icon">☀</span><span class="zaray-theme-switch-label">Passer au mode clair</span></button>
              <div class="account-signout"><button><svg></svg><span class="zaray-nav-label-text">Se déconnecter de l'espace de travail</span></button></div>
            </div>
          </nav>
        </div><div class="app-site-container"><button class="app-site-button">Site</button>
          <div id="site-fixture" class="app-site-dropdown is-open" role="group">
            <p class="app-site-heading">Site actif</p>
            <button class="app-site-option"><svg></svg> Site de gestion des réseaux résidentiels métropolitains – antenne administrative</button>
          </div>
        </div></div>
      </header>
      <main class="app-content">
        <div class="co-tabs" role="tablist"><button role="tab"><svg></svg>Toutes les commandes de l'entreprise</button>
          <button role="tab">À traiter avec justificatif</button><button role="tab">Historique et rapprochement des encaissements</button></div>
        <div class="rs-tabs" role="tablist"><button role="tab">Abonnements résidentiels et renouvellements en cours</button>
          <button role="tab">Expirations et suspensions administratives</button></div>
        <nav class="panel" aria-label="Onglets du module Tickets Wi-Fi" style="padding:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="header-link"><svg></svg>Personnalisation des tickets Wi-Fi</button>
          <button class="header-link"><svg></svg>Historique des ventes occasionnelles</button>
        </nav>
      </main>
    </div>
    <nav class="workspace-mobile-dock"><a class="workspace-mobile-dock-link"><svg></svg><span>Accueil</span></a>
      <a class="workspace-mobile-dock-link"><svg></svg><span>Abonnements</span></a>
      <a class="workspace-mobile-dock-link"><svg></svg><span>Commandes</span></a>
      <a class="workspace-mobile-dock-link"><svg></svg><span>Sites</span></a></nav>
  </div>
  <div id="desktop-curtain" class="zaray-flyout-portal" data-side="left" style="left:calc(50vw - 175px);top:205px">
    <div class="app-nav-flyout-heading">Pilotage</div>
    <a class="app-nav-link" href="#site"><svg></svg><span class="zaray-nav-label-text">Tableau de bord du site</span></a>
    <a class="app-nav-link" href="#long"><svg></svg><span class="zaray-nav-label-text">${longest}</span></a>
    <a class="app-nav-link" href="#overview"><svg></svg><span class="zaray-nav-label-text">Vue générale et statistiques</span></a>
  </div>
  <div class="personal-shell personal-no-sidebar">
    <header class="personal-topbar">
      <a class="personal-logo">ZARAY</a>
      <h1 class="personal-topbar-module-title">Finances globales des entreprises et des sites</h1>
      <div class="personal-home-nav-control"><button class="personal-home-nav-toggle">Menu</button>
        <nav id="personal-menu-fixture" class="personal-home-nav-menu is-open">
          <a class="personal-nav-link"><svg></svg><span class="zaray-nav-label-text">${longest}</span></a>
          <a class="personal-nav-link"><svg></svg><span class="zaray-nav-label-text">Finances des entreprises</span></a>
        </nav>
      </div>
      <div class="personal-topbar-actions">
        <div class="personal-profile-control"><button class="personal-topbar-profile">Profil</button>
          <div id="personal-profile-fixture" class="personal-profile-dropdown is-open">
            <a class="personal-profile-action"><svg></svg><span class="zaray-nav-label-text">Z'Alliance et gestion des invitations de l'entreprise</span></a>
            <div class="account-signout"><button><svg></svg><span class="zaray-nav-label-text">Quitter mon espace et me déconnecter</span></button></div>
          </div>
        </div>
      </div>
    </header>
    <nav class="personal-mobile-dock"><a class="personal-mobile-dock-link"><svg></svg><span>Accueil</span></a>
      <a class="personal-mobile-dock-link"><svg></svg><span>Entreprises</span></a>
      <a class="personal-mobile-dock-link"><svg></svg><span>Finances</span></a></nav>
  </div>
</body></html>`;

const cases=[
  {name:'small-mobile',width:320,height:690},
  {name:'mobile',width:390,height:844},
  {name:'tablet',width:820,height:1180},
  {name:'desktop',width:1366,height:860},
  {name:'wide-desktop',width:1920,height:1080},
];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try {
  for(const viewport of cases) {
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},
      reducedMotion:'reduce',isMobile:viewport.width<=390,hasTouch:viewport.width<=820});
    await page.setContent(html,{waitUntil:'domcontentloaded'});
    for(const path of cssPaths)await page.addStyleTag({content:read(path)});
    // Separate the two full-screen workspaces; test each independently.
    for(const mode of ['company','personal'])for(const theme of ['dark','light']) {
      await page.locator('html').evaluate((el,v)=>el.setAttribute('data-zaray-theme',v),theme);
      await page.locator('.app-shell').evaluate((el,show)=>el.style.display=show?'block':'none',mode==='company');
      await page.locator('.personal-shell').evaluate((el,show)=>el.style.display=show?'block':'none',mode==='personal');
      await page.locator('#desktop-curtain').evaluate((el,show)=>el.style.display=show?'grid':'none',
        mode==='company'&&viewport.width>=850);
      if (mode==='personal') {
        // Apply the same trigger-side selection used by PersonalShell at open time.
        await page.locator('.personal-home-nav-control').evaluate(el=>{
          const rect=el.getBoundingClientRect();
          const width=Math.min(390,innerWidth-24);
          el.setAttribute('data-menu-align',
            rect.left+width>innerWidth-12?'end':'start');
        });
      }
      // Check each menu independently to avoid fixture-only overlap.
      for(const openSelector of mode==='company'
        ? ['#app-menu-fixture','#site-fixture',...(viewport.width>=850?['#desktop-curtain']:[])]
        : ['#personal-menu-fixture','#personal-profile-fixture']) {
        for(const selector of ['#app-menu-fixture','#site-fixture','#desktop-curtain',
          '#personal-menu-fixture','#personal-profile-fixture']) {
          const element=page.locator(selector);
          await element.evaluate((el,show)=>{el.style.display=show?'':'none';},selector===openSelector);
        }
        const outcome=await page.locator(openSelector).evaluate(el=>{
          const root=el.getBoundingClientRect();
          const labels=[...el.querySelectorAll('strong,.zaray-nav-label-text,.app-site-option,.app-site-heading,.app-nav-flyout-heading')]
            .filter(node => {
              // Desktop keeps a noninteractive inline fallback in the DOM; its real
              // links are rendered by the visible portal. Never fail invisible nodes.
              for(let ancestor=node;ancestor&&ancestor!==el;ancestor=ancestor.parentElement){
                const css=getComputedStyle(ancestor);
                if(css.display==='none'||css.visibility==='hidden')return false;
              }
              return true;
            });
          const result=labels.map(node=>{
            const box=node.getBoundingClientRect();
            const parent=node.closest('.app-nav-link,.app-nav-flyout-trigger,.app-site-option,.personal-nav-link,.personal-profile-action,.account-signout button')||node.parentElement;
            const bounds=parent.getBoundingClientRect();
            const range=document.createRange();range.selectNodeContents(node);
            const fragments=[...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom}));
            return {label:(node.textContent||'').trim().slice(0,80),
              spill:box.right>bounds.right+2||box.left<bounds.left-2||box.right>innerWidth+2,
              fragmentsOutside:fragments.some(r=>r.right>bounds.right+2||r.left<bounds.left-2),
              height:box.height,scroll:node.scrollWidth>node.clientWidth+2,
              whiteSpace:getComputedStyle(node).whiteSpace};
          });
          return {rootWidth:root.width,rootLeft:root.left,rootRight:root.right,
            visibleRoot:root.width>0&&root.left>=-2&&root.right<=innerWidth+2,
            offenders:result.filter(item=>item.spill||item.scroll||item.fragmentsOutside||item.height===0)};
        });
        assert.ok(outcome.visibleRoot,
          [viewport.name,mode,theme,openSelector,'root box '+JSON.stringify(outcome)].join(' '));
        assert.deepEqual(outcome.offenders,[],
          [viewport.name,mode,theme,openSelector,'labels overflow'].join(' '));
      }
      if(mode==='company') {
        const breadcrumb=await page.locator('.workspace-breadcrumb a').evaluate(el=>{
          const r=el.getBoundingClientRect();
          return {right:r.right,scroll:el.scrollWidth,width:el.clientWidth};
        });
        assert.ok(breadcrumb.right<=viewport.width+2, 'long breadcrumb stays inside viewport');
        assert.ok(breadcrumb.scroll<=breadcrumb.width+2, 'long breadcrumb text fits');
      }
      // Header titles must wrap rather than report text-overflow:ellipsis.
      const titleSelector=mode==='company'?'.app-topbar-title':'.personal-topbar-module-title';
      const title=await page.locator(titleSelector).evaluate(el=>({
        whiteSpace:getComputedStyle(el).whiteSpace,overflow:getComputedStyle(el).overflow,
        scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
      assert.equal(title.whiteSpace,'normal',viewport.name+' '+mode+' title wraps');
      assert.ok(title.scrollWidth<=title.clientWidth+2,viewport.name+' '+mode+' title not truncated');
      // Touch navigation docks show all their labels.
      if(viewport.width<=700){
        const dockSelector=mode==='company'?'.workspace-mobile-dock':'.personal-mobile-dock';
        const labels=await page.locator(dockSelector+' span').evaluateAll(nodes=>nodes.map(node=>({
          w:node.clientWidth,s:node.scrollWidth,wrap:getComputedStyle(node).whiteSpace,
          overflow:getComputedStyle(node).overflow})));
        for(const label of labels) {
          assert.ok(label.s<=label.w+2,viewport.name+' '+mode+' dock does not truncate');
          assert.equal(label.wrap,'normal');
        }
      }
      // Module-level tabs and navigation must wrap long values, not scroll on one line.
      if(mode==='company')for(const selector of ['.co-tabs','.rs-tabs',
        'nav[aria-label="Onglets du module Tickets Wi-Fi"]']){
        const tabs=await page.locator(selector+' button').evaluateAll(nodes=>nodes.map(el=>({
          scroll:el.scrollWidth,width:el.clientWidth,nowrap:getComputedStyle(el).whiteSpace})));
        for(const tab of tabs){
          assert.equal(tab.nowrap,'normal',viewport.name+' '+selector+' no nowrap');
          assert.ok(tab.scroll<=tab.width+2,viewport.name+' '+selector+' no overflow');
        }
      }
      await page.screenshot({path:`${dir}/navigation-layout-${viewport.name}-${mode}-${theme}.png`,
        animations:'disabled'});
      console.log(viewport.name,mode,theme,'navigation labels fit');
    }
    await page.close();
  }
}finally{await browser.close();}
