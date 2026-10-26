import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const transpiled=ts.transpileModule(text('src/lib/logo-surface.ts'),{
  compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022 }
}).outputText;
const exports={};
runInNewContext(transpiled,{exports});
const {surfaceTone,parseCssColor,toneForColor}=exports;

const el=(backgroundColor,parentElement=null,override=null)=>({
  parentElement,backgroundColor,
  getAttribute:(name)=>name==='data-logo-surface'?override:null,
});
const browser=dark=>({
  getComputedStyle:e=>({backgroundColor:e.backgroundColor}),
  matchMedia:()=>({matches:dark})
});

test('computed nearest WHITE form stays black-logo even in a dark-browser context',()=>{
  const outer=el('rgb(10, 13, 11)');
  const whiteForm=el('rgb(255, 255, 255)',outer);
  assert.equal(surfaceTone(el('rgba(0, 0, 0, 0)',whiteForm),browser(true)),'light');
});
test('dark navbar gets WHITE logo even with a light-browser theme',()=>{
  const lightPage=el('rgb(255,255,255)');
  const darkBar=el('rgb(10, 13, 11)',lightPage);
  assert.equal(surfaceTone(el('transparent',darkBar),browser(false)),'dark');
});
test('theme change changes logo without reload when the painted surface changes',()=>{
 const panel=el('rgb(255,255,255)');
 const logo=el('transparent',panel);
 assert.equal(surfaceTone(logo,browser(true)),'light');
 panel.backgroundColor='rgb(10,13,11)';
 assert.equal(surfaceTone(logo,browser(false)),'dark');
});
test('transparent ancestors are ignored and translucent surface alpha is combined',()=>{
  const outer=el('rgb(0,0,0)');
  const tint=el('rgba(255,255,255,0.1)',outer);
  assert.equal(surfaceTone(el('rgba(0,0,0,0)',tint),browser(false)),'dark');
  assert.equal(parseCssColor('rgb(100% 100% 100% / 50%)').a,0.5);
});
test('explicit contrast hint handles photo background not readable from CSS color',()=>{
  const image=el('rgba(0,0,0,0)',null,'dark');
  assert.equal(surfaceTone(el('transparent',image),browser(false)),'dark');
});
test('source uses observer for theme switching and does not modify image bytes',()=>{
  const component=text('src/components/brand-logo.tsx');
  const css=text('src/app/globals.css');
  assert.match(component,/MutationObserver/);
  assert.match(component,/matchMedia\('\(prefers-color-scheme: dark\)'\)/);
  assert.match(component,/data-logo-tone/);
  assert.match(component,/unoptimized/);
  assert.doesNotMatch(component,/filter:|drop-shadow|backgroundColor/);
  assert.match(css,/\.brand-logo\[data-logo-tone="light"\]/);
  assert.match(css,/\.brand-logo\[data-logo-tone="dark"\]/);
  assert.doesNotMatch(css.slice(css.indexOf('/* Un seul composant Logo global.')),/\.brand-logo-dark\{display:block!important/);
});
