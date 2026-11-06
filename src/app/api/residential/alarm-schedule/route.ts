import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {publicResidentialSite} from '@/lib/residential-site-identity';
import {deviceResident,touchDevice} from '@/lib/residential-alarm-device-access';
import {
 buildResidentAlarms,buildAlarmCalendar,validateAlarmDays,DEFAULT_ALARM_DAYS,
 RESIDENT_ALARM_TIME_ZONE
} from '@/lib/residential-alarm-schedule';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Resident=NonNullable<Awaited<ReturnType<typeof resolveResident>>>;

async function resolveResident(request:NextRequest,siteId:string){
 if(!uuid.test(siteId))return null;
 const service=createServiceClient();
 if(!service)throw new Error('Backend indisponible');
 // A native companion may use a verified Supabase access token. Browser sessions use cookies.
 const authHeader=request.headers.get('authorization')||'';
 const bearer=/^Bearer ([A-Za-z0-9._-]+)$/.exec(authHeader);
 let user;
 if(bearer){
  const result=await service.auth.getUser(bearer[1]);
  if(result.error)return null;
  user=result.data.user;
 }else{
  const browser=await createClient();
  const result=await browser.auth.getUser();
  if(result.error)return null;
  user=result.data.user;
 }
 if(!user?.email||!user.email_confirmed_at)return null;
 const site=await publicResidentialSite(siteId);
 if(!site)return null;
 const {data:siteRow,error:siteError}=await service.from('sites')
  .select('company_id').eq('id',siteId).maybeSingle();
 if(siteError||!siteRow)return null;
 const {data:customer,error:customerError}=await service.from('customers')
  .select('id').eq('company_id',siteRow.company_id).eq('site_id',siteId)
  .eq('email',user.email.toLowerCase().trim()).eq('status','active').maybeSingle();
 if(customerError||!customer)return null;
 return {service,site,siteId,companyId:siteRow.company_id,customerId:customer.id};
}
async function schedule(ctx:Resident){
 const [{data:preferences,error:prefError},{data:subscriptions,error:subError}]=await Promise.all([
  ctx.service.from('residential_notification_preferences')
   .select('alarm_enabled,alarm_days,alarm_hour')
   .eq('company_id',ctx.companyId).eq('site_id',ctx.siteId)
   .eq('customer_id',ctx.customerId).maybeSingle(),
  ctx.service.from('residential_subscriptions')
   .select('id,offer_name,expires_at,paid_cycles,activated_cycles')
   .eq('company_id',ctx.companyId).eq('site_id',ctx.siteId)
   .eq('customer_id',ctx.customerId)
   .gt('paid_cycles',0).gt('activated_cycles',0)
   .not('expires_at','is',null).order('expires_at',{ascending:false}).limit(1)
 ]);
 if(prefError||subError)throw Error('Préférences ou abonnement indisponibles');
 const days=validateAlarmDays(preferences?.alarm_days)||[...DEFAULT_ALARM_DAYS];
 const hour=typeof preferences?.alarm_hour==='number'?preferences.alarm_hour:8;
 const subscription=subscriptions?.[0]||null;
 const items=buildResidentAlarms(ctx.site,subscription,days,hour);
 return {enabled:preferences?.alarm_enabled===true,days,hour,
  timeZone:RESIDENT_ALARM_TIME_ZONE,
  site:{id:ctx.siteId,name:ctx.site.siteName,brandName:ctx.site.brandName},
  subscription:subscription?{id:subscription.id,expiresAt:subscription.expires_at,
   offerName:subscription.offer_name}:null,
  reminders:items};
}

export async function GET(request:NextRequest){
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 if(!uuid.test(siteId))return json({error:'Site invalide.'},400);
 try{
  // Background WorkManager uses a revocable site-scoped device credential.
  // OTP/browser access remains unchanged for existing residential customers.
  const authorization=request.headers.get('authorization')||'';
  let ctx:Resident|null=null;
  let deviceId:string|null=null;
  if(authorization.startsWith('Device ')){
   const device=await deviceResident(siteId,authorization.slice(7));
   if(device.state==='gone')return json({error:'Appareil dissocié ou accès expiré.'},410);
   if(device.state!=='ok')return json({error:'Appareil non autorisé.'},401);
   ctx={service:device.service,site:device.site,siteId:device.siteId,
    companyId:device.companyId,customerId:device.customerId};
   deviceId=device.deviceId;
  }else{
   ctx=await resolveResident(request,siteId);
  }
  if(!ctx)return json({error:'Compte abonné non autorisé pour ce site.'},401);
  const result=await schedule(ctx);
  if(deviceId)await touchDevice(ctx.service,deviceId);
  if(request.nextUrl.searchParams.get('format')==='ics'){
   if(!result.subscription||!result.reminders.length)
    return json({error:'Aucune échéance future confirmée pour ce site.'},409);
   return new NextResponse(buildAlarmCalendar(result.reminders,siteId),{
    headers:{...headers,'Content-Type':'text/calendar; charset=utf-8',
     'Content-Disposition':'attachment; filename="rappels-abonnement.ics"'}
   });
  }
  return json({...result, nativeAlarmInstalled:false,
   note:'Les alarmes natives nécessitent une application compagnon installée et la permission du téléphone. L’export calendrier demande une importation manuelle.'});
 }catch{return json({error:'Plan de rappels momentanément indisponible.'},503);}
}

export async function PUT(request:NextRequest){
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 if(!uuid.test(siteId))return json({error:'Site invalide.'},400);
 const origin=request.headers.get('origin');
 const isBearer=/^Bearer [A-Za-z0-9._-]+$/.test(request.headers.get('authorization')||'');
 if(!isBearer&&origin!==request.nextUrl.origin)
  return json({error:'Origine non autorisée.'},403);
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const enabled=body?.enabled,days=validateAlarmDays(body?.days),hour=body?.hour;
 if(typeof enabled!=='boolean'||!days||typeof hour!=='number'
  ||!Number.isInteger(hour)||hour<0||hour>23)
  return json({error:'Préférences de rappels invalides.'},400);
 try{
  const ctx=await resolveResident(request,siteId);
  if(!ctx)return json({error:'Compte abonné non autorisé pour ce site.'},401);
  const {error}=await ctx.service.from('residential_notification_preferences')
   .upsert({company_id:ctx.companyId,site_id:siteId,customer_id:ctx.customerId,
    alarm_enabled:enabled,alarm_days:days,alarm_hour:hour},
    {onConflict:'company_id,site_id,customer_id'});
  if(error)return json({error:'Enregistrement des rappels impossible.'},503);
  return json(await schedule(ctx));
 }catch{return json({error:'Mise à jour des rappels indisponible.'},503);}
}
