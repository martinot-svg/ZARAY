import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync('src/lib/logo-palette.ts','utf8');
const script=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {paletteFromPixels}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(script));
const raster=(one,two)=>new Uint8ClampedArray(Array.from({length:100},(_,i)=>[...(i<70?one:two),255]).flat());
test('logo palette follows dominant and secondary image colors',()=>{
 const p=paletteFromPixels(raster([19,172,103],[40,75,207]));
 assert.equal(p.primary_color,'#13AC67');assert.equal(p.accent_color,'#284BCF');
 assert.equal(p.secondary_color,'#FFFFFF');
});
test('transparent pixels cannot override logo color',()=>{
 const pixels=new Uint8ClampedArray(400);
 for(let i=90;i<100;i++)pixels.set([207,46,75,255],i*4);
 assert.equal(paletteFromPixels(pixels).primary_color,'#CF2E4B');
});
test('monochrome and transparent images are handled safely',()=>{
 assert.equal(paletteFromPixels(raster([32,32,32],[32,32,32])).primary_color,'#202020');
 assert.equal(paletteFromPixels(new Uint8ClampedArray(400)),null);
});
test('logo upload and manual override remain available per site',()=>{
 const ui=readFileSync('src/components/wifi-ticket-customization.tsx','utf8');
 assert.match(ui,/paletteFromLogo\(uri\)/);
 assert.match(ui,/Reprendre les couleurs du logo/);
 assert.match(ui,/\['primary_color','Principale'\]/);
 assert.match(ui,/\['accent_color','Accent \/ dégradé'\]/);
 assert.match(ui,/logoRequest\.current\+\+/);
});
test('ticket exports and Hotspot keep uploaded logo visible',()=>{
 const pdf=readFileSync('src/lib/ticket-pdf.ts','utf8');
 const canvas=readFileSync('src/components/voucher-canvas.tsx','utf8');
 const generator=readFileSync('src/components/wifi-ticket-generator.tsx','utf8');
 const portal=readFileSync('public/hotspot/zaray-login.html','utf8');
 assert.match(pdf,/export async function requireVoucherLogo/);
 assert.match(pdf,/if\(uri&&!logo\)throw Error/);
 assert.match(pdf,/const logoUsed=logoPaint\(ctx,logo,mainX,y\+7,64,36\)/);
 assert.match(generator,/await requireVoucherLogo\(design.logo_data_uri\)/);
 assert.match(generator,/canvas\.dataset\.logoReady!=='true'/);
 assert.match(canvas,/canvas\.dataset\.logoReady='true'/);
 assert.match(portal,/\.logo-mark\.has-site-logo/);
 assert.match(portal,/mark\.classList\.add\('has-site-logo'\)/);
});
