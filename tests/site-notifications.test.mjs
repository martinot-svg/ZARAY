import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('notifications are persisted per company/site/customer and not exposed by direct grants',()=>{
 const sql=read('supabase/migrations/20261105155000_site_notification_ledger.sql');
 assert.match(sql,/create table if not exists public.site_notifications/);
 assert.match(sql,/company_id uuid not null/);
 assert.match(sql,/site_id uuid not null/);
 assert.match(sql,/customer_id uuid references/);
 assert.match(sql,/create table if not exists public.site_notification_reads/);
 assert.match(sql,/primary key \(notification_id,user_id\)/);
 assert.match(sql,/revoke all on public.site_notifications from public,anon,authenticated/);
 assert.match(sql,/revoke all on public.site_notification_reads from public,anon,authenticated/);
 assert.match(sql,/subscription_order_site_notification/);
 assert.match(sql,/on conflict \(source_order_id,kind\) do nothing/);
});

test('resident notifications require verified email, customer-site matching and tenant scoping',()=>{
 const route=read('src/app/api/residential/notifications/route.ts');
 assert.match(route,/session.auth.getUser\(\)/);
 assert.match(route,/user.email_confirmed_at/);
 assert.match(route,/\.eq\('company_id',site.company_id\)\.eq\('site_id',siteId\)/);
 assert.match(route,/\.eq\('email',user.email.toLowerCase\(\)\)/);
 assert.match(route,/\.eq\('customer_id',customer!.id\)/);
 assert.match(route,/\.eq\('user_id',user!.id\)/);
 assert.doesNotMatch(route,/body\?\.customerId/);
});

test('company notifications are restricted to verified owner/admin accounts',()=>{
 const route=read('src/app/api/notifications/route.ts');
 assert.match(route,/authorizeTenant\(session,companyId,siteId\)/);
 assert.match(route,/\['owner','admin'\]\.includes\(access.member.role\)/);
 assert.match(route,/\.eq\('company_id',companyId\)/);
 assert.match(route,/\.eq\('user_id',context.userId!\)/);
});

test('both private resident and admin inbox are wired into the live interface',()=>{
 const portal=read('src/components/residential-account-portal.tsx');
 const app=read('src/components/app-shell.tsx');
 const page=read('src/app/notifications/page.tsx');
 const inbox=read('src/components/notification-inbox.tsx');
 assert.match(portal,/<NotificationInbox siteId=\{siteId\} compact \/>/);
 assert.match(app,/aria-label="Centre de notifications"/);
 assert.match(page,/<NotificationInbox companyId=\{companyId\} siteId=\{siteId\}/);
 assert.match(inbox,/setItems\(prev=>prev.map/);
 assert.doesNotMatch(inbox,/ZARAY/);
});
