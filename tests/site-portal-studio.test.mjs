import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=get('supabase/migrations/20261106151000_site_portal_studio.sql');
const admin=get('src/app/api/site-portal/route.ts');
const publicApi=get('src/app/api/public/site-portal/route.ts');
const core=get('src/lib/site-portal-config.ts');
const studio=get('src/components/site-portal-studio.tsx');
const web=get('src/components/public-wifi-portal.tsx');
const native=get('public/hotspot/zaray-login.html');
const exportPage=get('src/components/wifi-ticket-customization.tsx');
const adminPage=get('src/app/portail/page.tsx');

test('site drafts and publications are isolated, versioned and server-only',()=>{
 assert.match(sql,/create table if not exists public.site_portal_configs/);
 assert.match(sql,/site_id uuid primary key references public.sites\(id\)/);
 assert.match(sql,/company_id uuid not null references public.companies\(id\)/);
 assert.match(sql,/create table if not exists public.site_portal_versions/);
 assert.match(sql,/primary key\(site_id,version\)/);
 assert.match(sql,/enable row level security/g);
 assert.match(sql,/revoke all on public.site_portal_configs from public,anon,authenticated/);
 assert.match(sql,/revoke all on public.site_portal_versions from public,anon,authenticated/);
 assert.match(sql,/for update/);
 assert.match(sql,/draft_conflict/);
 assert.match(sql,/p_expected_revision/);
 assert.match(sql,/insert into public.site_portal_versions/);
 assert.doesNotMatch(sql,/drop table|truncate|delete from public\.(customers|sites|companies)/i);
});

test('public portal endpoint never exposes drafts or cross-company data',()=>{
 assert.match(publicApi,/\.eq\('status','active'\)/);
 assert.match(publicApi,/\['trial','active'\]/);
 assert.match(publicApi,/\.eq\('company_id',site.company_id\)/);
 assert.match(publicApi,/\.eq\('site_id',siteId\)/);
 assert.match(publicApi,/\.select\('published,published_version'\)/);
 assert.doesNotMatch(publicApi,/\.select\('draft/);
 assert.match(publicApi,/readPortalConfig\(row\?\.published\)/);
});

test('the administration only saves and publishes with verified tenant membership',()=>{
 assert.match(admin,/authorizeTenant\(session,companyId,siteId\)/);
 assert.match(admin,/\['owner','admin'\]/);
 assert.match(admin,/originAllowed\(request\)/);
 assert.match(admin,/\.eq\('draft_revision',expectedRevision\)/);
 assert.match(admin,/publish_site_portal/);
 assert.match(admin,/restore_site_portal_draft/);
 assert.match(admin,/sourceSiteId/);
 assert.match(admin,/source\?\.published/);
 assert.match(admin,/saveDraft\(ctx.service,companyId,siteId,revision,config\)/);
});

test('eight safe templates, size-limited image and strict allowlisted values',()=>{
 for(const name of ['minimal','premium','corporate','modern-tech','residential','commercial','elegant','custom'])
  assert.ok(core.includes("key:'"+name+"'"),name);
 assert.match(core,/parsePortalConfig/);
 assert.match(core,/Object\.keys\(object\)\.some/);
 assert.match(core,/cornerRadius/);
 assert.match(core,/length>145000/);
 assert.match(core,/png\|webp/);
 assert.match(core,/showSubscribe/);
});

test('studio offers live preview, explicit publication and site-only restore/duplicate',()=>{
 assert.match(studio,/ps-preview-frame/);
 assert.match(studio,/is-mobile/);
 assert.match(studio,/is-desktop/);
 assert.match(studio,/PORTAL_TEMPLATES\.map/);
 assert.match(studio,/JSON\.stringify\(form\)!==JSON\.stringify\(state\.draft\)/);
 assert.match(studio,/window\.confirm\('Publier cette version/);
 assert.match(studio,/action:'restore'/);
 assert.match(studio,/action:'duplicate'/);
 assert.match(studio,/sourceSiteId:sourceId/);
 assert.match(studio,/expectedRevision:state\.revision/);
 assert.match(studio,/Le portail public reste inchangé/);
 assert.match(adminPage,/\/portail\/editeur/);
});

test('web portal applies published branding only and retains separate native authentication',()=>{
 assert.match(web,/\/api\/public\/site-portal\?siteId=/);
 assert.match(web,/readPortalConfig\(result\.published\)/);
 assert.match(web,/portalDesign\?\.showOffers/);
 assert.match(web,/portalDesign\?\.showSubscribe/);
 assert.match(web,/portalDesign\?\.showAccount/);
 assert.match(web,/termsText/);
 assert.match(web,/privacyText/);
 assert.match(web,/function previewTicket/);
 assert.match(web,/Aucune donnée n’a été envoyée/);
 assert.doesNotMatch(web,/fetch\([^)]*ticketPassword/);
});

test('downloaded RouterOS login receives a published snapshot while keeping CHAP and HTTPS guards',()=>{
 assert.match(exportPage,/\/api\/public\/site-portal\?siteId=/);
 assert.match(exportPage,/publishedData\.published\?\?null/);
 assert.match(exportPage,/replaceAll\('__ZARAY_PORTAL_JSON__',safePortal\)/);
 assert.match(native,/__ZARAY_PORTAL_JSON__/);
 assert.match(native,/applyPublishedPortal/);
 assert.match(native,/data-portal-template/);
 assert.match(native,/form name="login" method="post" action="\$\(link-login-only\)"/);
 assert.match(native,/hexMD5\('\$\(chap-id\)'\+password\+'\$\(chap-challenge\)'\)/);
 assert.match(native,/location\.protocol!=='https:'/);
 assert.match(native,/on[a-z]+=/i); // existing RouterOS form handler is preserved
 assert.doesNotMatch(native,/supabase_service_role|ZARAY_RESEND_API_KEY/i);
});
