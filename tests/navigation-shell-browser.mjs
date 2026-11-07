import {build} from 'esbuild';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

// Render the production React shells; replace only Next routing, auth and
// decorative canvases. No authenticated session or production data is used.
const bundle=await build({stdin:{contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import AppShell from './src/components/app-shell';
import PersonalShell from './src/components/personal-shell';
const personal=location.hash==='#personal';
createRoot(document.getElementById('root')).render(personal
 ? <PersonalShell active="/finance-globale" email="test@example.test" name="Utilisateur de test"><p>Contenu</p></PersonalShell>
 : <AppShell activePath="/clients" companyId="company" siteId="site" title="Administration des abonnements résidentiels"><p>Contenu</p></AppShell>);
`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',plugins:[{
 name:'test-boundaries',setup(b){
  const replacements={
   'next/link':`import React from 'react'; export default function Link(p){return <a {...p}/>}`,
   'next/image':`import React from 'react'; export default function Image({priority,unoptimized,...p}){return <img {...p}/>}`,
   'next/navigation':`export const useRouter=()=>({push:()=>{},refresh:()=>{}}); export const usePathname=()=>'/clients';`,
   '@/lib/workspace-directory-request':`export const fetchWorkspaceDirectory=async()=>new Response(JSON.stringify({companies:[{id:'company',legal_name:'Entreprise régionale de gestion des abonnements et des accès sans fil',role:'owner'}],sites:[{id:'site',company_id:'company',name:'Site de gestion des réseaux résidentiels métropolitains'}]}));`,
   '@/components/sign-out-button':`import React from 'react';export default function SignOut(){return <div className="account-signout"><button>Se déconnecter</button></div>}`,
   '@/components/rotating-earth-horizon':'export default function Empty(){return null}',
   '@/components/zaccueil-asteroids':'export default function Empty(){return null}',
  };
  b.onResolve({filter:/.*/},args=>args.path in replacements?{path:args.path,namespace:'test'}:undefined);
  b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:replacements[args.path],loader:'jsx',resolveDir:process.cwd()}));
 }
}]});
const styles=[...readFileSync('src/app/layout.tsx','utf8').matchAll(/import '\.\/(.+?\.css)';/g)]
 .map(m=>readFileSync('src/app/'+m[1],'utf8')).join('\n');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [320,390,820,1366,1920])for(const mode of ['company','personal']){
  const page=await browser.newPage({viewport:{width,height:900},isMobile:width<500,hasTouch:width<850,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://navigation.test/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="fr" data-zaray-theme="dark"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body><div id="root"></div></body></html>`}));
  await page.goto('https://navigation.test/'+(mode==='personal'?'#personal':''));
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const button=page.locator(mode==='company'?'.app-menu-button':'button.personal-home-nav-toggle');
  if(mode==='personal'&&width>=850)await button.hover();else await button.click();
  await page.waitForFunction(selector=>document.querySelector(selector)?.getAttribute('aria-expanded')==='true',mode==='company'?'.app-menu-button':'button.personal-home-nav-toggle');
  const check=async(selector)=>{
   const boxes=await page.locator(selector).evaluateAll(nodes=>nodes.filter(e=>e.getBoundingClientRect().width>0).map(e=>{
    const r=e.getBoundingClientRect();return {text:e.textContent,left:r.left,right:r.right,scroll:e.scrollWidth,width:e.clientWidth};
   }));
   assert.ok(boxes.length,selector+' visible');
   for(const r of boxes)assert.ok(r.left>=-1&&r.right<=width+1&&r.scroll<=r.width+2,JSON.stringify({width,mode,...r}));
  };
  if(mode==='company'){
   await page.waitForSelector('.app-nav-current-context strong');
   for(let i=0;i<6;i++){
    const trigger=page.locator('.app-nav-flyout-trigger').nth(i);
    if(width>=850)await trigger.hover();else await trigger.click();
    await check(width>=850?'.zaray-flyout-portal .app-nav-link':'.app-nav-flyout-panel.is-open .app-nav-link');
   }
  }else await check('.personal-home-nav-menu .personal-nav-link');
  await page.keyboard.press('Escape');
  if(mode==='company')await page.keyboard.press('Escape');
  await page.mouse.move(0,899);
  assert.equal(await button.getAttribute('aria-expanded'),'false','Escape closes navigation');
  if(mode==='personal'){
   if(width>=850)await page.locator('.personal-topbar-profile').hover();else await page.locator('.personal-topbar-profile').click();
   await check('.personal-profile-dropdown .personal-profile-action');
   await page.locator('main').click();
   assert.equal(await page.locator('.personal-topbar-profile').getAttribute('aria-expanded'),'false','outside click closes profile');
  }
  assert.deepEqual(errors,[]);
  console.log(width,mode,'production React menu interactions OK');
  await page.close();
 }
}finally{await browser.close()}
