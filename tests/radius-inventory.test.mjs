import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const agent=readFileSync('network-connector/agent.mjs','utf8');
const ui=readFileSync('src/app/gestion-reseau/page.tsx','utf8');
const api=readFileSync('src/app/api/network/agent/route.ts','utf8');

test('RADIUS is inventoried from RouterOS over the existing authenticated connector',()=>{
 assert.match(agent,/kind:'radius',path:'radius'/);
 assert.match(agent,/active:o=>o\.disabled!=='true'/);
 assert.match(api,/['"]radius['"]/);
});
test('No RADIUS shared secret is collected as an observation',()=>{
 const source=agent.slice(agent.indexOf("{kind:'radius'"),agent.indexOf("{kind:'hotspot'"));
 assert.doesNotMatch(source,/secret|password|key(?=\s*:)/i);
 assert.match(source,/mac:\(\)=>''/);
});
test('UI does not confuse configured RADIUS with working RADIUS authentication',()=>{
 assert.match(ui,/Serveurs RADIUS déclarés sur MikroTik/);
 assert.match(ui,/ne confirme ni sa joignabilité, ni l’authentification/);
 assert.match(ui,/Non vérifié récemment/);
});
