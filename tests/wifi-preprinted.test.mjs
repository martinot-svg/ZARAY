import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(path,'utf8');
const sql=source('supabase/migrations/20261029150000_preprinted_wifi_auto_redemption_ledger.sql');
const generate=source('src/app/api/wifi-vouchers/route.ts');
const agent=source('src/app/api/network/agent/route.ts');
const router=source('network-connector/agent.mjs');
const print=source('src/lib/ticket-pdf.ts');
const reprint=source('src/app/api/wifi-vouchers/batches/route.ts');
const cashier=source('src/app/api/wifi-vouchers/sell/route.ts');
test('generates router-bound vouchers before any cashier sale',()=>{
 assert.match(generate,/action:'provision_voucher'/);
 assert.match(generate,/network_state:'queued'/);
 assert.match(generate,/unit_price:offer.price_amount/);
 assert.match(generate,/max_devices:offer.max_devices/);
});
test('first authenticated Hotspot observation triggers atomic single-use ledger',()=>{
 assert.match(agent,/connectedNames/);
 assert.match(agent,/record_preprinted_wifi_logins/);
 assert.match(sql,/voucher_id uuid primary key/);
 assert.match(sql,/on conflict\(voucher_id\) do nothing/);
 assert.match(sql,/v.status='available'/);
 assert.match(sql,/n.network_state='provisioned'/);
});
test('manual cashier sale is retired',()=>{
 assert.match(cashier,/status:410/);
 assert.match(sql,/revoke execute on function public.sell_wifi_voucher/);
});
test('print exports use matching PDF and JPEG painter with secured stock reprints',()=>{
 assert.match(print,/generateA4Jpegs/);
 assert.match(print,/canvasPage\(sheet,page,logo\)/);
 assert.match(reprint,/network_state!=='provisioned'/);
 assert.match(reprint,/wifi.batch_reprint/);
});
test('MikroTik honors duration and concurrent device limit',()=>{
 assert.match(router,/'limit-uptime'/);
 assert.match(router,/'shared-users'/);
 assert.match(router,/ensureVoucherProfile/);
 assert.match(agent,/maxDevices:net!.max_devices/);
});
