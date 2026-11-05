import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const script=ts.transpileModule(readFileSync('src/lib/logo-ai.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}
}).outputText;
const {combineLogoAndSegmentation}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(script));

function make(w,h){
 const original=new Uint8ClampedArray(w*h*4),alpha=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,inObject=x>=12&&x<28&&y>=10&&y<30;
  original.set([200,50,90,255],i);
  alpha.set([240,240,240,inObject?255:0],i);
 }
 return [{width:w,height:h,data:original},{width:w,height:h,channels:4,data:alpha}];
}
test('AI matte removes multicolored surroundings while preserving the original logo colors',()=>{
 const [logo,mask]=make(40,40);
 // simulate multicolored background in every outer pixel
 for(let y=0;y<40;y++)for(let x=0;x<40;x++){
  const i=(y*40+x)*4;
  if(x<12||x>=28||y<10||y>=30)
   logo.data.set([(x*19)%256,(y*17)%256,((x+y)*31)%256,255],i);
 }
 const result=combineLogoAndSegmentation(logo,mask);
 assert.ok(result);
 assert.equal(result.data[3],0);
 const center=(20*40+20)*4;
 assert.deepEqual(Array.from(result.data.slice(center,center+4)),[200,50,90,255]);
});
test('empty, full or weak masks do not destroy branding',()=>{
 const [logo,mask]=make(40,40);
 mask.data.forEach((_,i)=>{if(i%4===3)mask.data[i]=0;});
 assert.equal(combineLogoAndSegmentation(logo,mask),null);
 mask.data.forEach((_,i)=>{if(i%4===3)mask.data[i]=255;});
 assert.equal(combineLogoAndSegmentation(logo,mask),null);
});
test('incorrect AI mask geometry is never applied',()=>{
 const [logo,mask]=make(40,40);
 mask.width=30;
 assert.equal(combineLogoAndSegmentation(logo,mask),null);
});
