import assert from 'node:assert/strict';
import {readFileSync, mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

// Browser-only preview of the RouterOS page, NOT a simulated successful router login.
const raw=readFileSync('public/hotspot/zaray-login.html','utf8');
const folder='artifacts/premium-visual/hotspot-site-branding';
mkdirSync(folder,{recursive:true});
const template=raw
 .replace(/\$\(if (?:error|chap-id)\)[\s\S]*?\$\(endif\)/g,'')
 .replaceAll('$(link-login-only)','/routeros/login')
 .replaceAll('$(link-orig)','/');
const tinyPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+N4m0AAAAASUVORK5CYII=';
function pageSource(branding,id,slug){
 const snapshot=encodeURIComponent(JSON.stringify(branding)).replace(/'/g,'%27');
 return template.replaceAll('__ZARAY_SITE_ID__',id)
  .replaceAll('__ZARAY_COMPANY_SLUG__',slug)
  .replaceAll('__ZARAY_BRANDING_JSON__',snapshot);
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const [index,{name,viewport,siteId,brand,online}] of [
  {name:'site-a-mobile',viewport:{width:390,height:700},
   siteId:'a1111111-1111-4111-8111-111111111111',online:true,
   brand:{siteName:'Site Alpha',brandName:'Alpha Connexion',primaryColor:'#E5B745',accentColor:'#F4DE91',welcomeMessage:'Bienvenue au site Alpha',logoDataUri:tinyPng}},
  {name:'site-b-desktop',viewport:{width:1366,height:850},
   siteId:'b2222222-2222-4222-8222-222222222222',online:false,
   brand:{siteName:'Site Beta',brandName:'Beta Réseau',primaryColor:'#253D9E',accentColor:'#8AA8F7',welcomeMessage:'Bienvenue au site Beta',logoDataUri:null}}
 ].entries()){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  await page.route('https://zaray.vercel.app/api/public/wifi-offers?siteId=*',route=>{
   if(!online){void route.abort('failed');return;}
   void route.fulfill({status:200,contentType:'application/json',
    headers:{'Access-Control-Allow-Origin':'*'},
    body:JSON.stringify({
     siteName:brand.siteName,companyName:'Société Alpha',companySlug:'alpha-co',
     branding:{...brand,brandName:'Alpha Connexion — en ligne'},
     offers:[{id:'off1',name:'Wi-Fi 1h',durationMinutes:60,priceAmount:1000,currency:'MGA'}]
    })
   });
  });
  await page.setContent(pageSource(brand,siteId,'alpha-co'),{waitUntil:'domcontentloaded'});
  await page.locator('#credentials').waitFor({state:'visible'});
  assert.equal(await page.locator('#catalog').isVisible(),false,name+' catalog is initially hidden');
  assert.equal(await page.locator('#username').isVisible(),true,name+' ticket username is visible');
  assert.equal(await page.locator('#password').isVisible(),true,name+' ticket password is visible');
  const offersLink=page.getByRole('button',{name:'Découvrir les offres'});
  assert.equal(await offersLink.isVisible(),true,name+' small offers button');
  const fontSize=await offersLink.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  assert.ok(fontSize<=12,name+' offers entry remains discreet');
  const title=page.locator('#companyHeading');
  if(online)await page.waitForFunction(()=>document.getElementById('companyHeading')?.textContent==='Alpha Connexion — en ligne');
  else assert.equal(await title.textContent(),brand.brandName,name+' offline identity snapshot');
  assert.equal(await page.locator('#welcomeText').textContent(),brand.welcomeMessage,name+' welcome message');
  assert.equal(await page.locator('#siteName').textContent(),'Réseau '+brand.siteName,name+' site name');
  assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--site-primary')),brand.primaryColor,name+' color');
  assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--site-accent')),brand.accentColor,name+' accent');
  assert.equal(await page.locator('#siteLogo img').count(),brand.logoDataUri?1:0,name+' site logo');
  assert.equal(await page.locator('#subscribeLink').isVisible(),false,name+' subscription hidden initially');
  if(viewport.width===390){
   const size=await page.evaluate(()=>({height:document.documentElement.scrollHeight,viewport:innerHeight}));
   assert.ok(size.height<=size.viewport+10,name+' login should fit mobile viewport: '+JSON.stringify(size));
  }
  await page.screenshot({path:folder+'/'+name+'-login.png',animations:'disabled'});
  await offersLink.click();
  assert.equal(await page.locator('#catalog').isVisible(),true,name+' offers shown on demand');
  assert.equal(await page.locator('#credentials').isVisible(),false,name+' credentials hidden while browsing offers');
  await page.getByRole('button',{name:'Revenir à la connexion avec mon ticket'}).click();
  assert.equal(await page.locator('#credentials').isVisible(),true,name+' returns to login');
  assert.equal(await page.locator('#catalog').isVisible(),false,name+' returns to hidden catalog');
  console.log(JSON.stringify({name,siteId,branding:online?'live':'offline-snapshot',loginFirst:true,offersOptional:true}));
  await context.close();
 }
} finally {await browser.close();}
