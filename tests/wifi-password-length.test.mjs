import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(path,'utf8');

test('template API and UI allow password length from 3 to 5',()=>{
 const api=read('src/app/api/ticket-templates/route.ts');
 const ui=read('src/components/wifi-ticket-customization.tsx');
 assert.match(api,/password_length:5/);
 assert.match(api,/\(n<3\|\|n>5\)/);
 assert.match(ui,/Longueur du mot de passe \(3–5\)/);
 assert.match(ui,/min=\{3\} max=\{5\} value=\{form\.password_length\}/);
});

test('new ticket generator uses the 3-5 bound, default 5',()=>{
 const source=read('src/app/api/wifi-vouchers/route.ts');
 const generator=read('src/components/wifi-ticket-generator.tsx');
 assert.match(source,/passwordLength<3\|\|passwordLength>5/);
 assert.match(source,/\?\?general\?\.password_length\?\?5/);
 assert.match(generator,/password_length:5/);
});

test('older tickets with 12-32-char passwords remain provisionable',()=>{
 const secret=read('src/lib/network-voucher-secret.ts');
 const connector=read('network-connector/agent.mjs');
 assert.match(secret,/length<3\|\|length>32/);
 assert.match(connector,/\{3,32\}/);
 const migration=read('supabase/migrations/20261029121000_wifi_voucher_password_length_3_to_5.sql');
 assert.match(migration,/password_length between 3 and 32/);
 assert.match(migration,/password_length between 3 and 5/);
});
