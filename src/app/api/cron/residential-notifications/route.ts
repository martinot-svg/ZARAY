import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {createServiceClient} from '@/lib/supabase/service';
import {publicResidentialSite} from '@/lib/residential-site-identity';
import {customerEmailDeliveryReady,sendResidentEmail} from '@/lib/customer-notification-email';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const permitted=(request:NextRequest)=>{
 const secret=process.env.CRON_SECRET||'';
 const provided=request.headers.get('authorization')||'';
 if(secret.length<24)return false;
 const a=Buffer.from(provided),b=Buffer.from('Bearer '+secret);
 return a.length===b.length&&timingSafeEqual(a,b);
};
type MailJob={
 notification_id:string;company_id:string;site_id:string;customer_id:string;
 kind:string;title:string;details:string;
};
export async function GET(request:NextRequest){
 if(!permitted(request))return json({error:'Non autorisé.'},401);
 const service=createServiceClient();
 if(!service)return json({error:'Service indisponible.'},503);
 const {data:created,error:reminderError}=await service.rpc('create_residential_expiry_reminders');
 if(reminderError){
  console.error('notification reminder job failed',{code:reminderError.code});
  return json({error:'Rappels indisponibles.'},503);
 }
 if(!customerEmailDeliveryReady())
  return json({reminders:created??0,mailConfigured:false,sent:0,
   note:'Aucun e-mail envoyé sans expéditeur et fournisseur vérifiés.'});
 const {data:jobs,error:queueError}=await service.rpc('claim_residential_email_jobs',{p_limit:15});
 if(queueError){
  console.error('notification queue claim failed',{code:queueError.code});
  return json({error:'Distribution indisponible.'},503);
 }
 let sent=0,cancelled=0,failed=0;
 for(const job of (jobs||[]) as MailJob[]){
  const filter=(table:string)=>service.from(table).select('*')
   .eq('company_id',job.company_id).eq('site_id',job.site_id);
  try{
   const [{data:customer,error:customerError},{data:pref,error:prefError},
          {data:domain,error:domainError}]=await Promise.all([
    filter('customers').eq('id',job.customer_id).eq('status','active').maybeSingle(),
    filter('residential_notification_preferences').eq('customer_id',job.customer_id).maybeSingle(),
    filter('site_custom_domains').eq('status','active').not('verified_at','is',null).maybeSingle()
   ]);
   if(customerError||prefError||domainError)throw Error('Tenant lookup unavailable');
   if(!customer||pref?.email_enabled!==true||!domain){
    const {error}=await service.from('residential_notification_email_jobs').update({
     status:'cancelled',lease_until:null,last_error:'Delivery consent or active domain unavailable'
    }).eq('notification_id',job.notification_id).eq('status','sending');
    if(error)throw Error('Cannot cancel delivery');
    cancelled++;continue;
   }
   const identity=await publicResidentialSite(job.site_id);
   if(!identity)throw Error('Site identity unavailable');
   const providerId=await sendResidentEmail({
    notificationId:job.notification_id,to:customer.email,siteName:identity.brandName,
    title:job.title,details:job.details,hostname:domain.hostname
   });
   const {error}=await service.from('residential_notification_email_jobs').update({
    status:'sent',provider_id:providerId,sent_at:new Date().toISOString(),
    lease_until:null,last_error:null
   }).eq('notification_id',job.notification_id).eq('status','sending');
   if(error)throw Error('Cannot record email delivery');
   sent++;
  }catch{
   const {data:row}=await service.from('residential_notification_email_jobs')
    .select('attempts').eq('notification_id',job.notification_id).maybeSingle();
   const attempts=Number(row?.attempts||1);
   const {error}=await service.from('residential_notification_email_jobs').update({
    status:attempts>=3?'failed':'pending',
    next_attempt_at:new Date(Date.now()+86400000).toISOString(),
    lease_until:null,last_error:'Delivery attempt failed'
   }).eq('notification_id',job.notification_id).eq('status','sending');
   if(error)console.error('notification mail attempt could not be recorded',{code:error.code});
   failed++;
  }
 }
 return json({reminders:created??0,mailConfigured:true,attempted:(jobs||[]).length,
  sent,cancelled,failed});
}
