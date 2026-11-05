import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('opt-in email preferences are private, tenant-bound and false by default',()=>{
 const migration=read('supabase/migrations/20261105185000_residential_notification_delivery.sql');
 assert.match(migration,/create table if not exists public.residential_notification_preferences/);
 assert.match(migration,/email_enabled boolean not null default false/);
 assert.match(migration,/c.site_id=new.site_id and c.status='active'/);
 assert.match(migration,/revoke all on public.residential_notification_preferences from public,anon,authenticated/);
 assert.match(migration,/alter table public.residential_notification_preferences enable row level security/);
 const route=read('src/app/api/residential/notification-preferences/route.ts');
 assert.match(route,/session.auth.getUser\(\)/);
 assert.match(route,/user.email_confirmed_at/);
 assert.match(route,/\.eq\('company_id',site.company_id\)\.eq\('site_id',siteId\)/);
 assert.match(route,/\.eq\('email',user.email.trim\(\).toLowerCase\(\)\)/);
 assert.match(route,/request.headers.get\('origin'\)!==request.nextUrl.origin/);
 assert.match(route,/typeof emailEnabled!=='boolean'/);
 assert.match(route,/if\(emailEnabled&&!\(await readiness/);
 assert.doesNotMatch(route,/body\?\.customerId/);
});

test('expiry reminders use real activated subscriptions, Malagasy calendar and deduplication',()=>{
 const sql=read('supabase/migrations/20261105185000_residential_notification_delivery.sql');
 assert.match(sql,/kind in \('subscription_created','payment_confirmed','subscription_expiring'\)/);
 assert.match(sql,/join public.residential_subscriptions|from public.residential_subscriptions/);
 assert.match(sql,/r.paid_cycles>0 and r.activated_cycles>0/);
 assert.match(sql,/at time zone 'Indian\/Antananarivo'/);
 assert.match(sql,/p.days_left in \(7,3,1\)/);
 assert.match(sql,/on conflict \(event_key\) do nothing/);
});

test('email jobs are queued only after opt-in and verified customer domain',()=>{
 const sql=read('supabase/migrations/20261105185000_residential_notification_delivery.sql');
 assert.match(sql,/p.email_enabled=true/);
 assert.match(sql,/d.status='active' and d.verified_at is not null/);
 assert.match(sql,/create table if not exists public.residential_notification_email_jobs/);
 assert.match(sql,/notification_id uuid primary key/);
 assert.match(sql,/for update skip locked/);
 assert.match(sql,/j.attempts<3/);
 assert.match(sql,/revoke all on public.residential_notification_email_jobs from public,anon,authenticated/);
});

test('server-only email sender is idempotent and has no vendor-branding in resident message',()=>{
 const mail=read('src/lib/customer-notification-email.ts');
 assert.match(mail,/import 'server-only'/);
 assert.match(mail,/process.env.ZARAY_RESEND_API_KEY\|\|process.env.RESEND_API_KEY/);
 assert.match(mail,/Idempotency-Key/);
 assert.match(mail,/resident-'\+notificationId/);
 assert.match(mail,/https:\/\/api.resend.com\/emails/);
 assert.match(mail,/https:\/\/'\+hostname\+'\//);
 assert.match(mail,/escapeHtml\(title\)/);
 assert.match(mail,/if\(\/zaray\/i.test\(sender\)\)return null/);
});

test('cron is secret-protected, daily on Hobby and cancels emails when opted out',()=>{
 const worker=read('src/app/api/cron/residential-notifications/route.ts');
 const schedule=JSON.parse(read('vercel.json'));
 assert.deepEqual(schedule.crons,[{path:'/api/cron/residential-notifications',schedule:'0 6 * * *'}]);
 assert.match(worker,/process.env.CRON_SECRET/);
 assert.match(worker,/timingSafeEqual/);
 assert.match(worker,/create_residential_expiry_reminders/);
 assert.match(worker,/claim_residential_email_jobs/);
 assert.match(worker,/pref\?\.email_enabled!==true/);
 assert.match(worker,/customerEmailDeliveryReady\(\)/);
 assert.match(worker,/status:'cancelled'/);
 const proxy=read('proxy.ts');
 assert.match(proxy,/\/api\/residential\/notification-preferences/);
 const component=read('src/components/residential-account-portal.tsx');
 assert.match(component,/<ResidentialNotificationPreferences siteId=\{siteId\}/);
});
