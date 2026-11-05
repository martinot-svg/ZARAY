import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync('src/lib/logo-optimizer.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {cleanLogoPixels}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(compiled));
function raster(w,h,background,rect){
 const data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,c=rect&&x>=rect.x&&x<rect.x+rect.w&&y>=rect.y&&y<rect.y+rect.h?rect.color:background;
  data.set(c,i);
 }
 return {width:w,height:h,data};
}
test('white background removed around a solid color logo, and cropped',()=>{
 const result=cleanLogoPixels(raster(80,60,[255,255,255,255],{x:28,y:17,w:24,h:26,color:[18,80,180,255]}));
 assert.equal(result.removedBackground,true);
 assert.equal(result.cropped,true);
 assert.ok(result.raster.width<80&&result.raster.height<60);
 assert.equal(result.raster.data[3],0);
 assert.ok(result.raster.data.some((v,i)=>i%4===2&&v===180));
});
test('black and colored backgrounds also become transparent',()=>{
 for(const bg of [[0,0,0,255],[120,180,64,255]]){
  const result=cleanLogoPixels(raster(90,70,bg,{x:30,y:20,w:30,h:30,color:[230,30,70,255]}));
  assert.equal(result.removedBackground,true);
  assert.ok(result.raster.data.some((v,i)=>i%4===3&&v===0));
 }
});
test('transparency-only padding is cropped without destroying artwork',()=>{
 const result=cleanLogoPixels(raster(72,72,[0,0,0,0],{x:23,y:19,w:30,h:32,color:[24,100,180,255]}));
 assert.equal(result.removedBackground,false);
 assert.equal(result.cropped,true);
 assert.ok(result.raster.width<72&&result.raster.height<72);
});
test('border graphics without broad uniform background are protected',()=>{
 const w=60,h=60,data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set([(x*7)%256,(y*11)%256,((x+y)*9)%256,255],(y*w+x)*4);
 const result=cleanLogoPixels({width:w,height:h,data});
 assert.equal(result.removedBackground,false);
 assert.equal(result.cropped,false);
});
test('logo import processes image before saving into all site surfaces',()=>{
 const customization=readFileSync('src/components/wifi-ticket-customization.tsx','utf8');
 assert.match(customization,/await optimizeLogo\(uri\)/);
 assert.match(customization,/logo_data_uri:targetUri/);
 assert.match(customization,/paletteFromLogo\(targetUri\)/);
 assert.match(customization,/const base=saved.settings/);
});
