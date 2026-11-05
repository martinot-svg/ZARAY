import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {publicResidentialSite} from '@/lib/residential-site-identity';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function clientContext(siteId:string){
 if(!uuid.test(siteId))return {error:reply({error:'Site invalide.'},400)};
 const auth=await createClient();
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user?.email||!user.email_confirmed_at)return {error:reply({error:'Connexion requise.'},401)};
 const site=await publicResidentialSite(siteId);
 if(!site)return {error:reply({error:'Site inaccessible.'},404)};
 const service=createServiceClient();
 if(!service)return {error:reply({error:'Service indisponible.'},503)};
 const {data:row,error:siteError}=await service.from('sites').select('company_id').eq('id',siteId).maybeSingle();
 if(siteError||!row)return {error:reply({error:'Site inaccessible.'},404)};
 const {data:customer,error:customerError}=await service.from('customers').select('id')
  .eq('company_id',row.company_id).eq('site_id',siteId)
  .eq('email',user.email.toLowerCase()).eq('status','active').maybeSingle();
 if(customerError)return {error:reply({error:'Dossier indisponible.'},503)};
 if(!customer)return {error:reply({error:'Aucun abonnement autorisé sur ce site.'},403)};
 return {user,service,companyId:row.company_id,customerId:customer.id,error:null};
}
export async function GET(request:NextRequest){
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 try{
  const ctx=await clientContext(siteId);if(ctx.error)return ctx.error;
  const {data,error}=await ctx.service!.from('site_notifications')
   .select('id,event_type,priority,title,message,created_at')
   .eq('company_id',ctx.companyId!).eq('site_id',siteId)
   .eq('customer_id',ctx.customerId!).eq('audience','client')
   .order('created_at',{ascending:false}).limit(30);
  if(error)return reply({error:'Notifications indisponibles.'},503);
  const notifications=data||[];
  if(!notifications.length)return reply({notifications:[],unread:0});
  const {data:reads,error:readError}=await ctx.service!.from('site_notification_reads')
   .select('notification_id').eq('user_id',ctx.user!.id).in('notification_id',notifications.map(n=>n.id));
  if(readError)return reply({error:'Notifications indisponibles.'},503);
  const seen=new Set((reads||[]).map(x=>x.notification_id));
  const items=notifications.map(n=>({...n,read:seen.has(n.id)}));
  return reply({notifications:items,unread:items.filter(n=>!n.read).length});
 }catch{return reply({error:'Notifications indisponibles.'},503);}
}
export async function POST(request:NextRequest){
 const body=await request.json().catch(()=>null) as {siteId?:unknown,notificationId?:unknown}|null;
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 const id=typeof body?.notificationId==='string'?body.notificationId:'';
 if(!uuid.test(siteId)||!uuid.test(id))return reply({error:'Notification invalide.'},400);
 try{
  const ctx=await clientContext(siteId);if(ctx.error)return ctx.error;
  const {data:notification,error}=await ctx.service!.from('site_notifications')
   .select('id').eq('id',id).eq('company_id',ctx.companyId!).eq('site_id',siteId)
   .eq('customer_id',ctx.customerId!).eq('audience','client').maybeSingle();
  if(error)return reply({error:'Lecture indisponible.'},503);
  if(!notification)return reply({error:'Notification inaccessible.'},404);
  const {error:readError}=await ctx.service!.from('site_notification_reads')
   .upsert({notification_id:id,user_id:ctx.user!.id,read_at:new Date().toISOString()},
    {onConflict:'notification_id,user_id'});
  return readError?reply({error:'Lecture indisponible.'},503):reply({read:true});
 }catch{return reply({error:'Lecture indisponible.'},503);}
}
