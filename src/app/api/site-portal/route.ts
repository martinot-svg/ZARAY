import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
import {DEFAULT_PORTAL_CONFIG,parsePortalConfig,readPortalConfig} from '@/lib/site-portal-config';

export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const originAllowed=(r:NextRequest)=>r.headers.get('origin')===r.nextUrl.origin;

async function context(companyId:string,siteId:string,write:boolean){
 if(!uuid.test(companyId)||!uuid.test(siteId))return {error:json({error:'Entreprise ou site invalide.'},400)};
 const session=await createClient();
 const access=await authorizeTenant(session,companyId,siteId);
 if(!access.ok)return {error:json({error:access.error},access.status)};
 if(write&&!['owner','admin','site_manager'].includes(access.member.role))
  return {error:json({error:'Publication réservée aux responsables autorisés.'},403)};
 const service=createServiceClient();
 if(!service)return {error:json({error:'Service indisponible.'},503)};
 return {service,access,error:null};
}
type Context=Exclude<Awaited<ReturnType<typeof context>>, {error:NextResponse}>;

async function saveDraft(
 service:NonNullable<ReturnType<typeof createServiceClient>>,
 companyId:string,siteId:string,expectedRevision:number,config:unknown
){
 const draft=parsePortalConfig(config);
 if(expectedRevision===-1){
  const result=await service.from('site_portal_configs')
   .insert({company_id:companyId,site_id:siteId,draft,draft_revision:1})
   .select('draft_revision').maybeSingle();
  if(result.error?.code==='23505')return {conflict:true};
  if(result.error||!result.data)throw Error('Enregistrement impossible');
  return {revision:result.data.draft_revision};
 }
 if(expectedRevision<0)return {conflict:true};
 const result=await service.from('site_portal_configs')
  .update({draft,draft_revision:expectedRevision+1,updated_at:new Date().toISOString()})
  .eq('company_id',companyId).eq('site_id',siteId)
  .eq('draft_revision',expectedRevision).select('draft_revision').maybeSingle();
 if(result.error)throw Error('Enregistrement impossible');
 if(!result.data)return {conflict:true};
 return {revision:result.data.draft_revision};
}

export async function GET(request:NextRequest){
 const companyId=request.nextUrl.searchParams.get('companyId')||'';
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 try{
  const ctx=await context(companyId,siteId,false);
  if(ctx.error)return ctx.error;
  if(!ctx.service)return json({error:'Service indisponible.'},503);
  const [{data,error},{data:versions,error:historyError}]=await Promise.all([
   ctx.service.from('site_portal_configs')
    .select('draft,draft_revision,published,published_version,published_at')
    .eq('company_id',companyId).eq('site_id',siteId).maybeSingle(),
   ctx.service.from('site_portal_versions')
    .select('version,published_at').eq('company_id',companyId).eq('site_id',siteId)
    .order('version',{ascending:false}).limit(20)
  ]);
  if(error||historyError)throw Error('Configuration indisponible');
  return json({draft:readPortalConfig(data?.draft)??DEFAULT_PORTAL_CONFIG,
   revision:data?.draft_revision??-1,published:readPortalConfig(data?.published),
   publishedVersion:data?.published_version??0,publishedAt:data?.published_at??null,
   versions:versions??[]});
 }catch{return json({error:'Éditeur temporairement indisponible.'},503);}
}

export async function PUT(request:NextRequest){
 if(!originAllowed(request))return json({error:'Origine non autorisée.'},403);
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof body?.companyId==='string'?body.companyId:'';
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 const revision=body?.expectedRevision;
 if(typeof revision!=='number'||!Number.isSafeInteger(revision)||revision< -1)
  return json({error:'Révision invalide.'},400);
 try{
  const ctx=await context(companyId,siteId,true);
  if(ctx.error)return ctx.error;
  if(!ctx.service)return json({error:'Service indisponible.'},503);
  let result;
  try{result=await saveDraft(ctx.service,companyId,siteId,revision,body?.config);}
  catch(e){if(e instanceof Error&&/invalide|inconnue|autorisé|Texte|texte|Couleur|Couverture|dépasse|Modèle|Alignement|Arrondi|Option|Paramètre/.test(e.message))
    return json({error:e.message},400);
   throw e;
  }
  return 'conflict'in result?json({error:'Ce brouillon a changé. Rechargez avant de réenregistrer.'},409)
   :json({saved:true,revision:result.revision});
 }catch{return json({error:'Enregistrement indisponible.'},503);}
}

export async function POST(request:NextRequest){
 if(!originAllowed(request))return json({error:'Origine non autorisée.'},403);
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof body?.companyId==='string'?body.companyId:'';
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 const revision=body?.expectedRevision;
 if(typeof revision!=='number'||!Number.isSafeInteger(revision)||revision< -1)
  return json({error:'Révision invalide.'},400);
 const action=body?.action;
 if(!['publish','restore','duplicate'].includes(String(action)))
  return json({error:'Action invalide.'},400);
 try{
  const ctx=await context(companyId,siteId,true);
  if(ctx.error)return ctx.error;
  if(!ctx.service||!ctx.access)return json({error:'Service indisponible.'},503);
  if(action==='publish'){
   if(revision<1)return json({error:'Enregistrez votre brouillon avant publication.'},409);
   const {data,error}=await ctx.service.rpc('publish_site_portal',{
    p_company_id:companyId,p_site_id:siteId,
    p_actor_id:ctx.access.user.id,p_expected_revision:revision
   });
   if(error)return json({error:error.message?.includes('draft_conflict')
    ?'Brouillon modifié : rechargez avant publication.':'Publication impossible.'},
    error.code==='40001'?409:503);
   return json({published:true,version:data});
  }
  if(action==='restore'){
   const version=body?.version;
   if(!Number.isSafeInteger(version)||Number(version)<1||revision<0)
    return json({error:'Version de restauration invalide.'},400);
   const {data,error}=await ctx.service.rpc('restore_site_portal_draft',{
    p_company_id:companyId,p_site_id:siteId,p_version:version,
    p_expected_revision:revision
   });
   if(error)return json({error:'Restauration impossible ou brouillon modifié.'},
    error.code==='40001'?409:503);
   return json({restored:true,revision:data});
  }
  if(action==='duplicate'){
   const sourceSiteId=typeof body?.sourceSiteId==='string'?body.sourceSiteId:'';
   if(!uuid.test(sourceSiteId)||sourceSiteId===siteId)
    return json({error:'Site source invalide.'},400);
   const permitted=await context(companyId,sourceSiteId,false);
   if(permitted.error)return permitted.error;
   const {data:source,error:readError}=await ctx.service.from('site_portal_configs')
    .select('published').eq('company_id',companyId).eq('site_id',sourceSiteId).maybeSingle();
   if(readError)throw Error('Source indisponible');
   const config=readPortalConfig(source?.published);
   if(!config)return json({error:'Le site source n’a pas de portail publié.'},409);
   const result=await saveDraft(ctx.service,companyId,siteId,revision,config);
   return 'conflict'in result?json({error:'Le brouillon cible a changé.'},409)
    :json({duplicated:true,revision:result.revision});
  }
  return json({error:'Action invalide.'},400);
 }catch{return json({error:'Opération indisponible.'},503);}
}
