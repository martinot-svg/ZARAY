import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {routerHeartbeatIsFresh} from '../src/lib/network-inventory-freshness.ts';

const now=Date.parse('2026-11-10T14:00:00.000Z');
const offset=ms=>new Date(now-ms).toISOString();

test('router heartbeat is fresh only for real past timestamps inside TTL',()=>{
 assert.equal(routerHeartbeatIsFresh(offset(0),now),true);
 assert.equal(routerHeartbeatIsFresh(offset(149999),now),true);
 assert.equal(routerHeartbeatIsFresh(offset(150000),now),false);
 assert.equal(routerHeartbeatIsFresh(offset(-1),now),false);
 assert.equal(routerHeartbeatIsFresh(offset(-86400000),now),false);
 assert.equal(routerHeartbeatIsFresh('nonsense',now),false);
 assert.equal(routerHeartbeatIsFresh(null,now),false);
 assert.equal(routerHeartbeatIsFresh(offset(1000),NaN),false);
 assert.equal(routerHeartbeatIsFresh(offset(1000),now,-1),false);
});

test('online router UI relies on shared future-safe heartbeat',()=>{
 const ui=readFileSync('src/app/gestion-reseau/page.tsx','utf8');
 assert.ok(ui.includes("import {routerHeartbeatIsFresh} from '@/lib/network-inventory-freshness';"));
 assert.ok(ui.includes('const fresh=routerHeartbeatIsFresh;'));
 assert.ok(ui.includes("fresh(r.last_seen_at)?'En ligne'"));
});
