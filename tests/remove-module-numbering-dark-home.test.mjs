import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(path,'utf8');
test('enterprise chapter headings never render ornamental 01..12 numbering',()=>{
 const shell=read('src/components/app-shell.tsx');
 assert.doesNotMatch(shell,/studio-chapter-number|chapter\.number|number:'0[1-9]'|number:'1[0-2]'/);
 assert.match(shell,/studio-page-copy/);
 assert.match(shell,/data-workspace-chapter=\{chapter.accent\}/);
 const css=read('src/app/zaray-total-redesign.css');
 assert.match(css,/\.app-no-sidebar \.studio-page-header \.studio-page-grid\{\s*display:block!important/);
});
test('removed module numbering does not erase real business references',()=>{
 const orders=read('src/app/commandes/page.tsx');
 assert.doesNotMatch(orders,/module 10/);
 assert.match(orders,/selected\.public_reference/);
 const payments=read('src/app/paiements/page.tsx');
 assert.doesNotMatch(payments,/MODULE 9/);
 assert.match(payments,/provider_payment_id/);
 const network=read('src/app/gestion-reseau/page.tsx');
 assert.doesNotMatch(network,/MODULE 10/);
 assert.match(network,/pair\.token/);
});
test('Z’Accueil is permanently dark while other pages keep their preference',()=>{
 const theme=read('src/components/theme-switch.tsx');
 const personal=read('src/components/personal-shell.tsx');
 const layout=read('src/app/layout.tsx');
 assert.match(theme,/usePathname/);
 assert.match(theme,/homeDarkOnly = pathname === '\/mon-compte'/);
 assert.match(theme,/const applied: Theme = homeDarkOnly \? 'dark' : initial/);
 assert.match(theme,/if \(homeDarkOnly\) return null/);
 assert.match(theme,/window\.localStorage\.setItem\(KEY, next\)/);
 assert.match(personal,/!home && <div className="topbar-icon-group topbar-theme-control">/);
 assert.match(layout,/data-zaray-theme="dark"/);
});
test('animation files and globe/starfield remain present',()=>{
 assert.match(read('src/app/mon-compte/page.tsx'),/<PersonalShell home/);
 assert.ok(read('src/components/rotating-earth-horizon.tsx').length>500);
 assert.ok(read('src/components/earth-satellites.tsx').length>500);
 assert.ok(read('src/components/starlink-satellites-3d.tsx').length>500);
});
