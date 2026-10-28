import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const compile = source => ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 reportDiagnostics:true,
});
function exportsFor(path, requireFn=()=>({})) {
 const compiled=compile(read(path));
 const diagnostics=(compiled.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.equal(diagnostics.length,0,'TypeScript diagnostic in '+path);
 const result={};
 vm.runInNewContext(compiled.outputText,{exports:result,require:requireFn,Date,console},
  {filename:path,timeout:5000});
 return result;
}
const data=exportsFor('src/data/quotations/curated.ts');
const categories=Array.from(data.quoteCategories);
const corpus=Array.from(data.curatedQuotes);

test('ZARAY exclusively rotates four verified universes with 34 reviewed entries',()=>{
 assert.deepEqual(categories,[
  'entrepreneuriat','sagesse-africaine','attraction-etat-esprit','discipline-reussite',
 ]);
 assert.equal(corpus.length,34);
 const uniqueIds=new Set(corpus.map(x=>x.id));
 assert.equal(uniqueIds.size,corpus.length);
 for (const cat of categories)assert.ok(corpus.filter(x=>x.category===cat).length>=8,cat+' coverage');
 assert.ok(!read('src/lib/daily-quote-library.ts').includes('collection-1.json'));
 assert.ok(!read('src/lib/daily-quote-library.ts').includes('collection-5.json'));
 assert.ok(!read('src/lib/french-daily-quote.ts').includes('TRANSLATION_ENDPOINT'));
 assert.ok(!read('src/lib/french-daily-quote.ts').includes('frenchFallbackQuotes'));
});

test('every quotation has traceable source and safe verified attribution metadata',()=>{
 const authors=new Set([
  'James Allen','Wallace D. Wattles','Booker T. Washington',
  'Frederick Douglass','Theodore Roosevelt','William Walker Atkinson',
  'Florence Scovel Shinn',
 ]);
 for(const item of corpus){
  assert.ok(item.id && item.content.length>=25 && item.content.length<240,item.id+' text');
  assert.equal(item.language,'fr');
  assert.ok(item.sourceTitle.length>=12,item.id+' source title');
  const parsed=new URL(item.sourceUrl);
  assert.equal(parsed.protocol,'https:',item.id+' HTTPS source');
  assert.ok(['afriprov.tangaza.ac.ke','www.gutenberg.org','home.nps.gov','us.macmillan.com'].includes(parsed.hostname),item.id+' trusted citation host');
  assert.ok(item.provenance.length>40,item.id+' provenance information');
  if(item.category==='sagesse-africaine'){
   assert.equal(item.kind,'proverb');
   assert.ok(item.country?.length>=4,item.id+' sourced origin country');
   assert.ok(item.culture?.length>=2,item.id+' sourced linguistic culture');
   assert.ok(item.author===`Tradition ${item.culture}`,item.id+' no invented individual');
   assert.equal(item.principle,null);
  }else{
   assert.equal(item.kind,'citation');
   assert.ok(authors.has(item.author),item.id+' real author');
   assert.equal(item.country,null);
   assert.equal(item.culture,null);
   assert.equal(item.translatedFrom,'en');
  }
  if(item.category==='attraction-etat-esprit'){
   assert.ok(item.principle?.length>28,item.id+' must identify philosophical law or author');
  }
 }
});

test('daily selection is deterministic, locally date-driven and balanced every 4 days',()=>{
 const lib=exportsFor('src/lib/daily-quote-library.ts',name=>{
  if(name==='server-only')return {};
  if(name==='@/data/quotations/curated')return data;
  throw Error('Unexpected dependency: '+name);
 });
 assert.equal(lib.quoteLibrary.length,corpus.length);
 for(const input of ['2026-02-30','2026-13-01','2026-10-99','2026-10-28Z','bad','1999-12-31']){
  assert.equal(lib.getDailyQuote(input),null,input);
 }
 const start=Date.UTC(2026,9,28);
 const selected=[];
 for(let i=0;i<40;i++){
  const date=new Date(start+i*86400000).toISOString().slice(0,10);
  const result=lib.getDailyQuote(date);
  assert.ok(result);
  assert.equal(result,lib.getDailyQuote(date),'stable for '+date);
  selected.push(result);
 }
 for(let i=0;i<40;i+=4){
  assert.equal(new Set(selected.slice(i,i+4).map(q=>q.category)).size,4,'four topics every four days');
 }
 assert.equal(new Set(selected.map(q=>q.id)).size,34,'every curated entry appears in a 40-day rotation');
});

test('user-visible credit shows African country, authentic author, law and source link',()=>{
 const ui=read('src/components/daily-inspiration.tsx');
 assert.match(ui,/daily\.quote\.country/);
 assert.match(ui,/daily\.quote\.culture/);
 assert.match(ui,/daily\.quote\.principle/);
 assert.match(ui,/D’après /);
 assert.match(ui,/Tradition orale documentée/);
 assert.match(ui,/Vérifier la source/);
 assert.match(ui,/n’est pas une citation française mot pour mot|Adaptation française d’un texte original/);
 assert.match(ui,/ne constitue pas une loi scientifique démontrée/);
 const css=read('src/app/zaray-total-redesign.css');
 assert.match(css,/personal-inspiration-details/);
 assert.match(css,/personal-inspiration-category/);
 assert.match(css,/personal-home-quote-footer\{\s*position:static!important/);
});
