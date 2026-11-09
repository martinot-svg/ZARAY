import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(path,'utf8');
const ui=read('src/app/gestion-reseau/page.tsx');
const api=read('src/app/api/network/agent/route.ts');
const get=read('src/app/api/network/route.ts');
const connector=read('network-connector/agent.mjs');
const migration=read('supabase/migrations/20261109180000_network_router_resources.sql');

test('WinBox is available as the official local application, not a browser executable',()=>{
 assert.match(ui,/https:\/\/download\.mikrotik\.com\/routeros\/winbox\/4\.5\/WinBox_Windows\.zip/);
 assert.match(ui,/L'archive Windows fournie correspond à WinBox v4\.5/);
 assert.match(ui,/sans lancer d'exécutable Windows/);
});
test('only a paired MikroTik connector can transmit RouterOS resource metrics',()=>{
 assert.match(connector,/await ros\('system\/resource'\)/);
 assert.match(connector,/cpuLoad:resource\?\.\['cpu-load'\]/);
 assert.match(api,/network_connector_credentials/);
 assert.match(api,/cpu_load_percent:cpu/);
 assert.match(api,/free>total/);
 assert.match(api,/Ressources RouterOS invalides/);
});
test('resource telemetry remains tenant-scoped and browser read-only',()=>{
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/GRANT SELECT .* TO authenticated/);
 assert.match(migration,/company_members/);
 assert.match(migration,/FOREIGN KEY \(router_id,company_id\)/);
 assert.match(get,/authorizeTenant/);
 assert.match(get,/network_router_resources/);
 assert.match(get,/eq\('company_id',companyId\)/);
});
test('stale telemetry is not presented as current',()=>{
 assert.match(ui,/chosenResources&&fresh\(chosenResources\.observed_at\)/);
 assert.match(ui,/Ressources non disponibles ou données trop anciennes/);
});
