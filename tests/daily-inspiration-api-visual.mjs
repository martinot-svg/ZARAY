import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base=process.env.BASE_URL??'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const expected=new Set(['entrepreneuriat','sagesse-africaine','attraction-etat-esprit','discipline-reussite']);
try{
 const context=await browser.newContext();
 const today=new Date();
 const utcDay=Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate());
 const found=new Set();
 for(let n=-1;n<=2;n++){
  const date=new Date(utcDay+n*86400000).toISOString().slice(0,10);
  const url=new URL('/api/daily-quote?date='+date,base).href;
  const response=await context.request.get(url,{timeout:15000});
  assert.equal(response.status(),200,date+' daily quote endpoint');
  const json=await response.json();
  assert.equal(json.total,34,'only curated sources in active library');
  const q=json.quote;
  assert.ok(q && q.content && q.sourceTitle && q.sourceUrl && q.author,date+' source metadata');
  assert.ok(q.provenance,date+' provenance');
  assert.equal(q.language,'fr');
  assert.ok(expected.has(q.category));
  assert.equal(new URL(q.sourceUrl).protocol,'https:');
  if(q.kind==='proverb'){
   assert.ok(q.country && q.culture,date+' cultural origin is visible');
   assert.ok(q.author.startsWith('Tradition '));
  }else{
   assert.equal(q.kind,'citation');
   assert.ok(q.translatedFrom==='en');
  }
  if(q.category==='attraction-etat-esprit')assert.ok(q.principle?.length>15);
  found.add(q.category);
  console.log(JSON.stringify({date,category:q.category,author:q.author,country:q.country,source:q.sourceTitle}));
 }
 assert.deepEqual([...found].sort(),[...expected].sort(),'four categories every four days');
 const malformed=await context.request.get(new URL('/api/daily-quote?date=2026-02-30',base).href);
 assert.equal(malformed.status(),400,'malformed date rejected');
 await context.close();
}finally{await browser.close()}
