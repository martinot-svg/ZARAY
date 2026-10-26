/**
 * Browser-level contrast regression for sensitive ZARAY flows.
 *
 * The payment screens use Playwright HTTP interception: no order is inserted,
 * no money moves, no receipt is uploaded, no customer's data is downloaded.
 *
 * Secure authenticated coverage is opt-in via dedicated QA account secrets.
 * Never bypass the server's Supabase session or RLS checks.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'https://zaray.vercel.app';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
});
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
const artifacts = 'artifacts/contrast-sensitive';
await fs.mkdir(artifacts, { recursive: true });
const findings = [];
const cases = [];
const reference = 'ABCDEF123456';
const url = new URL('/paiement/' + reference, base).toString();

async function audit(page, name, { screenshots = true } = {}) {
  // This audits actual browser computed foregrounds against composed ancestor
  // backgrounds. Gradients/images require subsequent manual image review.
  const result = await page.evaluate(() => {
    const rgb = value => {
      const match = value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
      if (!match) return null;
      const alpha = match[4] ? (match[4].endsWith('%') ? parseFloat(match[4]) / 100 : Number(match[4])) : 1;
      return [Number(match[1]),Number(match[2]),Number(match[3]),alpha];
    };
    const over = (a,b) => {
      const alpha=a[3]+b[3]*(1-a[3]);
      return [0,1,2].map(i => (a[i]*a[3]+b[i]*b[3]*(1-a[3]))/alpha).concat(alpha);
    };
    const lum = c => c.slice(0,3).map(x => {
      const v=x/255; return v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4;
    }).reduce((acc,v,i)=>acc+v*[.2126,.7152,.0722][i],0);
    const contrast=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    const bgFor=element=>{
      const stack=[];
      for(let e=element;e;e=e.parentElement)stack.push(e);
      return stack.reverse().reduce((bg,e)=>{
        const paint=rgb(getComputedStyle(e).backgroundColor);
        return paint ? over(paint,bg) : bg;
      },[255,255,255,1]);
    };
    const elements=document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,strong,small,label,button,input,textarea,select,li,td,th,div,a,summary,[role="alert"],[role="status"]');
    const violations=[];
    let inspected=0;
    for(const el of elements) {
      const st=getComputedStyle(el), rect=el.getBoundingClientRect();
      if(st.display==='none'||st.visibility==='hidden'||rect.width===0||rect.height===0||el.closest('[aria-hidden="true"]')) continue;
      if(!Array.from(el.childNodes).some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())&&!el.matches('input,textarea,select'))continue;
      const foreground=rgb(st.color);
      if(!foreground)continue;
      inspected++;
      const background=bgFor(el),size=parseFloat(st.fontSize);
      const min=size>=24||(size>=18.66&&Number(st.fontWeight)>=700)?3:4.5;
      if(contrast(over(foreground,background),background)+.001<min){
        // Semi-transparent layers or gradients require pixel sampling.
        let gradient=false;
        for(let n=el;n;n=n.parentElement)if(getComputedStyle(n).backgroundImage!=='none')gradient=true;
        if(!gradient)violations.push({
          element:el.tagName,
          text:(el.textContent||el.getAttribute('placeholder')||'').trim().slice(0,50),
          contrast:Number(contrast(over(foreground,background),background).toFixed(2)),
          required:min,
        });
      }
      if(el.matches('input,textarea') && el.getAttribute('placeholder')){
        const placeholder=rgb(getComputedStyle(el,'::placeholder').color);
        if(placeholder && contrast(over(placeholder,background),background)+.001<4.5) {
          violations.push({element:'PLACEHOLDER',text:el.getAttribute('placeholder'),required:4.5});
        }
      }
    }
    return {inspected,violations:violations.slice(0,25)};
  });
  cases.push({name,...result});
  if(result.violations.length) findings.push(name+' '+JSON.stringify(result.violations.slice(0,5)));
  if(screenshots) await page.screenshot({path:artifacts+'/'+name+'.png',fullPage:true});
}
const payment = {
  reference,offerName:'Offre Wi-Fi contrôle',amount:5000,currency:'MGA',orderStatus:'pending_payment',paid:false,
  submission:null,
};
const scenarios = [
  ['sans-justificatif',payment],
  ['justificatif-depose',{...payment,submission:{provider:'mvola',status:'submitted',createdAt:'2026-01-01T10:00:00Z',reviewedAt:null}}],
  ['justificatif-refuse',{...payment,submission:{provider:'orange_money',status:'rejected',createdAt:'2026-01-01T10:00:00Z',reviewedAt:'2026-01-01T10:15:00Z'}}],
  ['paiement-approuve',{...payment,orderStatus:'paid',paid:true,submission:{provider:'mvola',status:'approved',createdAt:'2026-01-01T10:00:00Z',reviewedAt:'2026-01-01T10:15:00Z'}}],
];
try {
  for (const [scenario,body] of scenarios){
    const page=await context.newPage();
    try{
      await page.route('**/api/manual-payments/status?reference=*', async route=>{
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
      });
      const response=await page.goto(url,{waitUntil:'domcontentloaded'});
      if(response?.status()!==200)throw new Error('HTTP '+response?.status());
      await page.getByText('Offre Wi-Fi contrôle').waitFor({timeout:10000});
      await page.waitForTimeout(120);
      await audit(page,'paiement-'+scenario+'-desktop');
      await page.emulateMedia({colorScheme:'dark'});
      await audit(page,'paiement-'+scenario+'-pref-sombre');
      await page.setViewportSize({width:390,height:844});
      await audit(page,'paiement-'+scenario+'-mobile');
    }catch(e){findings.push('payment '+scenario+': '+String(e));}
    finally{await page.close();}
  }
  // The invalid reference state is also part of the production UI contract.
  const page=await context.newPage();
  try{
    await page.route('**/api/manual-payments/status?reference=*',route=>route.fulfill({
      status:404,contentType:'application/json',
      body:JSON.stringify({error:'Commande introuvable.'}),
    }));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.getByRole('alert').getByText('Commande introuvable.').waitFor({timeout:10000});
    await audit(page,'paiement-reference-inconnue');
  }catch(e){findings.push('payment unknown: '+String(e));}
  finally{await page.close();}

  // Optional real login, using a dedicated QA account. Credentials are never
  // written to artifacts/logs; the company must be a permitted QA tenant.
  const email=process.env.ZARAY_QA_EMAIL;
  const password=process.env.ZARAY_QA_PASSWORD;
  const companyId=process.env.ZARAY_QA_COMPANY_ID;
  let authenticated=false;
  if(email&&password){
    const p=await context.newPage();
    try{
      await p.goto(new URL('/connexion',base).toString(),{waitUntil:'domcontentloaded'});
      await p.locator('input[name="email"]').fill(email);
      await p.locator('input[name="password"]').fill(password);
      await p.locator('button[type="submit"]').click();
      await p.waitForURL(url=>url.pathname==='/mon-compte',{timeout:20000});
      authenticated=true;
      for(const path of ['/mon-compte','/entreprises','/finance-globale',...(companyId?['/tableau-de-bord?companyId='+encodeURIComponent(companyId)]:[])]){
        await p.goto(new URL(path,base).toString(),{waitUntil:'domcontentloaded'});
        if(new URL(p.url()).pathname==='/connexion')throw new Error('Session rejected for '+path);
        await p.waitForTimeout(200);
        await audit(p,'auth-'+path.split('?')[0].replace(/[^a-z0-9]/gi,'-'),{screenshots:false});
      }
    }catch(e){findings.push('authenticated audit: '+String(e));}
    finally{await p.close();}
  }
  const summary={paymentScenarios:scenarios.length,realAuthenticated:authenticated,
    authMode:authenticated?'dedicated QA account':'not configured (no bypass)',cases,failures:findings};
  await fs.writeFile(artifacts+'/summary.json',JSON.stringify(summary,null,2));
  console.log('Payment actual page tested with intercepted safe responses: '+scenarios.length+' states + unknown reference.');
  console.log('Real authenticated audit: '+(authenticated?'ran with dedicated QA user':'NOT run - QA credentials not provided'));
  console.log('Contrast cases: '+cases.length+'; failures: '+findings.length);
  if(findings.length){console.error(findings.join('\n'));process.exitCode=1;}
}finally{await browser.close();}
