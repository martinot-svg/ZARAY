import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';

// Render the exact TSX field in server mode. A standalone SSR fixture lets
// us verify the real geometry even when /mon-compte requires Supabase auth.
const src=readFileSync('src/components/zaccueil-asteroids.tsx','utf8');
const js=ts.transpileModule(src,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020
}}).outputText;
const require=createRequire(import.meta.url);
const module={exports:{}};
new Function('require','module','exports',js)(require,module,module.exports);
const markup=renderToStaticMarkup(React.createElement(module.exports.default));
const allCSS=readFileSync('src/app/galactic-system.css','utf8');
const start=allCSS.indexOf("/* Z'Accueil / deep-space asteroids");
assert.ok(start>0,'astro CSS was installed in the actual Z’Accueil stylesheet');
const css=allCSS.slice(start);
const root=`<!doctype html><html lang="fr" data-zaray-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>
html,body{margin:0;width:100%;height:100%;background:#02090e;overflow:hidden}
.personal-shell.personal-no-sidebar.personal-home-shell{min-height:100vh;position:relative}
.personal-content{position:relative;z-index:1;color:white;text-align:center;padding:90px 24px}
${css}</style></head><body><div class="personal-shell personal-no-sidebar personal-home-shell">
${markup}<main class="personal-content"><h1>Bonjour</h1></main></div></body></html>`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
mkdirSync('artifacts/premium-visual/zaccueil-asteroids',{recursive:true});
try{
  for(const [label,viewport] of [
    ['desktop',{width:1366,height:850}],
    ['tablet',{width:820,height:920}],
    ['mobile',{width:390,height:844}]
  ]){
    const context=await browser.newContext({viewport,reducedMotion:'no-preference'});
    const page=await context.newPage();
    await page.setContent(root,{waitUntil:'domcontentloaded'});
    const field=page.locator('.zaray-asteroid-field');
    assert.equal(await field.count(),1,label+' has a single always-present asteroid layer');
    assert.equal(await field.getAttribute('data-asteroid-presence'),'continuous');
    assert.equal(await field.locator('.zaray-asteroid-orbit').count(),5,label+' all asteroid meshes are present on first paint');
    assert.equal(await field.locator('svg.zaray-asteroid-mesh').count(),5);
    assert.equal(await field.locator('ellipse').count(),45,label+' shaded craters are included at SSR');
    const rocks=await field.locator('.zaray-asteroid-orbit').evaluateAll(nodes=>nodes.map(el=>{
      const style=getComputedStyle(el),box=el.getBoundingClientRect();
      const spin=getComputedStyle(el.querySelector('.zaray-asteroid-tumble'));
      return {
        name:el.getAttribute('data-asteroid'),opacity:parseFloat(style.opacity),
        display:style.display,animation:style.animationName,
        delay:parseFloat(style.animationDelay),duration:parseFloat(style.animationDuration),
        spinDelay:parseFloat(spin.animationDelay),spinAnimation:spin.animationName,
        transition:style.transitionProperty,
        x:box.x,y:box.y,w:box.width,h:box.height
      };
    }));
    for(const rock of rocks){
      assert.ok(rock.opacity>=.6&&rock.opacity<=1,label+' visible at first paint: '+rock.name);
      assert.equal(rock.display,'block',label+' no delayed mount');
      assert.equal(rock.animation,'zaray-asteroid-ancient-drift');
      assert.equal(rock.spinAnimation,'zaray-asteroid-ancient-tumble');
      assert.ok(rock.delay<0&&rock.spinDelay<0,label+' orbit and tumble are already underway');
      assert.ok(rock.duration>=180,label+' drift stays very slow');
      assert.ok(rock.x<viewport.width&&rock.x+rock.w>0
        &&rock.y<viewport.height&&rock.y+rock.h>0,
        label+' asteroid visible inside viewport: '+rock.name);
      assert.ok(rock.transition==='all'||rock.transition==='none',
        label+' no opacity fade');
    }
    const positionBefore=await field.locator('.zaray-asteroid-orbit').first()
      .evaluate(el=>getComputedStyle(el).transform);
    await page.waitForTimeout(260);
    const positionAfter=await field.locator('.zaray-asteroid-orbit').first()
      .evaluate(el=>getComputedStyle(el).transform);
    assert.notEqual(positionBefore,positionAfter,label+' gently moving without arriving suddenly');
    assert.equal(await field.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    await page.screenshot({path:`artifacts/premium-visual/zaccueil-asteroids/${label}.png`,
      animations:'allow'});
    await context.close();
  }
  const context=await browser.newContext({
    viewport:{width:390,height:844},reducedMotion:'reduce'
  });
  const page=await context.newPage();
  await page.setContent(root,{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('.zaray-asteroid-orbit').count(),5);
  assert.equal(await page.locator('.zaray-asteroid-orbit').first()
    .evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await page.locator('.zaray-asteroid-tumble').first()
    .evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.ok(await page.locator('.zaray-asteroid-mesh').first().isVisible());
  await context.close();
  console.log('Z’Accueil asteroid SSR presence, slow negative-phase drift, mobile and reduced-motion PASS.');
}finally{
  await browser.close();
}
