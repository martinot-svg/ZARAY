import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(v:unknown,status=200)=>NextResponse.json(v,{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function permission(companyId:string,siteId:string|null){
 const session=await createClient();
 if(companyId==='all'){
  if(siteId)return {response:json({error:'Choisissez une entreprise avant un site.'},400)};
  const {data:{user},error}=await session.auth.getUser();
  if(error||!user?.email_confirmed_at)return {response:json({error:'Connexion vérifiée requise.'},401)};
  const {data:memberships,error:membershipError}=await session.from('company_members')
   .select('company_id,role').eq('user_id',user.id).eq('status','active');
  if(membershipError)return {response:json({error:'Autorisations indisponibles.'},503)};
  const companyIds=(memberships||[]).filter(x=>['owner','admin'].includes(x.role)).map(x=>x.company_id);
  if(!companyIds.length)return {response:json({error:'Aucune entreprise administrée.'},403)};
  const service=createServiceClient();
  if(!service)return {response:json({error:'Service indisponible.'},503)};
  return {service,userId:user.id,companyIds};
 }
 const access=await authorizeTenant(session,companyId,siteId);
 if(!access.ok)return {response:json({error:access.error},access.status)};
 const service=createServiceClient();
 if(!service)return {response:json({error:'Service indisponible.'},503)};
 if(['owner','admin'].includes(access.member.role))
  return {service,userId:access.user.id,companyIds:[companyId]};
 // A site_manager can view only a site explicitly assigned by an administrator.
 // Company membership alone, and an arbitrary siteId, never authorize access.
 if(access.member.role!=='site_manager'||!siteId)
  return {response:json({error:'Notifications réservées aux responsables autorisés.'},403)};
 const {data:assignment,error:assignmentError}=await service.from('site_notification_assignments')
  .select('site_id').eq('company_id',companyId).eq('site_id',siteId)
  .eq('user_id',access.user.id).maybeSingle();
 if(assignmentError)return {response:json({error:'Autorisations indisponibles.'},503)};
 if(!assignment)return {response:json({error:'Ce site ne vous a pas été attribué.'},403)};
 return {service,userId:access.user.id,companyIds:[companyId]};
}

export async function GET(request:NextRequest){
 const companyId=request.nextUrl.searchParams.get('companyId')||'';
 const siteId=request.nextUrl.searchParams.get('siteId')||null;
 try{
  const context=await permission(companyId,siteId);
  if(context.response)return context.response;
  let query=context.service!.from('site_notifications')
   .select('id,site_id,kind,site_title,details,created_at')
   .in('company_id',context.companyIds!).order('created_at',{ascending:false}).limit(80);
  if(siteId)query=query.eq('site_id',siteId);
  const {data:items,error}=await query;
  if(error)return json({error:'Notifications indisponibles.'},503);
  const ids=(items||[]).map(x=>x.id);
  const {data:reads,error:readError}=ids.length?await context.service!.from('site_notification_reads')
   .select('notification_id').eq('user_id',context.userId!).in('notification_id',ids)
   :{data:[],error:null};
  if(readError)return json({error:'État de lecture indisponible.'},503);
  const seen=new Set((reads||[]).map(x=>x.notification_id));
  return json({notifications:(items||[]).map(x=>({...x,title:x.site_title,read:seen.has(x.id)}))});
 }catch{return json({error:'Notifications indisponibles.'},503);}
}

export async function POST(request:NextRequest){
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof body?.companyId==='string'?body.companyId:'';
 const siteId=typeof body?.siteId==='string'&&body.siteId?body.siteId:null;
 const id=typeof body?.notificationId==='string'?body.notificationId:'';
 if(!uuid.test(id))return json({error:'Notification invalide.'},400);
 try{
  const context=await permission(companyId,siteId);
  if(context.response)return context.response;
  let query=context.service!.from('site_notifications').select('id').eq('id',id).in('company_id',context.companyIds!);
  if(siteId)query=query.eq('site_id',siteId);
  const {data:found,error}=await query.maybeSingle();
  if(error||!found)return json({error:'Notification inaccessible.'},404);
  const {error:writeError}=await context.service!.from('site_notification_reads')
   .upsert({notification_id:id,user_id:context.userId!},{onConflict:'notification_id,user_id'});
  return writeError?json({error:'Lecture non enregistrée.'},503):json({read:true});
 }catch{return json({error:'Lecture non enregistrée.'},503);}
}
