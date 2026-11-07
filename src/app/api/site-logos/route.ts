import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
import {processStoredSiteLogo} from '@/lib/site-logo-library';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});

export async function GET(request:NextRequest){
 const companyId=request.nextUrl.searchParams.get('companyId')||'';
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 const session=await createClient();
 const access=await authorizeTenant(session,companyId,siteId);
 if(!access.ok)return respond({error:access.error},access.status);
 const service=createServiceClient();
 if(!service)return respond({error:'Identité du site indisponible.'},503);
 const [{data:assets,error},{data:template,error:legacyError}]=await Promise.all([
  service.from('site_brand_assets')
   .select('light_data_uri,dark_data_uri,updated_at')
   .eq('site_id',siteId).eq('company_id',companyId).maybeSingle(),
  service.from('ticket_templates').select('logo_data_uri')
   .eq('site_id',siteId).eq('company_id',companyId).is('offer_id',null).maybeSingle()
 ]);
 if(error||legacyError)return respond({error:'Impossible de lire les logos du site.'},503);
 const legacy=typeof template?.logo_data_uri==='string'?template.logo_data_uri:null;
 return respond({
  configured:!!assets,
  lightDataUri:assets?.light_data_uri??legacy,
  darkDataUri:assets?.dark_data_uri??legacy,
  updatedAt:assets?.updated_at??null
 });
}
export async function PATCH(request:NextRequest){
 if(request.headers.get('origin')!==request.nextUrl.origin)
  return respond({error:'Origine non autorisée.'},403);
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof body?.companyId==='string'?body.companyId:'';
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 const lightPath=typeof body?.lightPath==='string'?body.lightPath:'';
 const darkPath=typeof body?.darkPath==='string'?body.darkPath:'';
 if(!lightPath&&!darkPath)return respond({error:'Sélectionnez une version à remplacer.'},400);
 const session=await createClient();
 const access=await authorizeTenant(session,companyId,siteId);
 if(!access.ok)return respond({error:access.error},access.status);
 if(!['owner','admin'].includes(access.member.role))
  return respond({error:'Réservé aux administrateurs de l’entreprise.'},403);
 const service=createServiceClient();
 if(!service)return respond({error:'Service indisponible.'},503);
 const {data:stored,error:readError}=await service.from('site_brand_assets')
  .select('light_original_path,dark_original_path,light_data_uri,dark_data_uri')
  .eq('company_id',companyId).eq('site_id',siteId).maybeSingle();
 if(readError)return respond({error:'Identité du site indisponible.'},503);
 if(!stored&&(!lightPath||!darkPath))
  return respond({error:'Importez les deux versions du logo pour initialiser ce site.'},400);
 try{
  const [light,dark]=await Promise.all([
   lightPath?processStoredSiteLogo(service,lightPath,companyId,access.user.id):Promise.resolve(null),
   darkPath?processStoredSiteLogo(service,darkPath,companyId,access.user.id):Promise.resolve(null)
  ]);
  const finalLightPath=light?.path??stored?.light_original_path??'';
  const finalDarkPath=dark?.path??stored?.dark_original_path??'';
  const finalLight=light?.preview??stored?.light_data_uri??'';
  const finalDark=dark?.preview??stored?.dark_data_uri??'';
  if(finalLightPath===finalDarkPath)return respond({error:'Les deux versions doivent être distinctes.'},400);
  const {error}=await service.rpc('update_site_logo_variants',{
   p_company_id:companyId,p_site_id:siteId,p_actor_user_id:access.user.id,
   p_light_path:finalLightPath,p_dark_path:finalDarkPath,
   p_light_data_uri:finalLight,p_dark_data_uri:finalDark
  });
  if(error){
   console.error('site logo update',{code:error.code});
   return respond({error:error.code==='42501'?'Modification non autorisée.':'Impossible de synchroniser les logos du site.'},error.code==='42501'?403:503);
  }
  return respond({saved:true,lightDataUri:finalLight,darkDataUri:finalDark,
   optimized:[...(light?.cropped?['light']:[]),...(dark?.cropped?['dark']:[])]});
 }catch(e){return respond({error:e instanceof Error?e.message:'Fichier du logo invalide.'},400);}
}
