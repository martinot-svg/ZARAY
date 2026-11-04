import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';

const base=process.env.BASE_URL??'http://127.0.0.1:3000';
const folder='artifacts/premium-visual/global-galaxy';
mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const devices=[{name:'desktop',width:1366,height:850},{name:'mobile',width:390,height:844}];
const routes=['/','/connexion','/inscription','/mot-de-passe-oublie'];
try{
 for(const device of devices){
  const context=await browser.newContext({
   viewport:{width:device.width,height:device.height},
   reducedMotion:'reduce'
  });
  const page=await context.newPage();
  page.setDefaultTimeout(16000);
  for(const route of routes){
   const response=await page.goto(new URL(route,base).href,{waitUntil:'domcontentloaded',timeout:45000});
   assert.ok(response&&response.status()<400,device.name+'/'+route+' loads successfully');
   const background=page.locator('body > .zaray-galaxy-backdrop.zaray-original-backdrop');
   await background.waitFor({state:'attached'});
   assert.equal(await background.count(),1,device.name+'/'+route+' one shared persistent backdrop');
   assert.equal(await background.locator('.zaray-twinkle-star').count(),74,
    device.name+'/'+route+' full static seed star layer');
   assert.equal(await background.locator('.zaray-shooting-star').count(),0,
    device.name+'/'+route+' no meteors with reduced motion');
   const canvas=background.locator('canvas.zaray-wifi-wave-canvas');
   assert.equal(await canvas.count(),1,device.name+'/'+route+' a single public-route canvas');
   const geometry=await background.evaluate(el=>{
    const style=getComputedStyle(el),star=el.querySelector('.zaray-twinkle-star');
    const canvas=el.querySelector('canvas');
    return {
     position:style.position,
     pointerEvents:style.pointerEvents,
     opacity:style.opacity,
     width:el.getBoundingClientRect().width,
     starAnimation:star?getComputedStyle(star).animationName:null,
     canvasWidth:canvas?.width??0,
     canvasHeight:canvas?.height??0,
     wavePointerEvents:canvas?getComputedStyle(canvas).pointerEvents:null,
    };
   });
   assert.equal(geometry.position,'fixed',device.name+'/'+route+' backdrop fixed');
   assert.equal(geometry.pointerEvents,'none',device.name+'/'+route+' does not intercept controls');
   assert.equal(geometry.opacity,'1',device.name+'/'+route+' visible background');
   assert.ok(geometry.width>=device.width-2,device.name+'/'+route+' covers viewport');
   assert.equal(geometry.starAnimation,'none',device.name+'/'+route+' reduced motion disables twinkle');
   assert.equal(geometry.wavePointerEvents,'none',device.name+'/'+route+' wave canvas click-through');
   assert.ok(geometry.canvasWidth>0&&geometry.canvasHeight>0,device.name+'/'+route+' initialized canvas');
   const toggle=page.getByRole('button',{name:'Activer le thème clair'}).first();
   await toggle.waitFor({state:'visible'});
   assert.equal(await toggle.locator('.zaray-theme-icon svg').count(),1,
     device.name+'/'+route+' accessible theme toggle');
   if(route==='/'||route==='/connexion'){
    await page.screenshot({path:`${folder}/${device.name}-${route==='/'?'home':'login'}-dark.png`,animations:'disabled'});
   }
   await toggle.click();
   await page.waitForFunction(()=>document.documentElement.getAttribute('data-zaray-theme')==='light');
   const lightStarColor=await background.locator('.zaray-twinkle-star').first().evaluate(el=>getComputedStyle(el).backgroundColor);
   assert.equal(lightStarColor,'rgb(40, 138, 83)',device.name+'/'+route+' dark green ink on light sky');
   assert.ok(await page.getByRole('button',{name:'Activer le thème sombre'}).first().isVisible(),
     device.name+'/'+route+' theme can be reversed');
   if(route==='/'||route==='/connexion'){
    await page.screenshot({path:`${folder}/${device.name}-${route==='/'?'home':'login'}-light.png`,animations:'disabled'});
   }
   await page.getByRole('button',{name:'Activer le thème sombre'}).first().click();
   await page.waitForFunction(()=>document.documentElement.getAttribute('data-zaray-theme')==='dark');
   // Verify real motion when the user hasn't requested reduced animations, not just markup presence.
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.zaray-twinkle-star')).animationName==='zaray-twinkle-drift');
   await page.waitForFunction(()=>document.querySelectorAll('.zaray-shooting-star').length===3);
   const moving=await background.evaluate(el=>({
    stars:el.querySelectorAll('.zaray-twinkle-star').length,
    meteors:el.querySelectorAll('.zaray-shooting-star').length,
    anim:getComputedStyle(el.querySelector('.zaray-twinkle-star')).animationName
   }));
   assert.equal(moving.stars,74);
   assert.equal(moving.anim,'zaray-twinkle-drift');
   assert.equal(moving.meteors,3,device.name+'/'+route+' decorative meteors enabled');
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.waitForFunction(()=>document.querySelectorAll('.zaray-shooting-star').length===0);
   console.log(JSON.stringify({device:device.name,route,stars:74,meteorsWithMotion:3,reducedMotion:true,
    canvasPresent:true,lightDarkToggle:true}));
  }
  await context.close();
 }
}finally{await browser.close();}
