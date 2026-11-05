import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalizeAlias=(raw:string)=>{
 const alias=raw.trim().toLowerCase();
 return alias.length>=3&&alias.length<=100&&/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(alias)?alias:'';
};
async function access(companyId:string,siteId:string){
 if(!uuid.test(companyId)||!uuid.test(siteId))return {error:json({error:'Site ou entreprise invalide.'},400)};
 const client=await createClient();
 const tenant=await authorizeTenant(client,companyId,siteId);
 if(!tenant.ok)return {error:json({error:tenant.error},tenant.status)};
 if(!['owner','admin'].includes(tenant.member.role))return {error:json({error:'Accès réservé à un administrateur du site.'},403)};
 const service=createServiceClient();
 if(!service)return {error:json({error:'Service indisponible.'},503)};
 return {service,userId:tenant.user.id};
}
const link=(alias:string)=>'/l/'+encodeURIComponent(alias);
export async function GET(request:NextRequest){
 const companyId=request.nextUrl.searchParams.get('companyId')||'';
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 try{
  const permission=await access(companyId,siteId);
  if(permission.error)return permission.error;
  const {data,error}=await permission.service!.from('site_public_links')
   .select('alias').eq('company_id',companyId).eq('site_id',siteId).maybeSingle();
  if(error)return json({error:'Impossible de charger le lien public.'},503);
  return json({link:data?{alias:data.alias,path:link(data.alias)}:null});
 }catch{return json({error:'Lien public indisponible.'},503);}
}
export async function PUT(request:NextRequest){
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof body?.companyId==='string'?body.companyId:'';
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 const alias=normalizeAlias(typeof body?.alias==='string'?body.alias:'');
 if(!alias)return json({error:'Choisissez un nom composé de lettres, chiffres, points ou tirets (3 à 100 caractères).'},400);
 try{
  const permission=await access(companyId,siteId);
  if(permission.error)return permission.error;
  const {data,error}=await permission.service!.from('site_public_links').upsert({
   site_id:siteId,company_id:companyId,alias,created_by:permission.userId,
   updated_at:new Date().toISOString()
  },{onConflict:'site_id'}).select('alias').single();
  if(error)return json({error:error.code==='23505'
   ?'Ce nom est déjà utilisé par un autre site. Choisissez-en un autre.'
   :'Enregistrement du lien impossible.'},error.code==='23505'?409:503);
  return json({link:{alias:data.alias,path:link(data.alias)},saved:true});
 }catch{return json({error:'Enregistrement indisponible.'},503);}
}
