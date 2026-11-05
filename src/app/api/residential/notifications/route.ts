import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {publicResidentialSite} from '@/lib/residential-site-identity';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(v:unknown,status=200)=>NextResponse.json(v,{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorized(siteId:string){
 if(!uuid.test(siteId))return {response:json({error:'Site invalide.'},400)};
 const session=await createClient();
 const {data:{user},error}=await session.auth.getUser();
 if(error||!user?.email||!user.email_confirmed_at)return {response:json({error:'Connexion requise.'},401)};
 const identity=await publicResidentialSite(siteId);
 if(!identity)return {response:json({error:'Site indisponible.'},404)};
 const service=createServiceClient();
 if(!service)return {response:json({error:'Service indisponible.'},503)};
 const {data:site}=await service.from('sites').select('company_id').eq('id',siteId).maybeSingle();
 if(!site)return {response:json({error:'Site indisponible.'},404)};
 const {data:customer,error:customerError}=await service.from('customers').select('id')
  .eq('company_id',site.company_id).eq('site_id',siteId)
  .eq('email',user.email.toLowerCase()).eq('status','active').maybeSingle();
 if(customerError)return {response:json({error:'Notifications indisponibles.'},503)};
 if(!customer)return {response:json({error:'Aucun dossier autorisé sur ce site.'},403)};
 return {service,user,customer,companyId:site.company_id};
}
export async function GET(request:NextRequest){
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 try{
  const context=await authorized(siteId);
  if(context.response)return context.response;
  const {service,user,customer,companyId}=context;
  const {data:items,error}=await service!.from('site_notifications')
   .select('id,kind,customer_title,details,created_at')
   .eq('company_id',companyId!).eq('site_id',siteId)
   .eq('customer_id',customer!.id).order('created_at',{ascending:false}).limit(50);
  if(error)return json({error:'Notifications indisponibles.'},503);
  const ids=(items||[]).map(n=>n.id);
  const {data:read,error:readError}=ids.length?await service!.from('site_notification_reads')
   .select('notification_id').eq('user_id',user!.id).in('notification_id',ids)
    :{data:[],error:null};
  if(readError)return json({error:'État de lecture indisponible.'},503);
  const seen=new Set((read||[]).map(x=>x.notification_id));
  return json({notifications:(items||[]).map(n=>({...n,title:n.customer_title,read:seen.has(n.id)}))});
 }catch{return json({error:'Notifications indisponibles.'},503);}
}
export async function POST(request:NextRequest){
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 const id=typeof body?.notificationId==='string'?body.notificationId:'';
 if(!uuid.test(id))return json({error:'Notification invalide.'},400);
 try{
  const context=await authorized(siteId);
  if(context.response)return context.response;
  const {service,user,customer,companyId}=context;
  const {data:allowed,error}=await service!.from('site_notifications').select('id')
   .eq('id',id).eq('company_id',companyId!).eq('site_id',siteId)
   .eq('customer_id',customer!.id).maybeSingle();
  if(error||!allowed)return json({error:'Notification inaccessible.'},404);
  const {error:writeError}=await service!.from('site_notification_reads')
   .upsert({notification_id:id,user_id:user!.id},{onConflict:'notification_id,user_id'});
  return writeError?json({error:'Lecture non enregistrée.'},503):json({read:true});
 }catch{return json({error:'Lecture non enregistrée.'},503);}
}
