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
    const logo = page.locator('.login-shell > .login-brand .brand-logo');
    await logo.waitFor({state:'visible'});
    assert.equal(await card.locator('.brand-logo').count(),0,'logo must be outside login card');
    assert.equal(await headingTextCount(),1);
    async function headingTextCount() {
      return page.getByRole('heading',{level:1,name:'Votre univers vous attend'}).count();
    }
    assert.equal(await page.getByText('Votre univers ZARAY vous attend',{exact:true}).count(),0);
    assert.equal(await page.getByText('Connexion à mon compte ZARAY',{exact:true}).count(),0);
    assert.equal(await page.getByText('ZARAY · ACCÈS SÉCURISÉ').count(),0);

    const heading = page.locator('#login-title');
    const headingMetrics = await heading.evaluate(el=>{
      const style = getComputedStyle(el);
      return {height:el.getBoundingClientRect().height,lineHeight:parseFloat(style.lineHeight),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
    });
    assert.ok(headingMetrics.height <= headingMetrics.lineHeight+2,
      'login title must fit on one line: '+JSON.stringify(headingMetrics));
    assert.ok(headingMetrics.scrollWidth <= headingMetrics.clientWidth+2,
      'login title must not overflow horizontally');

    const left = card.getByRole('link',{name:'Mot de passe oublié ?'});
    const right = card.getByRole('link',{name:'Créer un compte'});
    const cardCenter = await card.evaluate(el => {
      const r=el.getBoundingClientRect();
      return r.left+r.width/2;
    });
    assert.ok(Math.abs(cardCenter-size.width/2)<2,
      'login form must be horizontally centered: '+cardCenter+' vs '+size.width/2);
    const titleAlign = await heading.evaluate(el=>getComputedStyle(el).textAlign);
    assert.equal(titleAlign,'center','login heading must be centered');
    const inspectLinks=async()=>{
      const regular=await left.evaluate(el=>({
        weight:getComputedStyle(el).fontWeight,
        color:getComputedStyle(el).color,
        decoration:getComputedStyle(el).textDecorationLine
      }));
      const other=await right.evaluate(el=>({
        weight:getComputedStyle(el).fontWeight,
        color:getComputedStyle(el).color,
        decoration:getComputedStyle(el).textDecorationLine
      }));
      assert.equal(regular.weight,'400','left link should have regular weight');
      assert.equal(other.weight,'400','right link should have regular weight');
      assert.equal(regular.color,other.color,'footer links must have identical green color');
      assert.equal(regular.decoration,'none','left link should not be underlined');
      assert.equal(other.decoration,'none','right link should not be underlined');
      await left.hover();
      assert.equal(await left.evaluate(el=>getComputedStyle(el).textDecorationLine),'none','no underline on forgotten password hover');
      await right.hover();
      assert.equal(await right.evaluate(el=>getComputedStyle(el).textDecorationLine),'none','no underline on create account hover');
      return regular.color;
    };
    const darkLinkColor = await inspectLinks();
    assert.equal(darkLinkColor,'rgb(101, 235, 160)','dark theme links are premium green');
    const leftBox = await left.boundingBox(),rightBox = await right.boundingBox();
    assert.ok(leftBox && rightBox,'both footer links must be visible');
    assert.ok(leftBox.x + leftBox.width < rightBox.x,
      'forgotten password must be to the left of account creation');
    assert.ok(Math.abs(leftBox.y-rightBox.y)<6,
      'both account links must be aligned on the same row');
    const button = page.getByRole('button',{name:'Activer le thème clair'});
    const decoration = await button.evaluate(el=>{
      const css=getComputedStyle(el);
      return {background:css.backgroundColor,border:css.borderTopWidth,display:getComputedStyle(el.querySelector('.zaray-theme-switch-label')).display};
    });
    assert.equal(decoration.background,'rgba(0, 0, 0, 0)','icon-only theme button has no background');
    assert.equal(decoration.border,'0px','theme button must not have a visible border');
    assert.equal(decoration.display,'none','theme button label must not be visible');
    await page.screenshot({path:output+'/'+size.name+'-dark.png',animations:'disabled',fullPage:false,timeout:18000});
    await page.getByRole('button',{name:'Activer le thème clair'}).click();
    assert.equal(await page.locator('html').getAttribute('data-zaray-theme'),'light');
    const lightLinkColor = await inspectLinks();
    assert.equal(lightLinkColor,'rgb(19, 115, 73)','light theme links are contrast-safe green');
    await page.screenshot({path:output+'/'+size.name+'-light.png',animations:'disabled',fullPage:false,timeout:18000});
   }
   console.log(JSON.stringify({route:path,device:size.name,cardWidth:Math.round(metrics.width),
      cardHeight:Math.round(metrics.height),verticalScroll:metrics.scrollHeight>metrics.innerHeight+2,
      horizontalScroll:metrics.scrollWidth>metrics.clientWidth+2}));
  }
  await page.close();
 }
} finally {await browser.close();}
