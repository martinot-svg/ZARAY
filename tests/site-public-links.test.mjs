import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('free public links are separate from DNS domains and server-write only',()=>{
 const sql=read('supabase/migrations/20261105173000_internal_site_public_links.sql');
 assert.match(sql,/create table if not exists public\.site_public_links/);
 assert.match(sql,/alias text not null unique/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.site_public_links from public, anon, authenticated/);
 assert.match(sql,/status='pending'/);
 assert.match(sql,/on conflict do nothing/);
});

test('admins can create free links with tenant-scoped access and no Vercel dependency',()=>{
 const api=read('src/app/api/site-links/route.ts');
 assert.match(api,/authorizeTenant\(client,companyId,siteId\)/);
 assert.match(api,/\['owner','admin'\]/);
 assert.match(api,/\.from\('site_public_links'\)/);
 assert.doesNotMatch(api,/checkSiteProjectDomain|ZARAY_VERCEL_API_TOKEN|\.status:'active'/);
});

test('public link redirects to the linked site registration, not an unverified DNS hostname',()=>{
 const route=read('src/app/l/[alias]/route.ts');
 assert.match(route,/\.eq\('alias',alias\)/);
 assert.match(route,/site\.status!=='active'/);
 assert.match(route,/company\.status/);
 assert.match(route,/\/wifi\/.*encodeURIComponent\(company.slug\)/);
 assert.match(route,/redirect\.searchParams\.set\('siteId',site\.id\)/);
 assert.match(route,/redirect\.searchParams\.set\('inscription','1'\)/);
 assert.match(route,/NextResponse\.redirect\(redirect/);
 assert.doesNotMatch(route,/https:\/\/.*alias/);
 const portal=read('src/components/public-wifi-portal.tsx');
 assert.match(portal,/startInSubscription\|\|new URLSearchParams\(window.location.search\).get\('inscription'\)==='1'/);
});

test('site UI shares a ZARAY URL rather than suggesting domain ownership',()=>{
 const settings=read('src/app/sites/[siteId]/domaine/page.tsx');
 assert.match(settings,/Lien public du site/);
 assert.match(settings,/Aucun achat de domaine ni réglage DNS/);
 assert.match(settings,/origin\+link\.path/);
 assert.match(settings,/navigator\.clipboard\.writeText\(publicUrl\)/);
 assert.doesNotMatch(settings,/Vérifier maintenant|Ouvrir la configuration Vercel/);
});
