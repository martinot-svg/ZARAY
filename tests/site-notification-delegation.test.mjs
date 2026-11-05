import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('notification assignments are company+site+user scoped and inaccessible directly to browsers',()=>{
 const migration=read('supabase/migrations/20261105173500_site_notification_assignments.sql');
 assert.match(migration,/primary key\(company_id,site_id,user_id\)/);
 assert.match(migration,/foreign key\(company_id,user_id\) references public.company_members/);
 assert.match(migration,/s.id=new.site_id and s.company_id=new.company_id/);
 assert.match(migration,/m.status='active' and m.role='site_manager'/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all on public.site_notification_assignments from public,anon,authenticated/);
});

test('only company owner/admin may assign a currently active site manager',()=>{
 const route=read('src/app/api/site-notification-assignments/route.ts');
 assert.match(route,/authorizeTenant\(client,companyId,siteId\)/);
 assert.match(route,/\['owner','admin'\]\.includes\(access.member.role\)/);
 assert.match(route,/\.eq\('status','active'\)\.eq\('role','site_manager'\)/);
 assert.match(route,/\.eq\('company_id',companyId\)\.eq\('site_id',siteId\)\.eq\('user_id',userId\)/);
 assert.match(route,/notification.site_access_granted/);
 assert.match(route,/notification.site_access_revoked/);
});

test('site managers cannot read general notifications or sites that were not assigned',()=>{
 const route=read('src/app/api/notifications/route.ts');
 const scope=read('src/app/api/my-notification-sites/route.ts');
 assert.match(route,/if\(companyId==='all'\)/);
 assert.match(route,/\['owner','admin'\]\.includes\(x.role\)/);
 assert.match(route,/access.member.role!=='site_manager'\|\|!siteId/);
 assert.match(route,/\.eq\('company_id',companyId\)\.eq\('site_id',siteId\)/);
 assert.match(route,/if\(!assignment\)return \{response:json\(\{error:/);
 assert.match(scope,/\.eq\('user_id',user.id\)\.in\('company_id',companyIds\)/);
 assert.match(scope,/m.role==='site_manager'/);
});

test('site managers only see assigned options in the notification center',()=>{
 const page=read('src/app/notifications/page.tsx');
 assert.match(page,/fetch\('\/api\/my-notification-sites'/);
 assert.match(page,/scope.sites/);
 assert.match(page,/c.role==='site_manager'&&allowed.some/);
 assert.match(page,/admin\(role\)\|\|assigned.some/);
 assert.match(page,/!canOpen\?/);
 const settings=read('src/app/sites/[siteId]/notifications/page.tsx');
 const sites=read('src/app/sites/page.tsx');
 assert.match(settings,/\/api\/site-notification-assignments/);
 assert.match(settings,/checked=\{assigned.includes\(m.user_id\)\}/);
 assert.match(sites,/\/notifications\?companyId=/);
});
