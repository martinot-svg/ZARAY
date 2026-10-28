import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const output = 'artifacts/premium-visual/compact-forms';
mkdirSync(output, { recursive: true });

const sizes = [
 {name:'desktop-short',width:1366,height:642},
 {name:'tablet',width:820,height:1024},
 {name:'mobile',width:390,height:844},
];
const paths = ['/connexion','/inscription','/mot-de-passe-oublie','/reinitialiser-mot-de-passe','/entreprises/nouvelle'];
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for (const size of sizes) {
  const page = await browser.newPage({viewport:{width:size.width,height:size.height},deviceScaleFactor:1,reducedMotion:'reduce'});
  page.setDefaultTimeout(12000);
  for (const path of paths) {
   const response = await page.goto(new URL(path,base).href,{waitUntil:'domcontentloaded',timeout:30000});
   assert.ok(response && response.status() < 400,path+' HTTP response');
   const card = page.locator('.form-shell > .form-card');
   await card.waitFor({state:'visible'});
   const box = await card.boundingBox();
   assert.ok(box,path+' card must be visible');
   const metrics = await page.evaluate(() => {
    const node = document.querySelector('.form-shell > .form-card');
    const bounds = node.getBoundingClientRect();
    const controls = [...node.querySelectorAll('input,select,textarea,button')].map(el=> {
      const r=el.getBoundingClientRect();
      return {tag:el.tagName,left:r.left,right:r.right,width:r.width,height:r.height};
    });
    return {width:bounds.width,height:bounds.height,left:bounds.left,right:bounds.right,
      scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
      scrollHeight:document.documentElement.scrollHeight,innerHeight:window.innerHeight,controls};
   });
   assert.ok(metrics.width <= Math.min(size.width-24,475),path+'/'+size.name+' compact width '+metrics.width);
   assert.ok(metrics.left >= -1 && metrics.right <= size.width+1,path+'/'+size.name+' stays within viewport');
   assert.ok(metrics.scrollWidth <= metrics.clientWidth+2,path+'/'+size.name+' must not horizontally scroll');
   for (const control of metrics.controls) {
    assert.ok(control.left >= metrics.left-4 && control.right <= metrics.right+4,path+'/'+size.name+' control must fit card');
    assert.ok(control.height >= 34,path+'/'+size.name+' control should remain usable');
   }
   if(path==='/connexion' && size.name==='desktop-short'){
    assert.ok(metrics.scrollHeight <= metrics.innerHeight+2,'desktop login should not create a needless vertical scrollbar: '+JSON.stringify(metrics));
   }
   if(path==='/connexion') {
    const logo = await page.locator('.login-brand').boundingBox();
    const heading = page.locator('.login-card h1');
    const titleFits = await heading.evaluate(el => el.scrollWidth <= el.clientWidth + 2);
    const forgotten = await page.getByRole('link',{name:'Mot de passe oublié ?'}).boundingBox();
    const signup = await page.getByRole('link',{name:'Créer un compte'}).boundingBox();
    assert.ok(logo && logo.y + logo.height < box.y + 3, size.name+' logo must be above card');
    assert.ok(titleFits,size.name+' login heading must stay in one line');
    assert.ok(forgotten && signup && forgotten.x < signup.x, size.name+' recovery link must be left');
    assert.ok(Math.abs(forgotten.y - signup.y) < 5,size.name+' footer links must align in one row');
    assert.match(await page.locator('.login-subtitle').innerText(), /Votre univers ZARAY vous attend/);
    const iconOnly = await page.getByRole('button',{name:'Activer le thème clair'}).evaluate(el => {
      const style = getComputedStyle(el);
      const label = el.querySelector('.zaray-theme-switch-label');
      return { background:style.backgroundColor,image:style.backgroundImage,
        border:style.borderTopWidth, label:label ? getComputedStyle(label).display : null };
    });
    assert.equal(iconOnly.background,'rgba(0, 0, 0, 0)',size.name+' theme button background');
    assert.equal(iconOnly.image,'none',size.name+' theme button gradient');
    assert.equal(iconOnly.border,'0px',size.name+' theme button border');
    assert.equal(iconOnly.label,'none',size.name+' theme text must be hidden');
   }
   if(path==='/connexion') {
    await page.screenshot({path:output+'/'+size.name+'-dark.png',animations:'disabled',fullPage:false,timeout:18000});
    await page.getByRole('button',{name:'Activer le thème clair'}).click();
    assert.equal(await page.locator('html').getAttribute('data-zaray-theme'),'light');
    await page.screenshot({path:output+'/'+size.name+'-light.png',animations:'disabled',fullPage:false,timeout:18000});
   }
   console.log(JSON.stringify({route:path,device:size.name,cardWidth:Math.round(metrics.width),
      cardHeight:Math.round(metrics.height),verticalScroll:metrics.scrollHeight>metrics.innerHeight+2,
      horizontalScroll:metrics.scrollWidth>metrics.clientWidth+2}));
  }
  await page.close();
 }
} finally {await browser.close();}
