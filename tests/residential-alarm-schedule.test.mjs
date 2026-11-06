import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('resident alarm consent stays private, optional and scoped to existing active customer',()=>{
 const sql=read('supabase/migrations/20261106090000_residential_native_alarm_consent.sql');
 const previous=read('supabase/migrations/20261105185000_residential_notification_delivery.sql');
 assert.match(sql,/alarm_enabled boolean not null default false/);
 assert.match(sql,/alarm_hour smallint not null default 8/);
 assert.match(sql,/alarm_days integer\[\] not null default array\[7,3,1,0\]/);
 assert.match(sql,/alarm_days <@ array\[0,1,3,7\]/);
 assert.match(previous,/enable row level security/);
 assert.match(previous,/revoke all on public\.residential_notification_preferences from public,anon,authenticated/);
 assert.match(previous,/c\.site_id=new\.site_id and c\.status='active'/);
});

test('only authenticated site customer may read, configure or export the real alarm schedule',()=>{
 const api=read('src/app/api/residential/alarm-schedule/route.ts');
 assert.match(api,/auth\.getUser\(\)/);
 assert.match(api,/auth\.getUser\(bearer\[1\]\)/);
 assert.match(api,/user\.email_confirmed_at/);
 assert.match(api,/publicResidentialSite\(siteId\)/);
 assert.match(api,/\.eq\('company_id',siteRow\.company_id\)\.eq\('site_id',siteId\)/);
 assert.match(api,/\.eq\('customer_id',ctx\.customerId\)/);
 assert.match(api,/\.gt\('paid_cycles',0\)\.gt\('activated_cycles',0\)/);
 assert.match(api,/format'\)==='ics'/);
 assert.match(api,/origin!==request\.nextUrl\.origin/);
 assert.match(api,/Content-Disposition/);
 assert.doesNotMatch(api,/service_role_key|NEXT_PUBLIC_SUPABASE_SECRET|customerId=request/);
});

test('calendar fallback uses only confirmed future reminders from Madagascar timezone',()=>{
 const schedule=read('src/lib/residential-alarm-schedule.ts');
 assert.match(schedule,/RESIDENT_ALARM_TIME_ZONE='Indian\/Antananarivo'/);
 assert.match(schedule,/Date\.UTC\(y,m-1,d,hour-3,0,0\)/);
 assert.match(schedule,/validDays\.has\(daysBefore\)/);
 assert.match(schedule,/Date\.parse\(reminder\.scheduledAt\)>now\.getTime\(\)/);
 assert.match(schedule,/subscriberReminderName\(site\)/);
 assert.match(schedule,/BEGIN:VCALENDAR/);
 assert.match(schedule,/BEGIN:VALARM/);
 assert.match(schedule,/TRIGGER:-PT0M/);
 assert.match(schedule,/icsEscape/);
});

test('web UI presents honest OS permission state, and branded hosts can use site-scoped API',()=>{
 const component=read('src/components/residential-alarm-preferences.tsx');
 const portal=read('src/components/residential-account-portal.tsx');
 const proxy=read('proxy.ts');
 assert.match(component,/Je souhaite synchroniser mes alarmes/);
 assert.match(component,/Alarmes de mon abonnement/);
 assert.match(component,/format=ics/);
 assert.match(component,/nécessitent encore l’installation et l’autorisation/);
 assert.match(portal,/<ResidentialAlarmPreferences siteId=\{siteId\}/);
 assert.match(proxy,/\/api\/residential\/alarm-schedule/);
});
