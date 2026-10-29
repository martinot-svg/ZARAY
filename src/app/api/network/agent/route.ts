import {createHash,randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createServiceClient} from '@/lib/supabase/service';
import {deriveVoucherPassword} from '@/lib/network-voucher-secret';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const kinds=['hotspot','pppoe','dhcp','wifi','neighbor','radius'];
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const clean=(s:unknown,max=128)=>typeof s==='string'?s.trim().slice(0,max):'';
export async function POST(request:NextRequest){
 const auth=request.headers.get('authorization')||'';
 const token=/^Bearer ([0-9a-f]{64})$/i.exec(auth)?.[1]||'';
 const b=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const routerId=clean(b?.routerId,36),action=b?.action;
 if(!token||!uuid.test(routerId)||!['claim','sync','poll','result'].includes(String(action)))return json({error:'Requête non autorisée.'},401);
 const service=createServiceClient();
 if(!service)return json({error:'Service indisponible.'},503);
 if(action==='claim'){
  const nextSecret=randomBytes(32).toString('hex');
  const {data,error}=await service.from('network_connector_credentials')
   .update({secret_hash:digest(nextSecret),pairing_hash:null,pairing_expires_at:null,paired_at:new Date().toISOString(),revoked_at:null})
   .eq('router_id',routerId).eq('pairing_hash',digest(token)).is('secret_hash',null)
   .gt('pairing_expires_at',new Date().toISOString()).select('router_id').maybeSingle();
  if(error||!data)return json({error:'Code expiré ou déjà utilisé.'},403);
  return json({connectorSecret:nextSecret,routerId,warning:'Conserver cette clé uniquement sur le connecteur local.'});
 }
 const {data:credential,error:credentialError}=await service.from('network_connector_credentials')
  .select('router_id,revoked_at').eq('router_id',routerId).eq('secret_hash',digest(token)).is('revoked_at',null).maybeSingle();
 if(credentialError||!credential)return json({error:'Connecteur révoqué ou non associé.'},403);
 const {data:router,error:routerError}=await service.from('network_routers')
  .select('id,company_id,site_id,control_enabled').eq('id',routerId).maybeSingle();
 if(routerError||!router)return json({error:'Routeur introuvable.'},404);
 if(action==='sync'){
  if(!Array.isArray(b?.observations)||b!.observations.length>500||!Array.isArray(b?.kinds))return json({error:'Inventaire invalide.'},400);
  const completed=[...new Set((b!.kinds as unknown[]).filter(x=>typeof x==='string'&&kinds.includes(x)))];
  if(!completed.length)return json({error:'Aucune source de découverte valide.'},400);
  const now=new Date().toISOString();
  const observations=b!.observations.map(v=>{
   if(!v||typeof v!=='object')return null;
   const o=v as Record<string,unknown>, kind=clean(o.kind,32),key=clean(o.key,255);
   if(!completed.includes(kind)||!key)return null;
   const ip=clean(o.ip,48), mac=clean(o.mac,32);
   return {company_id:router.company_id,router_id:routerId,observed_kind:kind,identity_key:key,
    client_label:clean(o.label,160)||null,ip_address:/^[0-9a-fA-F:.]+$/.test(ip)?ip:null,
    mac_address:/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)?mac:null,
    active:o.active===true,observed_at:now};
  }).filter((v):v is NonNullable<typeof v>=>v!==null);
  if(observations.length!==b!.observations.length)return json({error:'Observations invalides.'},400);
  if(observations.length){
   const {error}=await service.from('network_observations').upsert(observations,{onConflict:'router_id,observed_kind,identity_key'});
   if(error)return json({error:'Impossible de synchroniser les appareils.'},503);
  }
  for(const kind of completed){
   const {error}=await service.from('network_observations').update({active:false}).eq('router_id',routerId).eq('observed_kind',kind).lt('observed_at',now);
   if(error)return json({error:'Inventaire partiellement mis à jour.'},503);
  }
  // A first authenticated Hotspot session activates the voucher's usage window.
  const connectedNames=new Set(observations.filter(o=>o.observed_kind==='hotspot'&&o.active&&o.client_label).map(o=>o.client_label));
  if(completed.includes('hotspot')&&connectedNames.size){
   const {data:links}=await service.from('wifi_voucher_network')
     .select('voucher_id').eq('router_id',routerId).eq('network_state','provisioned');
   if(links?.length){
    const {data:vouchers}=await service.from('wifi_vouchers')
      .select('id,username,validity_days,status').in('id',links.map(l=>l.voucher_id)).eq('status','paid');
    for(const voucher of vouchers??[]){
     if(!connectedNames.has(voucher.username))continue;
     await service.from('wifi_vouchers').update({status:'active',activated_at:now,expires_at:null})
       .eq('id',voucher.id).eq('status','paid');
    }
   }
  }

  if(b?.voucherUsage!==undefined){
   if(!Array.isArray(b.voucherUsage)||b.voucherUsage.length>500)return json({error:'Compteurs Wi-Fi invalides.'},400);
   const readings=b.voucherUsage.map(item=>{
    if(!item||typeof item!=='object')return null;
    const entry=item as Record<string,unknown>;
    const voucherId=clean(entry.voucherId,36),username=clean(entry.username,128);
    const uptimeSeconds=entry.uptimeSeconds;
    if(!uuid.test(voucherId)||!username||typeof uptimeSeconds!=='number'||
       !Number.isSafeInteger(uptimeSeconds)||uptimeSeconds<0||uptimeSeconds>315360000)return null;
    return {voucherId,username,uptimeSeconds};
   });
   if(readings.some(item=>item===null))return json({error:'Compteurs Wi-Fi invalides.'},400);
   const {error:usageError}=await service.rpc('record_wifi_voucher_usage',{
    p_router_id:routerId,p_readings:readings
   });
   if(usageError)return json({error:'Impossible de synchroniser le temps cumulé des tickets.'},503);
  }
  const model=clean(b?.model,120),version=clean(b?.version,120);
  const {error}=await service.from('network_routers').update({status:'online',last_seen_at:now,model:model||null,routeros_version:version||null}).eq('id',routerId);
  if(error)return json({error:'État du routeur indisponible.'},503);
  return json({synced:observations.length,kinds:completed});
 }
 await service.from('network_connector_credentials').update({last_poll_at:new Date().toISOString()}).eq('router_id',routerId);
 if(action==='poll'){
  if(!router.control_enabled)return json({commands:[],controlEnabled:false});
  const {data,error}=await service.from('network_commands').select('id,account_id,voucher_id,action,protocol,username,session_id,mac_address,expires_at')
    .eq('router_id',routerId).eq('status','queued').gt('expires_at',new Date().toISOString())
    .order('created_at').limit(10);
  if(error)return json({error:'Commandes indisponibles.'},503);
  const commands:Record<string,unknown>[]=[];
  for(const cmd of data||[]){

   let voucherPayload:Record<string,unknown>={};
   if(['provision_voucher','expire_voucher'].includes(cmd.action)){
    if(!cmd.voucher_id){await service.from('network_commands').update({status:'cancelled',outcome:'Ticket manquant'}).eq('id',cmd.id);continue;}
    const [{data:voucher},{data:net}]=await Promise.all([
     service.from('wifi_vouchers').select('id,site_id,username,credential_hash,status,paid_at,duration_minutes,validity_days').eq('id',cmd.voucher_id).eq('company_id',router.company_id).maybeSingle(),
     service.from('wifi_voucher_network').select('router_id,site_id,password_length,credential_scheme,network_state').eq('voucher_id',cmd.voucher_id).eq('router_id',routerId).maybeSingle()
    ]);
    const provision=cmd.action==='provision_voucher';
    const valid=!!voucher&&!!net&&net.site_id===router.site_id&&cmd.username===voucher.username&&(
      provision?(voucher.status==='paid'&&!!voucher.paid_at&&['hmac-v1','hmac-numeric-v2'].includes(net.credential_scheme)):
       (voucher.status==='expired'||voucher.status==='cancelled'));
    if(!valid){
     await service.from('network_commands').update({status:'cancelled',outcome:'Droit Wi-Fi ou site invalide',completed_at:new Date().toISOString()}).eq('id',cmd.id).eq('status','queued');continue;
    }
    if(provision){
      let password='';
      try{password=deriveVoucherPassword(voucher!.id,voucher!.site_id,net!.password_length,net!.credential_scheme as 'hmac-v1'|'hmac-numeric-v2');}
      catch{return json({error:'Clé des tickets Wi-Fi indisponible.'},503);}
      const expected=digest(voucher!.site_id+':'+voucher!.username+':'+password);
      if(expected!==voucher!.credential_hash){
       await service.from('network_commands').update({status:'failed',outcome:'Empreinte du ticket incohérente',completed_at:new Date().toISOString()}).eq('id',cmd.id).eq('status','queued');continue;
      }
      voucherPayload={voucherId:voucher!.id,password,durationMinutes:voucher!.duration_minutes,credentialScheme:net!.credential_scheme};
    }else voucherPayload={voucherId:voucher!.id};
   }
   if(['block_hotspot_mac','unblock_hotspot_mac'].includes(cmd.action)){
    const {data:block}=await service.from('network_device_blocks').select('active').eq('router_id',routerId).eq('mac_address',cmd.mac_address).maybeSingle();
    const expected=cmd.action==='block_hotspot_mac';
    if(!block||block.active!==expected){await service.from('network_commands').update({status:'cancelled',outcome:'Restriction obsolète',completed_at:new Date().toISOString()}).eq('id',cmd.id).eq('status','queued');continue;}
   }
   if(cmd.account_id){
    const {data:account}=await service.from('network_access_accounts').select('desired_state').eq('id',cmd.account_id).eq('router_id',routerId).maybeSingle();
    if(!account||((cmd.action==='resume_account')!==(account.desired_state==='active'))){
     await service.from('network_commands').update({status:'cancelled',outcome:'Décision obsolète',completed_at:new Date().toISOString()}).eq('id',cmd.id).eq('status','queued');
     continue;
    }
   }
   const {data:claimed}=await service.from('network_commands').update({status:'dispatched',dispatched_at:new Date().toISOString()})
    .eq('id',cmd.id).eq('status','queued').select('id').maybeSingle();
   if(claimed)commands.push({id:cmd.id,action:cmd.action,protocol:cmd.protocol,username:cmd.username,sessionId:cmd.session_id,macAddress:cmd.mac_address,...voucherPayload});
  }
  return json({commands,controlEnabled:true});
 }
 // Results are accepted only for commands that were actually dispatched to this connector.
 const commandId=clean(b?.commandId,36),ok=b?.ok===true;
 if(!uuid.test(commandId)||typeof b?.ok!=='boolean')return json({error:'Résultat invalide.'},400);
 const {data:command,error}=await service.from('network_commands').update({
  status:ok?'success':'failed',outcome:clean(b?.outcome,600)||null,completed_at:new Date().toISOString()
 }).eq('id',commandId).eq('router_id',routerId).eq('status','dispatched')
 .select('id,account_id,voucher_id,action,mac_address').maybeSingle();
 if(error||!command)return json({error:'Commande déjà clôturée ou inconnue.'},409);
 if(ok&&command.account_id&&['suspend_account','resume_account'].includes(command.action)){
  const applied=command.action==='resume_account'?'active':'suspended';
  await service.from('network_access_accounts').update({applied_state:applied,last_sync_at:new Date().toISOString()})
   .eq('id',command.account_id).eq('desired_state',applied);
 }
 if(ok&&command.mac_address&&['block_hotspot_mac','unblock_hotspot_mac'].includes(command.action)){
  const applied=command.action==='block_hotspot_mac'?'blocked':'unblocked';
  await service.from('network_device_blocks').update({applied_state:applied,updated_at:new Date().toISOString()})
   .eq('router_id',routerId).eq('mac_address',command.mac_address);
 }

 if(command.voucher_id&&['provision_voucher','expire_voucher'].includes(command.action)){
  const newState=!ok?'failed':command.action==='provision_voucher'?'provisioned':'expired';
  const {error:stateError}=await service.from('wifi_voucher_network').update({network_state:newState,last_error:ok?null:clean(b?.outcome,300),updated_at:new Date().toISOString()})
    .eq('voucher_id',command.voucher_id).eq('router_id',routerId);
  if(stateError)return json({error:'Résultat enregistré ; état du ticket non synchronisé.'},503);
 }
 return json({recorded:true});
}
