import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sanitizedRouterOsDetails,SAFE_ROUTEROS_DETAILS}
 from '../network-connector/routeros/inspector-properties.mjs';
import {sanitizeInventoryProperties,INVENTORY_SAFE_PROPERTY_KEYS}
 from '../src/lib/network-inventory-properties.ts';

const read=(name)=>readFileSync(name,'utf8');
test('WinBox-like property snapshots preserve useful details but not raw RouterOS secrets',()=>{
 const record={name:'ether1',type:'ether',running:'true',disabled:'false',
  password:'do-not-disclose',comment:'confidential note',secret:'hidden'};
 const projected=sanitizedRouterOsDetails('interface',record);
 assert.deepEqual(projected,{name:'ether1',type:'ether',running:'true',disabled:'false'});
 assert.deepEqual(sanitizeInventoryProperties('interface',projected),projected);
 assert.equal(sanitizeInventoryProperties('interface',{name:'ether1',password:'secret'}),null);
 assert.equal(sanitizeInventoryProperties('interface',{name:'ether1',comment:'private'}),null);
});
test('projection fields and backend fields only allow reviewed finite strings',()=>{
 const secret=/password|private-key|preshared-key|secret|comment|script|source|ssh-key/i;
 for(const [path,fields] of Object.entries(SAFE_ROUTEROS_DETAILS))
  for(const field of fields)assert.ok(!secret.test(field),path+': '+field);
 for(const [kind,fields] of Object.entries(INVENTORY_SAFE_PROPERTY_KEYS))
  for(const field of fields)assert.ok(!secret.test(field),kind+': '+field);
 assert.equal(sanitizeInventoryProperties('vlan',{'vlan-id':'101',name:'vlan101'})?.['vlan-id'],'101');
 assert.equal(sanitizeInventoryProperties('interface',{name:'a'.repeat(129)}),null);
 assert.equal(sanitizeInventoryProperties('interface',null),null);
 assert.deepEqual(sanitizeInventoryProperties('interface',undefined),{});
 assert.deepEqual(sanitizedRouterOsDetails('system/script',{source:'do not collect'}),{});
});
test('ingestion, SQL migration, RPC and browser inspector are connected',()=>{
 const connector=read('network-connector/agent.mjs');
 const api=read('src/app/api/network/agent/route.ts');
 const inventory=read('src/app/api/network/inventory/route.ts');
 const migration=read('supabase/migrations/20261110152239_mikrotik_administration_inventory.sql');
 const page=read('src/app/gestion-reseau/page.tsx');
 assert.ok(connector.includes('props:sanitizedRouterOsDetails(source.path,entry)'));
 assert.ok(api.includes('sanitizeInventoryProperties(kind,o.props)'));
 assert.ok(api.includes('safe_properties:safeProperties'));
 assert.ok(api.includes('if(safeProperties===null)return null'));
 assert.ok(inventory.includes('observed_at,safe_properties'));
 assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS safe_properties jsonb"));
 assert.ok(migration.includes("octet_length(safe_properties::text)<=2048"));
 assert.ok(migration.includes('m.observed_at,m.safe_properties,count(*) OVER()'));
 assert.ok(page.includes('Object.entries(selectedInventory.safe_properties||{})'));
 assert.ok(!page.includes('selectedInventory.password'));
});
