import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

/**
 * Chromium doesn't open a native Android/iOS keyboard. Mock the browser's
 * VisualViewport (the official keyboard occlusion signal) rather than
 * pretending focusing a desktop input tests a physical soft keyboard.
 */
const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const folder = 'artifacts/premium-visual/keyboard-glide';
mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});

async function run({name,width,height,isMobile,keyboardHeight}) {
 const context=await browser.newContext({
  viewport:{width,height},isMobile,hasTouch:isMobile,
  deviceScaleFactor:isMobile?2:1,reducedMotion:'reduce',
 });
 const page=await context.newPage();
 try{
  await page.addInitScript(() => {
    const events=new EventTarget();
    const fake={
      height:window.innerHeight,
      offsetTop:0,
      scale:1,
      addEventListener:(...args)=>events.addEventListener(...args),
      removeEventListener:(...args)=>events.removeEventListener(...args),
    };
    Object.defineProperty(window,'visualViewport',{configurable:true,value:fake});
    window.__mockLoginKeyboard = nextHeight => {
      fake.height=nextHeight;
      events.dispatchEvent(new Event('resize'));
    };
  });
  const response=await page.goto(new URL('/connexion',base).href,{waitUntil:'domcontentloaded'});
  assert.ok(response && response.status()<400,'login HTTP status');
  const shell=page.locator('main.login-shell');
  const logo=page.locator('.login-brand');
  const card=page.locator('.login-card');
  const input=page.locator('input[name="email"]');
  await card.waitFor({state:'visible'});
  const initial=await page.evaluate(()=>{
    const s=document.querySelector('.login-shell');
    return {
      logoY:document.querySelector('.login-brand').getBoundingClientRect().y,
      cardY:document.querySelector('.login-card').getBoundingClientRect().y,
      lift:s.style.getPropertyValue('--login-keyboard-lift'),
    };
  });
  await input.focus();
  await page.evaluate(next=>window.__mockLoginKeyboard(next),keyboardHeight);
  if(isMobile){
    await page.waitForFunction(()=>{
      const shell=document.querySelector('.login-shell');
      return shell.classList.contains('login-keyboard-open') &&
        Number.parseFloat(shell.style.getPropertyValue('--login-keyboard-lift')) < -25;
    },null,{timeout:10000});
    const lifted=await page.evaluate(()=>{
      const shell=document.querySelector('.login-shell');
      const card=document.querySelector('.login-card');
      const logo=document.querySelector('.login-brand');
      const submit=card.querySelector('button[type=submit]');
      return {
        lift:parseFloat(shell.style.getPropertyValue('--login-keyboard-lift')),
        logoY:logo.getBoundingClientRect().y,
        cardY:card.getBoundingClientRect().y,
        submitBottom:submit.getBoundingClientRect().bottom,
        cardBottom:card.getBoundingClientRect().bottom,
        scrollWidth:document.documentElement.scrollWidth,
        viewportWidth:window.innerWidth,
        logoTransform:getComputedStyle(logo).transform,
        cardTransform:getComputedStyle(card).transform,
      };
    });
    assert.ok(lifted.logoY<initial.logoY-25,name+' logo glides upward with card');
    assert.ok(lifted.cardY<initial.cardY-25,name+' card glides upward with logo');
    assert.ok(Math.abs((initial.logoY-lifted.logoY)-(initial.cardY-lifted.cardY))<3,
      name+' logo and form travel together, with no layout jumps');
    assert.ok(lifted.submitBottom<=keyboardHeight+40,name+' submit button remains reachable above keyboard');
    assert.ok(lifted.scrollWidth<=lifted.viewportWidth+2,name+' no horizontal overflow');
    assert.notEqual(lifted.logoTransform,'none');
    assert.equal(lifted.logoTransform,lifted.cardTransform);
    // Synthetic screenshot with a clearly marked keyboard occlusion zone.
    await page.evaluate(next=>{
      const overlay=document.createElement('div');
      overlay.setAttribute('data-test-keyboard','');
      Object.assign(overlay.style,{
        position:'fixed',left:'0',right:'0',top:next+'px',bottom:'0',
        background:'#dce0e8',zIndex:'1000',pointerEvents:'none'
      });
      document.body.append(overlay);
    },keyboardHeight);
    await page.screenshot({path:`${folder}/${name}-keyboard.png`,animations:'disabled'});
    await page.locator('[data-test-keyboard]').evaluate(el=>el.remove());
    // Switching between email and password must NOT restart from the top.
    const password=page.locator('input[name="password"]');
    await password.focus();
    await page.waitForTimeout(80);
    assert.ok(await shell.evaluate(el=>el.classList.contains('login-keyboard-open')),
      name+' shift persists while navigating fields');
    await page.evaluate(next=>window.__mockLoginKeyboard(next),height);
    await page.waitForFunction(()=>{
      const shell=document.querySelector('.login-shell');
      return !shell.classList.contains('login-keyboard-open') &&
        !shell.style.getPropertyValue('--login-keyboard-lift');
    });
    const restored=await page.evaluate(()=>({
      logoY:document.querySelector('.login-brand').getBoundingClientRect().y,
      cardY:document.querySelector('.login-card').getBoundingClientRect().y,
    }));
    assert.ok(Math.abs(restored.logoY-initial.logoY)<3,name+' logo returns to center after keyboard closes');
    assert.ok(Math.abs(restored.cardY-initial.cardY)<3,name+' card returns to center after keyboard closes');
    await input.blur();
    console.log(JSON.stringify({device:name,keyboardHeight,liftedBy:Math.round(-lifted.lift),restored:true,buttonsAccessible:true}));
  }else{
    await page.waitForTimeout(120);
    assert.equal(await shell.evaluate(el=>el.classList.contains('login-keyboard-open')),false,'tablet stays unchanged');
    assert.equal(await shell.evaluate(el=>el.style.getPropertyValue('--login-keyboard-lift')),'','no desktop or tablet shift');
    console.log(JSON.stringify({device:name,unchanged:true}));
  }
 }finally{await context.close();}
}
try{
 await run({name:'mobile-390',width:390,height:844,isMobile:true,keyboardHeight:560});
 await run({name:'mobile-430',width:430,height:932,isMobile:true,keyboardHeight:610});
 await run({name:'tablet-820',width:820,height:1024,isMobile:false,keyboardHeight:670});
}finally{await browser.close()}
