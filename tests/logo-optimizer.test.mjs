import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync('src/lib/logo-optimizer.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022
}}).outputText;
const {analyzeTransparentLogoPixels,optimizeLogo}=
 await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(js));

function pixels(w,h,painter){
 const data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)
  data.set(painter(x,y),(y*w+x)*4);
 return data;
}

test('crops only entirely transparent borders around artwork',()=>{
 const w=42,h=36,data=pixels(w,h,(x,y)=>
   x>=11&&x<=29&&y>=8&&y<=26?[170,45,125,255]:[0,0,0,0]);
 const result=analyzeTransparentLogoPixels(data,w,h);
 assert.equal(result.cropped,true);
 assert.equal(result.hasTransparency,true);
 assert.deepEqual(result.bounds,{x:11,y:8,width:19,height:19});
});

test('preserves anti-aliased edges and faint shadows, even alpha 1',()=>{
 const w=35,h=28,data=pixels(w,h,(x,y)=>
  x===6&&y===7?[90,140,200,1]:
  x>=9&&x<=22&&y>=10&&y<=20?[30,100,220,255]:[0,0,0,0]);
 assert.deepEqual(analyzeTransparentLogoPixels(data,w,h).bounds,
  {x:6,y:7,width:17,height:14});
});

test('rejects an opaque PNG/WebP, or an image with no visible logo',()=>{
 const opaque=pixels(12,12,()=>[235,235,235,255]);
 assert.throws(()=>analyzeTransparentLogoPixels(opaque,12,12),/réellement transparent/);
 const blank=pixels(12,12,()=>[0,0,0,0]);
 assert.throws(()=>analyzeTransparentLogoPixels(blank,12,12),/entièrement transparent/);
});

test('no crop when image already fits all edges; interior transparency is retained',()=>{
 const data=pixels(12,12,(x,y)=>
  x===6&&y===6?[0,0,0,0]:[35,140,190,255]);
 assert.deepEqual(analyzeTransparentLogoPixels(data,12,12),{
  bounds:{x:0,y:0,width:12,height:12},hasTransparency:true,cropped:false
 });
});

test('image processing does not remove opaque pixels or invent transparency',async()=>{
 const input='data:image/png;base64,AAAABBBBCCCC';
 const initial=pixels(10,8,(x,y)=>x>=3&&x<=7&&y>=2&&y<=5?[215,20,10,255]:[0,0,0,0]);
 const oldImage=globalThis.Image,oldDocument=globalThis.document;
 const canvases=[];
 class MockImage{
  naturalWidth=10;naturalHeight=8;decoding='';
  set src(value){assert.equal(value,input);queueMicrotask(()=>this.onload?.());}
 }
 globalThis.Image=MockImage;
 globalThis.document={createElement(tag){
  assert.equal(tag,'canvas');
  const canvas={width:0,height:0,content:null,
   getContext(kind){
    assert.equal(kind,'2d');
    return {
     drawImage(){
      // The full raster is loaded as-is; resizing is not required for this test.
      canvas.content=new Uint8ClampedArray(initial);
     },
     getImageData(x,y,w,h){
      const data=new Uint8ClampedArray(w*h*4);
      for(let row=0;row<h;row++)for(let col=0;col<w;col++){
       const from=((row+y)*canvas.width+col+x)*4;
       const to=(row*w+col)*4;
       data.set(canvas.content.subarray(from,from+4),to);
      }
      return {width:w,height:h,data};
     },
     putImageData(image){
      canvas.content=new Uint8ClampedArray(image.data);
     }
    };
   },
   toDataURL(format){
    assert.equal(format,'image/png');
    assert.deepEqual([canvas.width,canvas.height],[5,4]);
    // The output opaque artwork is unchanged from the input.
    assert.deepEqual(Array.from(canvas.content.slice(0,4)),[215,20,10,255]);
    return 'data:image/png;base64,AAAA';
   }
  };
  canvases.push(canvas);return canvas;
 }};
 try{
  const processed=await optimizeLogo(input);
  assert.deepEqual(processed,{
   dataUri:'data:image/png;base64,AAAA',cropped:true,optimized:true
  });
  assert.equal(canvases.length,2);
 }finally{
  globalThis.Image=oldImage;
  globalThis.document=oldDocument;
 }
});

test('upload accepts transparent PNG/WebP only and uses no background removal AI',()=>{
 const editor=readFileSync('src/components/wifi-ticket-customization.tsx','utf8');
 const backend=readFileSync('src/app/api/ticket-templates/route.ts','utf8');
 const portal=readFileSync('public/hotspot/zaray-login.html','utf8');
 assert.match(editor,/accept="image\/png,image\/webp"/);
 assert.match(editor,/await optimizeLogo\(uri\)/);
 assert.match(editor,/marges entièrement transparentes/);
 assert.match(backend,/stats\.isOpaque/);
 assert.match(backend,/stored\?\.logo_data_uri!==logo/);
 assert.doesNotMatch(source,/cleanLogoPixels|removeComplexBackground|logo-ai/);
 assert.match(portal,/\.logo-mark\.has-site-logo\{[^\n]*background:transparent/);
});
