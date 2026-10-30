import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const page=read('src/app/commandes/page.tsx');
const api=read('src/app/api/subscription-orders/route.ts');
const verification=read('src/app/paiements/verification/page.tsx');
const styles=read('src/app/commandes/orders-workspace.css');

test('commands remain tenant-isolated and originate from subscription portal, not manual entry',()=>{
 assert.match(api,/authorizeTenant\(supabase,companyId,siteId\)/);
 assert.match(api,/\.eq\('company_id',companyId\)/);
 assert.match(api,/if\(siteId\)q=q\.eq\('site_id',siteId\)/);
 assert.match(page,/créées automatiquement sur vos portails/);
 assert.doesNotMatch(page,/Créer une commande|Nouvelle commande/);
 assert.match(api,/record_subscription_cash_payment/);
});
test('server exposes accurate scoped metrics independent from list pagination',()=>{
 assert.match(api,/count:'exact'/);
 assert.match(api,/total:total\.count/);
 assert.match(api,/unpaid:unpaid\.count/);
 assert.match(api,/paid:paid\.count/);
 assert.match(api,/activation:activation\.count/);
 assert.match(api,/range\(offset,offset\+pageSize-1\)/);
 assert.match(api,/params\.get\('from'\)/);
 assert.match(api,/params\.get\('to'\)/);
});
test('orders workspace provides all, processing and history tabs, search, dates, paging',()=>{
 assert.match(page,/role="tablist"/);
 assert.match(page,/Toutes les commandes/);
 assert.match(page,/À traiter/);
 assert.match(page,/Historique/);
 assert.match(page,/Rechercher une commande/);
 assert.match(page,/type="date"/);
 assert.match(page,/Page \{page\} sur \{totalPages\}/);
 assert.match(styles,/@media\(max-width:960px\)/);
 assert.match(styles,/@media\(max-width:560px\)/);
});
test('order detail ties client, payment and activation without pretending payment is internet access',()=>{
 assert.match(page,/Détails de la commande/);
 assert.match(page,/Timeline order=\{selected\}/);
 assert.match(api,/customer_id/); // persisted customer link is available from the API
 assert.match(page,/paiement\/'\+encodeURIComponent\(selected\.public_reference\)/);
 assert.match(page,/Une inscription ou un paiement ne signifie pas que l’accès Internet est actif/);
});
test('manual proof approval is delegated to authorized payment review workspace',()=>{
 assert.match(page,/manual-payments\/access\?companyId=/);
 assert.match(page,/canReview/);
 assert.match(page,/\/paiements\/verification/);
 assert.match(verification,/params\.get\('orderRef'\)/);
 assert.match(page,/Encaisser en espèces et créer le reçu/);
 assert.match(page,/window\.confirm/);
 assert.match(page,/window\.print/);
});
