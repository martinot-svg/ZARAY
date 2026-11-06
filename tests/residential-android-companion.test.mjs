import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Android companion uses server-authorized site schedule, never private API secrets',()=>{
 const main=read('mobile/android-alarms/app/src/main/java/mg/compteinternet/alarmes/MainActivity.java');
 assert.match(main,/https:\/\/zaray\.vercel\.app/);
 assert.match(main,/api\/residential\/alarm-schedule\?siteId=/);
 assert.match(main,/CookieManager\.getInstance\(\)\.getCookie/);
 assert.match(main,/getResponseCode\(\)/);
 assert.match(main,/selected\.equals\(site\.optString\("id"\)\)/);
 assert.match(main,/SiteAlarmScheduler\.synchronize\(this,data\)/);
 assert.match(main,/requestAlarmPermissions\(\)/);
 assert.match(main,/ACTION_REQUEST_SCHEDULE_EXACT_ALARM/);
 assert.match(main,/POST_NOTIFICATIONS/);
 assert.doesNotMatch(main,/SERVICE_ROLE_KEY|supabaseSecret|ZARAY_RESEND_API_KEY/);
});

test('Android alarms are local, site-scoped, cancellable and restored after reboot',()=>{
 const alarm=read('mobile/android-alarms/app/src/main/java/mg/compteinternet/alarmes/SiteAlarmScheduler.java');
 const receiver=read('mobile/android-alarms/app/src/main/java/mg/compteinternet/alarmes/PhoneAlarmReceiver.java');
 const reboot=read('mobile/android-alarms/app/src/main/java/mg/compteinternet/alarmes/PhoneRebootReceiver.java');
 const manifest=read('mobile/android-alarms/app/src/main/AndroidManifest.xml');
 assert.match(alarm,/String siteId=site\.optString\("id"\)/);
 assert.match(alarm,/removeScheduled\(ctx,siteId\)/);
 assert.match(alarm,/mgr\.cancel\(pi\)/);
 assert.match(alarm,/setExactAndAllowWhileIdle/);
 assert.match(alarm,/setAndAllowWhileIdle/);
 assert.match(alarm,/if\(when<=System\.currentTimeMillis\(\)\)continue/);
 assert.match(alarm,/restoreAfterReboot/);
 assert.match(receiver,/Notification\.Builder/);
 assert.match(receiver,/siteId/);
 assert.match(reboot,/ACTION_BOOT_COMPLETED/);
 assert.match(manifest,/SCHEDULE_EXACT_ALARM/);
 assert.match(manifest,/POST_NOTIFICATIONS/);
 assert.match(manifest,/RECEIVE_BOOT_COMPLETED/);
 assert.match(manifest,/usesCleartextTraffic="false"/);
});
