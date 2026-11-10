import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const origin=process.env.ZARAY_LAB_PREVIEW_URL||'';
const email=process.env.ZARAY_LAB_TEST_EMAIL||'';
const password=process.env.ZARAY_LAB_TEST_PASSWORD||'';
let url;
try{url=new URL(origin);}catch{throw Error('ZARAY_LAB_PREVIEW_URL must be a preview HTTPS URL.');}
if(url.protocol!=='https:'||!url.hostname.endsWith('.vercel.app')||
 ['zaray.vercel.app','zaray-hi-boost.vercel.app'].includes(url.hostname))
 throw Error('Never run lab visual automation against ZARAY production.');
if(!email||!password)throw Error('Use local environment variables for a laboratory-only test account; never put credentials in source.');
await mkdir('artifacts/mikrotik-lab',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const view of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]){
  const context=await browser.newContext({viewport:{width:view.width,height:view.height}});
  const page=await context.newPage();
  await page.goto(url.origin+'/connexion',{waitUntil:'domcontentloaded'});
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/mon-compte|\/tableau-de-bord|\/gestion-reseau/, {timeout:30000});
  await page.goto(url.origin+'/gestion-reseau',{waitUntil:'domcontentloaded'});
  await page.locator('summary').filter({hasText:'Administration MikroTik'}).click();
  await page.getByText('Inventaire du routeur sélectionné').first().waitFor({timeout:15000});
  const overflow=await page.evaluate(()=>({
   scrollWidth:document.documentElement.scrollWidth,
   innerWidth:window.innerWidth
  }));
  assert.ok(overflow.scrollWidth<=overflow.innerWidth+2,
   'Unexpected page-level horizontal overflow: '+JSON.stringify({view,overflow}));
  await page.screenshot({path:'artifacts/mikrotik-lab/'+view.name+'.png',fullPage:true});
  await context.close();
 }
}finally{await browser.close();}
console.log('ZARAY MikroTik lab visual inspection completed on desktop and mobile.');
