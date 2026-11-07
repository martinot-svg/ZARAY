import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ui=read('src/components/wifi-ticket-generator.tsx');
const painter=read('src/lib/ticket-pdf.ts');
const voucherApi=read('src/app/api/wifi-vouchers/route.ts');
const studio=read('src/components/site-portal-studio.tsx');
const docs=read('docs/captive-portal-studio-v1.md');

test('offline specimens cannot be mistaken for provisioned Wi-Fi credentials',()=>{
 const start=ui.indexOf('function demonstrationTickets(');
 const stop=ui.indexOf('export default function WifiTicketGenerator',start);
 assert.ok(start>0&&stop>start);
 const factory=ui.slice(start,stop);
 assert.match(factory,/username:'DEMO'/);
 assert.match(factory,/password:'0000'/);
 assert.match(factory,/status:'demo'/);
 assert.doesNotMatch(factory,/fetch\(|wifi_vouchers|network_commands|createServiceClient|localStorage/);
 assert.match(ui,/Les identifiants DEMO \/ 0000 sont fictifs/);
 assert.match(ui,/ni enregistrés ni vendables/);
});

test('every rendered sample gets a visible watermark in shared canvas, including A4 PDF',()=>{
 assert.match(painter,/if\(ticket\.status==='demo'\)/);
 assert.match(painter,/DÉMO — NON VALABLE/);
 assert.match(painter,/paintVoucher\(ctx,x,y,arr\[i\],sheet\.design,sheet\.siteName,logo\)/);
 assert.match(painter,/generateA4Pdf/);
 assert.match(ui,/generateA4Pdf\(\{siteName:site\.name,design,tickets:specimens\}\)/);
 assert.match(ui,/ZARAY-DEMONSTRATION-NON-VALABLE\.pdf/);
 assert.match(ui,/<VoucherCanvas preview ticket=\{specimen\}/);
});

test('real voucher generation remains router-bound, with no fallback to sample credentials',()=>{
 assert.match(voucherApi,/!router\.control_enabled\|\|!router\.last_seen_at/);
 assert.match(voucherApi,/action:'provision_voucher'/);
 assert.match(ui,/routerId:selectedRouterId/);
 assert.match(ui,/!selectedRouterId\|\|busy/);
 assert.match(ui,/const list=await authorizedPrint\(\)/);
 assert.match(ui,/const specimens=demonstrationTickets\(offer,count\)/);
 assert.doesNotMatch(ui,/status:'available'\s*\}\s*\)\s*;/);
});

test('studio opens preparation for the selected company and site without adding a new module',()=>{
 assert.match(studio,/Prévisualiser les tickets sans routeur/);
 assert.match(studio,/\/tickets\?companyId=/);
 assert.match(studio,/encodeURIComponent\(siteId\)\+'&tab=generate'/);
 assert.match(docs,/Mode préparation sans MikroTik/);
});
