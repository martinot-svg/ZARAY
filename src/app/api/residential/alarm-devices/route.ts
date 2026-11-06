import {randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {webResident,hashDeviceSecret,RESIDENT_UUID} from '@/lib/residential-alarm-device-access';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const sameOrigin=(req:NextRequest)=>req.headers.get('origin')===req.nextUrl.origin;

/** List only the authenticated subscriber's own associated phones. */
export async function GET(req:NextRequest){
 const siteId=req.nextUrl.searchParams.get('siteId')||'';
 if(!RESIDENT_UUID.test(siteId))return json({error:'Site invalide.'},400);
 try{
  const ctx=await webResident(siteId);
  if(!ctx)return json({error:'Compte abonné non autorisé.'},401);
  const {data,error}=await ctx.service.from('residential_alarm_devices')
   .select('id,device_name,paired_at,last_sync_at,token_expires_at')
   .eq('company_id',ctx.companyId).eq('site_id',siteId).eq('customer_id',ctx.customerId)
   .not('paired_at','is',null).is('revoked_at',null)
   .order('paired_at',{ascending:false}).limit(10);
  if(error)throw Error('Appareils indisponibles');
  return json({devices:data||[]});
 }catch{return json({error:'Appareils indisponibles.'},503);}
}

/** Only web OTP-authenticated residents can mint a single-use, ten-minute pairing ticket. */
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return json({error:'Origine non autorisée.'},403);
 const body=await req.json().catch(()=>null) as {siteId?:unknown}|null;
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 if(!RESIDENT_UUID.test(siteId))return json({error:'Site invalide.'},400);
 try{
  const ctx=await webResident(siteId);
  if(!ctx)return json({error:'Compte abonné non autorisé.'},401);
  const {data:pref,error:prefError}=await ctx.service.from('residential_notification_preferences')
   .select('alarm_enabled').eq('company_id',ctx.companyId)
   .eq('site_id',siteId).eq('customer_id',ctx.customerId).maybeSingle();
  if(prefError)throw Error('Consentement indisponible');
  if(!pref?.alarm_enabled)return json({error:'Activez et enregistrez les rappels avant d’associer un téléphone.'},409);
  const now=new Date().toISOString();
  const {count:active,error:activeError}=await ctx.service.from('residential_alarm_devices')
   .select('id',{count:'exact',head:true}).eq('company_id',ctx.companyId)
   .eq('site_id',siteId).eq('customer_id',ctx.customerId)
   .is('revoked_at',null).not('paired_at','is',null);
  const {count:pending,error:pendingError}=await ctx.service.from('residential_alarm_devices')
   .select('id',{count:'exact',head:true}).eq('company_id',ctx.companyId)
   .eq('site_id',siteId).eq('customer_id',ctx.customerId)
   .is('revoked_at',null).is('paired_at',null).gt('pairing_expires_at',now);
  if(activeError||pendingError)throw Error('Quota indisponible');
  if((active||0)>=5)return json({error:'Cinq téléphones sont déjà associés. Dissociez-en un avant de continuer.'},409);
  if((pending||0)>=3)return json({error:'Trop de demandes récentes. Réessayez après leur expiration.'},429);
  const pairingCode=randomBytes(32).toString('base64url');
  const expiresAt=new Date(Date.now()+10*60000).toISOString();
  const {error}=await ctx.service.from('residential_alarm_devices').insert({
   company_id:ctx.companyId,site_id:siteId,customer_id:ctx.customerId,
   pairing_hash:hashDeviceSecret(pairingCode),pairing_expires_at:expiresAt
  });
  if(error)throw Error('Enregistrement indisponible');
  return json({siteId,siteName:ctx.site.brandName,pairingCode,expiresAt,
   deepLink:'compteinternet-alarmes://pair/'+siteId+'/'+pairingCode},201);
 }catch{return json({error:'Association momentanément indisponible.'},503);}
}

/** User can revoke any of their devices; the next online sync clears its local reminders. */
export async function DELETE(req:NextRequest){
 if(!sameOrigin(req))return json({error:'Origine non autorisée.'},403);
 const body=await req.json().catch(()=>null) as {siteId?:unknown,deviceId?:unknown}|null;
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 const deviceId=typeof body?.deviceId==='string'?body.deviceId:'';
 if(!RESIDENT_UUID.test(siteId)||!RESIDENT_UUID.test(deviceId))
  return json({error:'Demande invalide.'},400);
 try{
  const ctx=await webResident(siteId);
  if(!ctx)return json({error:'Compte abonné non autorisé.'},401);
  const {data,error}=await ctx.service.from('residential_alarm_devices')
   .update({revoked_at:new Date().toISOString()})
   .eq('id',deviceId).eq('company_id',ctx.companyId)
   .eq('site_id',siteId).eq('customer_id',ctx.customerId)
   .is('revoked_at',null).select('id').maybeSingle();
  if(error)throw Error('Révocation indisponible');
  return data?json({revoked:true}):json({error:'Appareil introuvable.'},404);
 }catch{return json({error:'Révocation momentanément indisponible.'},503);}
}
