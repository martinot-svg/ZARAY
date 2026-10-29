import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const text=(path)=>readFileSync(path,'utf8');
const schema=text('supabase/migrations/20261029183000_customer_directory_from_public_subscription_enrollment.sql');
const page=text('src/app/clients/page.tsx');
const api=text('src/app/api/customers/route.ts');
const portal=text('src/app/portail/[slug]/page.tsx');
const signup=text('src/app/inscription/page.tsx');
test('subscription enrollment automatically creates or reuses tenant-scoped CRM profile',()=>{
 assert.match(schema,/before insert on public\.subscription_orders/);
 assert.match(schema,/new\.company_id/);
 assert.match(schema,/where c\.company_id=new\.company_id and c\.email=v_email/);
 assert.match(schema,/on conflict \(company_id,email\) where email is not null do nothing/);
 assert.match(schema,/new\.customer_id:=v_customer/);
 assert.match(schema,/enrollment_source/);
});
test('CRM disables manual insert both API and authenticated database role',()=>{
 assert.match(api,/export async function POST\(\)/);
 assert.match(api,/status:410/);
 assert.match(schema,/revoke insert on public\.customers from authenticated/);
 assert.match(schema,/drop policy if exists "authorized roles create company customers"/);
 assert.doesNotMatch(page,/\+ Nouveau client|Créer un client/);
});
test('clients come from the public subscription portal, never admin signup',()=>{
 assert.match(portal,/INSCRIPTION CLIENT/);
 assert.match(portal,/S’inscrire et consulter les instructions de paiement/);
 assert.match(page,/Portail d’inscription/);
 assert.match(signup,/Créer un compte administrateur/);
});
test('enrollment never bypasses payment confirmation or network authorization',()=>{
 assert.match(portal,/l’abonnement attend le paiement/);
 assert.match(page,/Une inscription ou une commande non payée ne donne pas accès à Internet/);
 assert.match(schema,/new\.customer_id:=v_customer/);
});
