/**
 * ZARAY real-browser WCAG AA regression smoke test.
 * Uses anonymous routes and deliberately challenging foreground/background
 * combinations. Authenticated routes require a separate authorized fixture.
 */
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'https://zaray.vercel.app';
const paths = ['/', '/connexion', '/inscription', '/tableau-de-bord', '/entreprises', '/clients', '/paiements', '/tickets', '/parametres'];
const results = [];
const failures = [];
await fs.mkdir('artifacts/contrast', { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, colorScheme: 'light' });

async function auditPage(page) {
  return page.evaluate(() => {
    const parse = (color) => {
      const nums = color.match(/[\d.]+/g)?.map(Number);
      return nums?.length >= 3 ? nums.slice(0, 4).concat(nums.length >= 4 ? [] : [1]) : null;
    };
    const over = (a,b) => {
      const alpha = a[3] + b[3] * (1 - a[3]);
      return [0,1,2].map(i => (a[i]*a[3] + b[i]*b[3]*(1-a[3]))/alpha).concat(alpha);
    };
    const lum = rgb => rgb.slice(0,3).map(x => {
      const v = x/255; return v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4;
    }).reduce((acc, v, i) => acc + v*[.2126,.7152,.0722][i], 0);
    const ratio = (a,b) => { const x=lum(a), y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
    const bg = el => {
      const parents=[];
      for (let n=el; n; n=n.parentElement) parents.push(n);
      return parents.reverse().reduce((color, node) => {
        const layer=parse(getComputedStyle(node).backgroundColor);
        return layer ? over(layer,color) : color;
      }, [255,255,255,1]);
    };
    const displayed = el => {
      const cs=getComputedStyle(el), rect=el.getBoundingClientRect();
      return cs.display!=='none' && cs.visibility!=='hidden' && Number(cs.opacity)>0 && rect.width>0 && rect.height>0;
    };
    const selectors = 'h1,h2,h3,h4,h5,h6,p,span,a,button,label,small,strong,em,li,td,th,div,input,textarea,select,summary,legend,figcaption,blockquote,code,time,[role="alert"],[role="status"]';
    const findings = [];
    let count=0;
    for(const el of document.querySelectorAll(selectors)) {
      if (!displayed(el) || el.closest('[aria-hidden="true"]')) continue;
      if (!Array.from(el.childNodes).some(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim()) && !el.matches('input,textarea,select')) continue;
      const cs=getComputedStyle(el), color=parse(cs.color);
      if(!color)continue;
      count++;
      const canvas=bg(el), blended=over(color,canvas), size=parseFloat(cs.fontSize), bold=Number(cs.fontWeight)>=700;
      const target=size>=24||(size>=18.66&&bold)?3:4.5;
      const measured=ratio(blended,canvas);
      const gradients=[];
      for(let n=el;n;n=n.parentElement)if(getComputedStyle(n).backgroundImage!=='none')gradients.push(n.tagName);
      if(measured+1e-5<target && !gradients.length && findings.length<50) {
        findings.push({text:(el.textContent||el.getAttribute('placeholder')||'').trim().slice(0,80),selector:el.tagName.toLowerCase(),ratio:Number(measured.toFixed(2)),target});
      }
      if(el.matches('input,textarea') && el.getAttribute('placeholder')) {
        const p=parse(getComputedStyle(el,'::placeholder').color);
        if(p && ratio(over(p,canvas),canvas) + 1e-5 < 4.5 && findings.length<50)
          findings.push({text:'Placeholder: '+el.getAttribute('placeholder'),selector:el.tagName.toLowerCase(),ratio:Number(ratio(over(p,canvas),canvas).toFixed(2)),target:4.5});
      }
    }
    return {inspectedTextElements:count,violations:findings};
  });
}

async function probe(page) {
  await page.evaluate(() => {
    const host=document.createElement('section');
    host.id='zaray-contrast-regression';
    host.style.cssText='position:fixed;top:0;left:0;z-index:2147483646;padding:8px;background:#fff';
    host.innerHTML = `
      <div id="probe-light" style="color:#fff;background:#fff;padding:5px">Texte sur fond clair</div>
      <div id="probe-dark" style="color:#111;background:#080d09;padding:5px">Texte sur fond sombre</div>
      <div style="color:white;background:#050505;padding:5px">
        <div id="probe-nested" style="color:#fff;background:#fff">Texte sur carte claire</div>
      </div>
      <div id="probe-colored" style="color:#15ec25;background:#21ef28;padding:5px">Texte sur fond coloré</div>
      <input id="probe-input" style="background:#070a08;color:#070a08" placeholder="Saisie fond sombre">
      <div id="probe-switched" style="background:#fff;color:#fff">Texte changeant</div>
    `;
    document.body.append(host);
  });
  await page.waitForTimeout(250);
  const verify = () => page.evaluate(() => {
    const parse = s => (s.match(/[\d.]+/g)||[]).map(Number);
    const lum = vals => vals.slice(0,3).map(x=>{ const v=x/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4; }).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
    const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    return ['probe-light','probe-dark','probe-nested','probe-colored','probe-input','probe-switched'].map(id=>{
      const e=document.getElementById(id),cs=getComputedStyle(e),bg=parse(cs.backgroundColor),foreground=parse(cs.color);
      const root={id,contrast:ratio(foreground,bg),color:cs.color,background:cs.backgroundColor};
      if(id==='probe-input')root.placeholderContrast=ratio(parse(getComputedStyle(e,'::placeholder').color),bg);
      return root;
    });
  });
  let reports=await verify();
  for(const item of reports) {
    if(item.contrast<4.5 || (item.placeholderContrast!==undefined && item.placeholderContrast<4.5))
      failures.push('Artificial contrast probe failed: '+JSON.stringify(item));
  }
  await page.evaluate(() => {document.getElementById('probe-switched').style.backgroundColor='#050505';});
  await page.waitForTimeout(250);
  reports=await verify();
  if(reports.find(x=>x.id==='probe-switched').contrast<4.5)
    failures.push('Dynamic background change failed: '+JSON.stringify(reports.find(x=>x.id==='probe-switched')));
  await page.evaluate(()=>document.getElementById('zaray-contrast-regression').remove());
  return reports;
}

try {
  for (const path of paths) {
    const page = await context.newPage();
    try {
      const response=await page.goto(new URL(path,base).toString(), { waitUntil:'domcontentloaded',timeout:25000 });
      await page.waitForTimeout(500);
      const status=response?.status()||0, actual=new URL(page.url()).pathname;
      const name=(path.replaceAll('/','_') || 'home').replace(/[^a-zA-Z0-9_-]/g,'');
      await page.screenshot({path:`artifacts/contrast/${name}-desktop.png`,fullPage:true,timeout:20000});
      const audit=await auditPage(page);
      const outcome={path,actual,status,...audit};
      if(status>=500) failures.push(`${path} returned HTTP ${status}`);
      if(path==='/' || path==='/connexion' || path==='/inscription') {
        outcome.probes=await probe(page);
      }
      results.push(outcome);
      console.log(JSON.stringify(outcome));
    } catch (error) {
      failures.push(`${path}: ${error.message}`);
    } finally { await page.close(); }
  }
} finally {await browser.close();}
await fs.writeFile('artifacts/contrast/summary.json',JSON.stringify({base,results,failures},null,2));
console.log('Contrast audit: '+results.length+' routes inspected, '+failures.length+' test failures.');
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
