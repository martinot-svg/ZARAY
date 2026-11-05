import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** General inbox is aggregated only across the owner's/admin's authorized companies. */
async function memberContext(){
 const auth=await createClient();
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user?.email_confirmed_at)return {error:reply({error:'Connexion requise.'},401)};
 const {data:members,error:memberError}=await auth.from('company_members')
   .select('company_id,role').eq('user_id',user.id).eq('status','active').in('role',['owner','admin']);
 if(memberError)return {error:reply({error:'Autorisations indisponibles.'},503)};
 const companies=[...new Set((members||[]).map(m=>m.company_id))];
 const service=createServiceClient();
 if(!service)return {error:reply({error:'Service indisponible.'},503)};
 return {user,companies,service,error:null};
}
export async function GET(request:NextRequest){
 const companyId=request.nextUrl.searchParams.get('companyId')||'';
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 if(companyId&&!uuid.test(companyId)||siteId&&!uuid.test(siteId))return reply({error:'Contexte invalide.'},400);
 const ctx=await memberContext();if(ctx.error)return ctx.error;
 if(companyId&&!ctx.companies!.includes(companyId))return reply({error:'Entreprise inaccessible.'},403);
 const ids=companyId?[companyId]:ctx.companies!;
 if(!ids.length)return reply({notifications:[],unread:0});
 let query=ctx.service!.from('site_notifications')
  .select('id,company_id,site_id,event_type,priority,title,message,created_at')
  .eq('audience','site').in('company_id',ids);
 if(siteId)query=query.eq('site_id',siteId);
 const {data,error}=await query.order('created_at',{ascending:false}).limit(60);
 if(error)return reply({error:'Notifications indisponibles.'},503);
 const notifications=data||[];
 if(!notifications.length)return reply({notifications:[],unread:0});
 const {data:reads,error:readError}=await ctx.service!.from('site_notification_reads')
  .select('notification_id').eq('user_id',ctx.user!.id).in('notification_id',notifications.map(n=>n.id));
 if(readError)return reply({error:'État de lecture indisponible.'},503);
 const seen=new Set((reads||[]).map(r=>r.notification_id));
 const items=notifications.map(n=>({...n,read:seen.has(n.id)}));
 return reply({notifications:items,unread:items.filter(n=>!n.read).length});
}
export async function POST(request:NextRequest){
 const body=await request.json().catch(()=>null) as {notificationId?:unknown}|null;
 const id=typeof body?.notificationId==='string'?body.notificationId:'';
 if(!uuid.test(id))return reply({error:'Notification invalide.'},400);
 const ctx=await memberContext();if(ctx.error)return ctx.error;
 if(!ctx.companies!.length)return reply({error:'Accès interdit.'},403);
 const {data:notification,error}=await ctx.service!.from('site_notifications')
  .select('id,company_id').eq('id',id).eq('audience','site')
  .in('company_id',ctx.companies!).maybeSingle();
 if(error)return reply({error:'Lecture indisponible.'},503);
 if(!notification)return reply({error:'Notification inaccessible.'},404);
 const {error:readError}=await ctx.service!.from('site_notification_reads')
  .upsert({notification_id:id,user_id:ctx.user!.id,read_at:new Date().toISOString()},
   {onConflict:'notification_id,user_id'});
 return readError?reply({error:'Lecture indisponible.'},503):reply({read:true});
}
