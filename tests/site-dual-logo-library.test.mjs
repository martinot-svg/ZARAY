import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const selection=read('src/lib/site-logo-variants.ts');
const js=ts.transpileModule(selection,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {siteLogoForSurface,darkSurface}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(js));

test('light and dark logo artwork follows background luminance without recoloring',()=>{
 const pair={logoLightDataUri:'LIGHT_IMAGE',logoDarkDataUri:'DARK_IMAGE',logoDataUri:'LEGACY'};
 assert.equal(darkSurface('#102334'),true);
 assert.equal(darkSurface('#ffffff'),false);
 assert.equal(siteLogoForSurface(pair,'#102334'),'LIGHT_IMAGE');
 assert.equal(siteLogoForSurface(pair,'#ffffff'),'DARK_IMAGE');
 assert.equal(siteLogoForSurface({logoDataUri:'LEGACY'},'#ffffff'),'LEGACY');
});
test('two originals are required during new site creation with immutable signed uploads',()=>{
 const form=read('src/components/site-create-form.tsx');
 const sign=read('src/app/api/site-logos/sign/route.ts');
 const api=read('src/app/api/sites/route.ts');
 const sql=read('supabase/migrations/20261107102000_site_dual_logo_library.sql');
 assert.match(form,/uploadOriginalSiteLogo\(files\.light,companyId,'light'\)/);
 assert.match(form,/uploadOriginalSiteLogo\(files\.dark,companyId,'dark'\)/);
 assert.match(form,/lightLogoPath,darkLogoPath,palette/);
 assert.match(sign,/createSignedUploadUrl\(path,\{upsert:false\}\)/);
 assert.match(sign,/authorizeTenant\(session,companyId,siteId\|\|null\)/);
 assert.match(api,/create_site_with_logo_variants/);
 assert.match(api,/processStoredSiteLogo\(service,lightPath,companyId,permission\.user\.id\)/);
 assert.match(sql,/v_site:=public\.create_site_with_branding/);
 assert.match(sql,/insert into public\.site_brand_assets/);
 assert.match(sql,/alter table public\.site_brand_assets enable row level security/);
 assert.match(sql,/grant execute on function public\.create_site_with_logo_variants/);
});
test('SVG security rejects scripts and remote references while pixels are cropped by alpha',()=>{
 const server=read('src/lib/site-logo-library.ts');
 assert.match(server,/TextDecoder\('utf-8',\{fatal:true\}\)/);
 assert.match(server,/foreignObject/);
 assert.match(server,/javascript:/);
 assert.match(server,/href\|src\|xlink:href/);
 assert.match(server,/limitInputPixels:MAX_DECODE_PIXELS/);
 assert.match(server,/alpha\[y\*width\+x\]/);
 assert.match(server,/if\(a===0\)/);
 assert.match(server,/left-2/);
 assert.match(server,/MAX_DECODE_PIXELS=32_000_000/);
 assert.match(server,/15\*1024\*1024/);
});
test('legacy logos are untouched and new logo manager is tenant-scoped',()=>{
 const manager=read('src/components/site-logo-manager.tsx');
 const route=read('src/app/api/site-logos/route.ts');
 const ticket=read('src/app/api/ticket-templates/route.ts');
 assert.match(manager,/zaray-site-logo-updated/);
 assert.match(route,/authorizeTenant\(session,companyId,siteId\)/);
 assert.match(route,/\.eq\('company_id',companyId\)\.eq\('site_id',siteId\)/);
 assert.match(route,/update_site_logo_variants/);
 assert.match(ticket,/logo_light_data_uri:light,logo_dark_data_uri:dark/);
 assert.match(ticket,/central\?\.light_data_uri/);
});
test('every ticket format reserves a separate logo column without blocking text',()=>{
 const pdf=read('src/lib/ticket-pdf.ts');
 const canvas=read('src/components/voucher-canvas.tsx');
 assert.match(pdf,/function ticketLogo\(design:TicketVisual\)/);
 assert.match(pdf,/logoPaint\(ctx,logo,x\+8,y\+9,63,h-18\)/);
 assert.match(pdf,/if\(logoPaint\(ctx,logo,x\+8,y\+9,63,h-18\)\)left=x\+79/);
 assert.match(pdf,/logoPaint\(ctx,logo,mainX,y\+9,64,h-18\)/);
 assert.match(pdf,/fit\(ctx,ticket\.offer_name,textX,y\+40,textW/);
 assert.match(canvas,/loadVoucherLogo\(ticketLogo\(design\)\)/);
});
