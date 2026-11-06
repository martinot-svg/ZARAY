import {randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createServiceClient} from '@/lib/supabase/service';
import {publicResidentialSite} from '@/lib/residential-site-identity';
import {deviceResident,hashDeviceSecret,RESIDENT_UUID,DEVICE_TOKEN} from '@/lib/residential-alarm-device-access';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});

/** Redeem one high-entropy pairing ticket exactly once. No web session is transferred to Android. */
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null) as {
  siteId?:unknown;pairingCode?:unknown;deviceName?:unknown
 }|null;
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 const pairingCode=typeof body?.pairingCode==='string'?body.pairingCode:'';
 const deviceName=typeof body?.deviceName==='string'
  ?body.deviceName.trim().replace(/[\u0000-\u001F\u007F]/g,'').slice(0,60):'Téléphone Android';
 if(!RESIDENT_UUID.test(siteId)||!DEVICE_TOKEN.test(pairingCode))
  return json({error:'Association invalide ou expirée.'},400);
 try{
  const site=await publicResidentialSite(siteId);
  if(!site)return json({error:'Association invalide ou expirée.'},410);
  const service=createServiceClient();
  if(!service)throw Error('Service indisponible');
  const token=randomBytes(32).toString('base64url');
  const expiresAt=new Date(Date.now()+90*86400000).toISOString();
  // Conditional UPDATE prevents two concurrent claims of the same ticket.
  const {data,error}=await service.from('residential_alarm_devices').update({
   token_hash:hashDeviceSecret(token),token_expires_at:expiresAt,
   paired_at:new Date().toISOString(),device_name:deviceName
  }).eq('site_id',siteId).eq('pairing_hash',hashDeviceSecret(pairingCode))
   .is('paired_at',null).is('token_hash',null).is('revoked_at',null)
   .gt('pairing_expires_at',new Date().toISOString())
   .select('id,company_id,customer_id').maybeSingle();
  if(error)throw Error('Association indisponible');
  if(!data)return json({error:'Association invalide ou déjà utilisée.'},410);
  return json({siteId,siteName:site.brandName,deviceId:data.id,deviceToken:token,expiresAt},201);
 }catch{return json({error:'Association momentanément indisponible.'},503);}
}

/** Revoke the current device from Android while online. Web users can also revoke remotely. */
export async function DELETE(req:NextRequest){
 const siteId=req.nextUrl.searchParams.get('siteId')||'';
 const match=/^Device ([A-Za-z0-9_-]{43})$/.exec(req.headers.get('authorization')||'');
 if(!match||!RESIDENT_UUID.test(siteId))return json({error:'Non autorisé.'},401);
 try{
  const device=await deviceResident(siteId,match[1]);
  if(device.state!=='ok')return json({error:'Non autorisé.'},401);
  const {error}=await device.service.from('residential_alarm_devices')
   .update({revoked_at:new Date().toISOString()})
   .eq('id',device.deviceId).eq('site_id',siteId).is('revoked_at',null);
  if(error)throw Error('Révocation indisponible');
  return json({revoked:true});
 }catch{return json({error:'Révocation indisponible.'},503);}
}
