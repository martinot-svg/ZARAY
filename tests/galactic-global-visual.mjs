import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base=process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const folder='artifacts/premium-visual/global-galaxy';
mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const devices=[
 {name:'desktop',width:1366,height:850},
 {name:'mobile',width:390,height:844},
];
const paths=['/','/connexion','/inscription','/mot-de-passe-oublie','/tableau-de-bord'];

try {
 for(const device of devices){
  const context=await browser.newContext({
    viewport:{width:device.width,height:device.height},
    reducedMotion:'reduce',
  });
  const page=await context.newPage();
  page.setDefaultTimeout(16000);
  for(const path of paths) {
   const response=await page.goto(new URL(path,base).href,{waitUntil:'domcontentloaded',timeout:45000});
   assert.ok(response && response.status()<400,device.name+'/'+path+' HTTP route');
   const galaxy=page.locator('body > .zaray-galaxy-backdrop');
   await galaxy.waitFor({state:'attached'});
   assert.equal(await galaxy.count(),1,device.name+'/'+path+' exactly one shared galaxy');
   assert.equal(await page.locator('.zaray-galaxy-canvas').count(),1,device.name+'/'+path+' exactly one canvas');
   const state=await galaxy.evaluate(el=>{
    const style=getComputedStyle(el);
    const canvas=el.querySelector('canvas');
    return {
      position:style.position,
      pointerEvents:style.pointerEvents,
      opacity:style.opacity,
      bounds:el.getBoundingClientRect().width,
      canvasOpacity:canvas?getComputedStyle(canvas).opacity:null,
      canvasPresent:!!canvas,
      theme:document.documentElement.getAttribute('data-zaray-theme'),
    };
   });
   assert.equal(state.position,'fixed',device.name+'/'+path+' fixed backdrop');
   assert.equal(state.pointerEvents,'none',device.name+'/'+path+' no click interception');
   assert.equal(state.opacity,'1',device.name+'/'+path+' galaxy must be visible');
   assert.ok(state.bounds>=device.width-2,device.name+'/'+path+' covers viewport');
   assert.equal(state.theme,'dark',device.name+'/'+path+' dark default');
   assert.equal(state.canvasOpacity,'1',device.name+'/'+path+' dark starfield');
   const toggle=page.getByRole('button',{name:'Activer le thème clair'}).first();
   await toggle.waitFor({state:'visible'});
   assert.equal(await toggle.locator('.zaray-theme-radio-wave').count(),3,
     device.name+'/'+path+' three decorative Wi-Fi waves');
   const signal=await toggle.locator('.zaray-theme-radio-wave').first().evaluate(el=>({
      pointerEvents:getComputedStyle(el).pointerEvents,
      animation:getComputedStyle(el).animationName,
   }));
   assert.equal(signal.pointerEvents,'none');
   assert.equal(signal.animation,'none','reduced motion prevents radio animation');
   const primary=page.locator('main').first();
   assert.ok(await primary.count()>0,device.name+'/'+path+' visible page');
   if(path==='/' || path==='/connexion'){
    await page.screenshot({path:`${folder}/${device.name}-${path==='/'?'home':'login'}-dark.png`,animations:'disabled'});
   }
   await toggle.click();
   await page.waitForFunction(()=>document.documentElement.getAttribute('data-zaray-theme')==='light');
   const light=await galaxy.evaluate(el=>({
     bg:getComputedStyle(el).backgroundColor,
     opacity:getComputedStyle(el).opacity,
     canvasOpacity:getComputedStyle(el.querySelector('canvas')).opacity,
   }));
   assert.equal(light.opacity,'1',device.name+'/'+path+' light sky still visible');
   assert.equal(light.canvasOpacity,'0.09',device.name+'/'+path+' light stars remain understated');
   assert.equal(await page.getByRole('button',{name:'Activer le thème sombre'}).first().isVisible(),true);
   if(path==='/' || path==='/connexion'){
     await page.screenshot({path:`${folder}/${device.name}-${path==='/'?'home':'login'}-light.png`,animations:'disabled'});
   }
   console.log(JSON.stringify({route:path,device:device.name,galaxyCount:1,lightCanvasOpacity:light.canvasOpacity,themeWaveCount:3,reducedMotion:true}));
   await page.getByRole('button',{name:'Activer le thème sombre'}).first().click();
  }
  await context.close();
 }
}finally{await browser.close()}
