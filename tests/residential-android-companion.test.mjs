import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const android=p=>read('mobile/android-alarms/app/src/main/java/mg/compteinternet/alarmes/'+p);

test('Android companion preserves the existing web account but uses native pairing for sync',()=>{
 const main=android('MainActivity.java');
 const worker=android('AlarmSyncWorker.java');
 assert.match(main,/https:\/\/zaray\.vercel\.app/);
 assert.match(main,/alarm-devices\/claim/);
 assert.match(main,/DeviceStore\.associate/);
 assert.match(main,/AlarmSyncScheduler\.enqueueNow/);
 assert.match(main,/requestAlarmPermissions/);
 assert.match(main,/ACTION_REQUEST_SCHEDULE_EXACT_ALARM/);
 assert.match(main,/POST_NOTIFICATIONS/);
 assert.match(worker,/Authorization","Device "/);
 assert.doesNotMatch(main+worker,/SERVICE_ROLE_KEY|supabaseSecret|ZARAY_RESEND_API_KEY/);
});

test('WorkManager maintains unique network-constrained periodic and immediate jobs',()=>{
 const scheduler=android('AlarmSyncScheduler.java');
 const worker=android('AlarmSyncWorker.java');
 assert.match(scheduler,/PeriodicWorkRequest\.Builder/);
 assert.match(scheduler,/6,TimeUnit\.HOURS,1,TimeUnit\.HOURS/);
 assert.match(scheduler,/enqueueUniquePeriodicWork/);
 assert.match(scheduler,/ExistingPeriodicWorkPolicy\.KEEP/);
 assert.match(scheduler,/enqueueUniqueWork/);
 assert.match(scheduler,/ExistingWorkPolicy\.KEEP/);
 assert.match(scheduler,/NetworkType\.CONNECTED/);
 assert.match(scheduler,/BackoffPolicy\.EXPONENTIAL/);
 assert.match(worker,/Result\.retry\(\)/);
 assert.match(worker,/setConnectTimeout/);
 assert.match(worker,/setReadTimeout/);
 assert.match(worker,/DeviceStore\.sites/);
 assert.match(worker,/response==401\|\|response==403\|\|response==410/);
 assert.match(worker,/response!=200\)return false/);
});

test('Credentials are scoped per site and encrypted with hardware-backed Android Keystore when available',()=>{
 const store=android('DeviceStore.java');
 const migration=read('supabase/migrations/20261106100000_residential_alarm_devices.sql');
 const api=read('src/app/api/residential/alarm-devices/claim/route.ts');
 const access=read('src/lib/residential-alarm-device-access.ts');
 assert.match(store,/AndroidKeyStore/);
 assert.match(store,/AES\/GCM\/NoPadding/);
 assert.match(store,/PREF/);
 assert.match(store,/siteId/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all on public\.residential_alarm_devices from public,anon,authenticated/);
 assert.match(api,/\.is\('paired_at',null\)\.is\('token_hash',null\)/);
 assert.match(api,/pairing_hash/);
 assert.match(access,/deviceResident/);
 assert.match(access,/eq\('token_hash',hashDeviceSecret\(token\)\)/);
 assert.match(access,/\.eq\('status','active'\)/);
});

test('AlarmManager reconciles schedules, rejects duplicate IDs and stale alarms',()=>{
 const alarm=android('SiteAlarmScheduler.java');
 const receiver=android('PhoneAlarmReceiver.java');
 const reboot=android('PhoneRebootReceiver.java');
 const manifest=read('mobile/android-alarms/app/src/main/AndroidManifest.xml');
 assert.match(alarm,/removeScheduled\(ctx,siteId\)/);
 assert.match(alarm,/mgr\.cancel\(pi\)/);
 assert.match(alarm,/setExactAndAllowWhileIdle/);
 assert.match(alarm,/setAndAllowWhileIdle/);
 assert.match(alarm,/seen\.add\(id\)/);
 assert.match(alarm,/oldItem!=null/);
 assert.match(alarm,/currentReminder/);
 assert.match(alarm,/restoreAfterReboot/);
 assert.match(receiver,/SiteAlarmScheduler\.currentReminder/);
 assert.match(receiver,/dernière synchronisation/);
 assert.match(reboot,/ACTION_BOOT_COMPLETED/);
 assert.match(reboot,/ACTION_TIMEZONE_CHANGED/);
 assert.match(manifest,/SCHEDULE_EXACT_ALARM/);
 assert.match(manifest,/POST_NOTIFICATIONS/);
 assert.match(manifest,/RECEIVE_BOOT_COMPLETED/);
 assert.match(manifest,/usesCleartextTraffic="false"/);
 assert.match(manifest,/allowBackup="false"/);
});

test('The subscriber portal controls creation, single-use claims and remote unlink',()=>{
 const route=read('src/app/api/residential/alarm-devices/route.ts');
 const claim=read('src/app/api/residential/alarm-devices/claim/route.ts');
 const schedule=read('src/app/api/residential/alarm-schedule/route.ts');
 const ui=read('src/components/residential-alarm-preferences.tsx');
 assert.match(route,/sameOrigin\(req\)/);
 assert.match(route,/webResident\(siteId\)/);
 assert.match(route,/randomBytes\(32\)/);
 assert.match(route,/10\*60000/);
 assert.match(route,/revoked_at/);
 assert.match(claim,/token_hash/);
 assert.match(claim,/\.gt\('pairing_expires_at'/);
 assert.match(schedule,/authorization\.startsWith\('Device '\)/);
 assert.match(schedule,/deviceResident\(siteId/);
 assert.match(schedule,/await touchDevice/);
 assert.match(ui,/Associer un téléphone Android/);
 assert.match(ui,/Dissocier/);
});
