import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(v:unknown,status=200)=>NextResponse.json(v,{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function admin(companyId:string,siteId:string){
 if(!uuid.test(companyId)||!uuid.test(siteId))return {response:json({error:'Site invalide.'},400)};
 const client=await createClient();
 const access=await authorizeTenant(client,companyId,siteId);
 if(!access.ok)return {response:json({error:access.error},access.status)};
 if(!['owner','admin'].includes(access.member.role))
  return {response:json({error:'Seul un administrateur peut attribuer les notifications du site.'},403)};
 const service=createServiceClient();
 if(!service)return {response:json({error:'Service indisponible.'},503)};
 return {service,userId:access.user.id};
}
export async function GET(request:NextRequest){
 const companyId=request.nextUrl.searchParams.get('companyId')||'';
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 try{
  const ctx=await admin(companyId,siteId);
  if(ctx.response)return ctx.response;
  const {data,error}=await ctx.service!.from('site_notification_assignments')
   .select('user_id,assigned_at').eq('company_id',companyId).eq('site_id',siteId);
  if(error)return json({error:'Responsables indisponibles.'},503);
  return json({assignments:data||[]});
 }catch{return json({error:'Responsables indisponibles.'},503);}
}
export async function PUT(request:NextRequest){
 const b=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof b?.companyId==='string'?b.companyId:'';
 const siteId=typeof b?.siteId==='string'?b.siteId:'';
 const userId=typeof b?.userId==='string'?b.userId:'';
 const enabled=b?.enabled;
 if(!uuid.test(userId)||typeof enabled!=='boolean')
  return json({error:'Responsable et action requis.'},400);
 try{
  const ctx=await admin(companyId,siteId);
  if(ctx.response)return ctx.response;
  if(enabled){
   const {data:member,error:memberError}=await ctx.service!.from('company_members')
    .select('user_id,role,status').eq('company_id',companyId)
    .eq('user_id',userId).eq('status','active').eq('role','site_manager').maybeSingle();
   if(memberError||!member)return json({error:'Ce responsable de site n’est pas membre actif de cette entreprise.'},403);
   const {error}=await ctx.service!.from('site_notification_assignments').upsert({
    company_id:companyId,site_id:siteId,user_id:userId,assigned_by:ctx.userId!
   },{onConflict:'company_id,site_id,user_id'});
   if(error)return json({error:'Attribution impossible.'},503);
  }else{
   const {error}=await ctx.service!.from('site_notification_assignments').delete()
    .eq('company_id',companyId).eq('site_id',siteId).eq('user_id',userId);
   if(error)return json({error:'Révocation impossible.'},503);
  }
  const audit=await ctx.service!.from('audit_logs').insert({
   company_id:companyId,actor_user_id:ctx.userId!,
   event:enabled?'notification.site_access_granted':'notification.site_access_revoked',
   metadata:{site_id:siteId,member_user_id:userId}
  });
  if(audit.error)console.error('notification assignment audit unavailable',{code:audit.error.code});
  return json({saved:true,authorized:enabled});
 }catch{return json({error:'Mise à jour impossible.'},503);}
}
