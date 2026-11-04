import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('src/app/gestion-reseau/page.tsx','utf8');
const guide=readFileSync('network-connector/README.md','utf8');
const access=readFileSync('src/app/api/network/access/route.ts','utf8');

test('onboarding acknowledges missing hardware and points to the existing captive portal',()=>{
 assert.match(ui,/En attente du routeur physique/);
 assert.match(ui,/recentlySeenRouters=routers\.filter\(r=>fresh\(r\.last_seen_at\)\)/);
 assert.match(ui,/href="\/tickets"/);
 assert.match(ui,/href="\/wifi"/);
 assert.match(ui,/RouterOS login\.html/);
});
test('downloadable connector template contains placeholders rather than secrets',()=>{
 assert.match(ui,/function downloadConnectorConfig\(router:Router\)/);
 assert.match(ui,/ZARAY_ROUTER_ID='\+router\.id/);
 assert.match(ui,/MIKROTIK_URL=https:\/\/'\+router\.host\.trim\(\)/);
 assert.match(ui,/MIKROTIK_PASSWORD=REMPLACER_LOCALEMENT/);
 assert.match(ui,/ZARAY_PAIRING_TOKEN=REMPLACER_CODE_TEMPORAIRE/);
 assert.match(guide,/Préparer le connecteur/);
 assert.doesNotMatch(ui,/ZARAY_PAIRING_TOKEN='\+pair\.token/);
});
test('router access remains gated by observed paired connector',()=>{
 assert.match(access,/creds\?\.paired_at/);
 assert.match(access,/router\.last_seen_at/);
});
