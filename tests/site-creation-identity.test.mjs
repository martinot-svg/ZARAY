import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('every new site is created with name address email phone and branded identity atomically',()=>{
 const migration=read('supabase/migrations/20261106142000_site_creation_identity.sql');
 const route=read('src/app/api/sites/route.ts');
 assert.match(migration,/add column if not exists address text/);
 assert.match(migration,/add column if not exists contact_email text/);
 assert.match(migration,/add column if not exists contact_phone text/);
 assert.match(migration,/create or replace function public\.create_site_with_branding/);
 assert.match(migration,/insert into public\.sites\(company_id,name,status,address,contact_email,contact_phone\)/);
 assert.match(migration,/insert into public\.ticket_templates\(/);
 assert.match(migration,/logo_data_uri,brand_name/);
 assert.match(migration,/p_actor_user_id/);
 assert.match(migration,/m\.role in \('owner','admin'\)/);
 assert.match(migration,/grant execute on function public\.create_site_with_branding\(.*\) to service_role/);
 assert.match(migration,/from public,anon,authenticated/);
 assert.match(route,/authorizeTenant\(session,companyId\)/);
 assert.match(route,/normalizeTransparentSiteLogo\(logo\)/);
 assert.match(route,/service\.rpc\('create_site_with_branding'/);
 assert.match(route,/p_actor_user_id:permission\.user\.id/);
 assert.doesNotMatch(route,/\.from\('sites'\)\s*\.insert\(/);
});

test('the site creation UI requires five fields and live cropped-logo previews',()=>{
 const form=read('src/components/site-create-form.tsx');
 const page=read('src/app/sites/page.tsx');
 for(const key of ['setName','setAddress','setEmail','setPhone','setLogoDataUri']){
  assert.ok(form.includes(key),key);
 }
 assert.match(form,/type="email"/);
 assert.match(form,/type="tel"/);
 assert.match(form,/accept="image\/png,image\/webp"/);
 assert.match(form,/optimizeLogo\(uri\)/);
 assert.match(form,/paletteFromLogo\(optimized\.dataUri\)/);
 assert.match(form,/APERÇU TICKET/);
 assert.match(form,/APERÇU PORTAIL CAPTIF/);
 assert.match(form,/!logoDataUri/);
 assert.match(page,/SiteCreateForm/);
 assert.match(page,/canCreate=/);
 assert.match(page,/\['owner','admin'\]/);
});

test('server refuses opaque logos and crops only exact alpha=0 border pixels',()=>{
 const server=read('src/lib/site-logo-server.ts');
 assert.match(server,/import sharp from 'sharp'/);
 assert.match(server,/data:image\\\/(png\|webp)/);
 assert.match(server,/metadata\.hasAlpha/);
 assert.match(server,/if\(alpha===0\)/);
 assert.match(server,/corners\.every\(a=>a===255\)/);
 assert.match(server,/\.extract\(bounds\)/);
 assert.match(server,/\.png\(\{compressionLevel:9\}\)/);
 assert.doesNotMatch(server,/removeBackground|segment|threshold|flatten\(/);
});

test('transparent white logos obtain contrasting ticket backgrounds',async()=>{
 const source=read('src/lib/logo-palette.ts');
 const js=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022
 }}).outputText;
 const {paletteFromPixels}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(js));
 const pale=new Uint8ClampedArray(Array.from({length:80},()=>[249,249,249,255]).flat());
 const dark=new Uint8ClampedArray(Array.from({length:80},()=>[33,33,33,255]).flat());
 assert.equal(paletteFromPixels(pale)?.secondary_color,'#102334');
 assert.equal(paletteFromPixels(pale)?.title_color,'#F6FAFE');
 assert.equal(paletteFromPixels(dark)?.secondary_color,'#FFFFFF');
});

test('ticket and both captive portals display the same cropped logo on their surfaces',()=>{
 const ticket=read('src/lib/ticket-pdf.ts');
 const editor=read('src/components/wifi-ticket-customization.tsx');
 const api=read('src/app/api/ticket-templates/route.ts');
 const html=read('public/hotspot/zaray-login.html');
 const web=read('src/components/public-wifi-portal.css');
 const identity=read('src/lib/residential-site-identity.ts');
 assert.match(ticket,/ctx\.drawImage\(img,/);
 assert.match(ticket,/design\.email/);
 assert.match(api,/address,email,welcome_message/);
 assert.match(editor,/secondaryColor:base\.secondary_color/);
 assert.match(editor,/contactEmail:String\(base\.email/);
 assert.match(html,/main \.panel\{background:var\(--site-panel-bg/);
 assert.match(html,/contactEmail/);
 assert.match(web,/background:var\(--zw-site-secondary/);
 assert.match(web,/\.zw-site-logo\{/);
 assert.match(identity,/contactEmail:String\(site\.contact_email/);
});
