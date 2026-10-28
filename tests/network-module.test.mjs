import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const api=readFileSync('src/app/api/network/route.ts','utf8');const page=readFileSync('src/app/gestion-reseau/page.tsx','utf8');const migration=readFileSync('supabase/migrations/20261028170000_network_inventory_foundation.sql','utf8');
test('API authenticates tenant and checks role',()=>{assert.match(api,/authorizeTenant/);assert.match(api,/permission\.member\.role/);});
test('network state is not fabricated or treated as live',()=>{assert.match(page,/Aucune découverte réelle/);assert.match(page,/Non connecté/);assert.doesNotMatch(api,/fetch\(.*host/);});
test('RLS and tenant-checked router association',()=>{assert.match(migration,/enable row level security/g);assert.match(migration,/network_router_tenant_guard/);assert.match(migration,/network_observations_select/);});
