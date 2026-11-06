import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const src=readFileSync('src/lib/logo-optimizer.ts','utf8');
const compiled=ts.transpileModule(src,{compilerOptions:{
 module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022
}}).outputText;
const {optimizeLogo}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(compiled));

async function withBrowserMocks(dimensions,fn){
 const oldImage=globalThis.Image,oldDocument=globalThis.document;
 const canvases=[];
 class TestImage{
  naturalWidth=dimensions.width;
  naturalHeight=dimensions.height;
  set src(_){queueMicrotask(()=>this.onload?.());}
 }
 globalThis.Image=TestImage;
 globalThis.document={createElement(tag){
  assert.equal(tag,'canvas');
  const canvas={width:0,height:0,draws:0,
   getContext(kind){
    assert.equal(kind,'2d');
    return {imageSmoothingEnabled:false,imageSmoothingQuality:'low',
     drawImage(){canvas.draws++;}};
   },
   toDataURL(kind){
    assert.equal(kind,'image/png');
    return 'data:image/png;base64,'+'A'.repeat(Math.min(5000,canvas.width*canvas.height));
   }
  };
  canvases.push(canvas);return canvas;
 }};
 try{return await fn(canvases);}finally{
  globalThis.Image=oldImage;globalThis.document=oldDocument;
 }
}

test('small uploaded logo remains byte-for-byte unchanged, with its background',async()=>{
 const input='data:image/jpeg;base64,'+'A'.repeat(15000);
 await withBrowserMocks({width:1200,height:900},async canvases=>{
  const result=await optimizeLogo(input);
  assert.deepEqual(result,{dataUri:input,optimized:false});
  assert.equal(canvases.length,0);
 });
});

test('large logo is only resized in proportion; no segmentation or cropping',async()=>{
 const input='data:image/png;base64,'+'A'.repeat(176000);
 await withBrowserMocks({width:1200,height:600},async canvases=>{
  const result=await optimizeLogo(input);
  assert.equal(result.optimized,true);
  assert.ok(result.dataUri.startsWith('data:image/png;base64,'));
  assert.equal(canvases.length,1);
  assert.equal(canvases[0].width,1024);
  assert.equal(canvases[0].height,512);
  assert.equal(canvases[0].draws,1);
 });
});

test('no automatic background removal is used in imports or the portal',()=>{
 const editor=readFileSync('src/components/wifi-ticket-customization.tsx','utf8');
 const portal=readFileSync('public/hotspot/zaray-login.html','utf8');
 assert.match(editor,/await optimizeLogo\(uri\)/);
 assert.match(editor,/Aucun détourage automatique/);
 assert.doesNotMatch(editor,/removedBackground|détourage intelligent|traitement IA local/i);
 assert.doesNotMatch(src,/cleanLogoPixels|removeComplexBackground|from '.\/logo-ai'/);
 assert.match(portal,/\.logo-mark\.has-site-logo\{[^\n]*background:transparent/);
});
