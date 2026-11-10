import {dispatchableNetworkCommand} from '@/lib/network-command-lease';
import {networkWritesBlockedInPreview} from '@/lib/network-preview-guard';
import {sanitizeInventoryProperties} from '@/lib/network-inventory-properties';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createServiceClient} from '@/lib/supabase/service';
import {deriveVoucherPassword,hashVoucherCredential,type VoucherKeyVersion} from '@/lib/network-voucher-secret';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const kinds=['hotspot','pppoe','dhcp','wifi','neighbor','radius','interface','hotspot-user','hotspot-profile','ppp-secret','ppp-profile','ip-address','ip-pool','dhcp-server','dhcp-client','vlan','arp','queue','firewall-filter','firewall-nat','route','bridge','bridge-port','dhcp-network','dns-static','firewall-address-list','queue-tree','wireguard-interface','wireguard-peer','routing-rule','ipv6-address'];
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const clean=(s:unknown,max=128)=>typeof s==='string'?s.trim().slice(0,max):'';
export async function POST(request:NextRequest){
 if(networkWritesBlockedInPreview())return NextResponse.json({error:'Prévisualisation réseau en lecture seule.'},{status:403,headers:{'Cache-Control':'no-store'}});
 const auth=request.headers.get('authorization')||'';
 const token=/^Bearer ([0-9a-f]{64})$/i.exec(auth)?.[1]||'';
 const b=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const routerId=clean(b?.routerId,36),action=b?.action;
 if(!token||!uuid.test(routerId)||!['claim','sync','poll','result','refresh-complete','diagnostic-result'].includes(String(action)))return json({error:'Requête non autorisée.'},401);
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
  .select('id,company_id,site_id,control_enabled,agent_kind').eq('id',routerId).maybeSingle();
 if(routerError||!router)return json({error:'Routeur introuvable.'},404);
 if(action==='diagnostic-result'){
  const id=clean(b?.jobId,36),ok=b?.ok===true;
  if(!uuid.test(id)||typeof b?.ok!=='boolean')return json({error:'Résultat diagnostic invalide.'},400);
  if(!Array.isArray(b?.samples)||b.samples.length>3||(ok&&b.samples.length===0))
   return json({error:'Taille du diagnostic invalide.'},400);
  const samples=b.samples.map(sample=>{
   if(!sample||typeof sample!=='object'||Array.isArray(sample))return null;
   const r=sample as Record<string,unknown>,out:Record<string,string>={};
   for(const key of ['seq','time','status','ttl']){
    const v=r[key];
    if(v!==undefined){
     if(typeof v!=='string'||v.length>64||/[\u0000-\u001f\u007f]/.test(v))return null;
     out[key]=v;
    }
   }
   if(!out.seq||!/^[0-2]$/.test(out.seq)||out.status==='received'&&!out.time)return null;
   return out;
  });
  if(samples.includes(null)||JSON.stringify(samples).length>1900)
   return json({error:'Échantillons du diagnostic invalides.'},400);
  const {data:recorded,error:resultError}=await service.from('network_diagnostic_jobs')
   .update({status:ok?'success':'failed',reply:ok?samples:[],
    error_message:ok?null:clean(b?.error,180)||'Diagnostic RouterOS impossible.',
    completed_at:new Date().toISOString()})
   .eq('id',id).eq('router_id',routerId).eq('company_id',router.company_id)
   .eq('status','dispatched').select('id').maybeSingle();
  if(resultError)return json({error:'Résultat du ping non enregistré.'},503);
  if(!recorded)return json({error:'Diagnostic déjà terminé ou non attribué à ce connecteur.'},409);
  return json({recorded:true});
 }
 if(action==='refresh-complete'){
  const kind=clean(b?.kind,40),requestedAt=b?.requestedAt;
  if(!kinds.includes(kind)||typeof requestedAt!=='string'||requestedAt.length>40||
     !Number.isFinite(Date.parse(requestedAt))||
     Date.parse(requestedAt)>Date.now()||Date.now()-Date.parse(requestedAt)>10*60000)
   return json({error:'Demande de collecte invalide ou expirée.'},400);
  const {data:source,error:sourceError}=await service.from('network_inventory_sources')
   .select('observed_at').eq('router_id',routerId).eq('company_id',router.company_id)
   .eq('observed_kind',kind).maybeSingle();
  if(sourceError||!source||Date.parse(source.observed_at)<Date.parse(requestedAt))
   return json({error:'Aucune nouvelle collecte vérifiée pour cette demande.'},409);
  const {data:ack,error:ackError}=await service.from('network_inventory_refresh_requests')
   .update({fulfilled_at:new Date().toISOString()}).eq('router_id',routerId)
   .eq('company_id',router.company_id).eq('observed_kind',kind)
   .eq('requested_at',requestedAt).is('fulfilled_at',null).select('router_id').maybeSingle();
  if(ackError)return json({error:'Acquittement de la collecte indisponible.'},503);
  return json({acknowledged:!!ack});
 }
 if(action==='sync'){
  if(!Array.isArray(b?.observations)||b!.observations.length>500||!Array.isArray(b?.kinds))return json({error:'Inventaire invalide.'},400);
  const completed=[...new Set((b!.kinds as unknown[]).filter((x):x is string=>typeof x==='string'&&kinds.includes(x)))];
  if(!completed.length)return json({error:'Aucune source de découverte valide.'},400);
  const now=new Date().toISOString();
  const observations=b!.observations.map(v=>{
   if(!v||typeof v!=='object')return null;
   const o=v as Record<string,unknown>, kind=clean(o.kind,32),key=clean(o.key,255);
   if(!completed.includes(kind)||!key)return null;
   const ip=clean(o.ip,48), mac=clean(o.mac,32);
   const safeProperties=sanitizeInventoryProperties(kind,o.props);
   if(safeProperties===null)return null;
   return {company_id:router.company_id,router_id:routerId,observed_kind:kind,identity_key:key,
    client_label:clean(o.label,160)||null,ip_address:/^[0-9a-fA-F:.]+$/.test(ip)?ip:null,
    mac_address:/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)?mac:null,
    active:o.active===true,observed_at:now,safe_properties:safeProperties};
  }).filter((v):v is NonNullable<typeof v>=>v!==null);
  if(observations.length!==b!.observations.length)return json({error:'Observations invalides.'},400);
  const completeKinds=new Set<string>();
  const sourceEntries:{
   router_id:string;company_id:string;observed_kind:string;
   reported_count:number;collected_count:number;complete:boolean;observed_at:string
  }[]=[];
  // Preflight the completeness metadata before making any database changes.
  if(b?.sourceStats!==undefined){
   if(!Array.isArray(b.sourceStats)||b.sourceStats.length>kinds.length)
    return json({error:'État des sources invalide.'},400);
   const unique=new Set<string>();
   for(const value of b.sourceStats){
    if(!value||typeof value!=='object'||Array.isArray(value))
     return json({error:'État des sources invalide.'},400);
    const item=value as Record<string,unknown>;
    const kind=clean(item.kind,32),reported=item.reportedCount,collected=item.collectedCount;
    if(!completed.includes(kind)||unique.has(kind)||
       typeof reported!=='number'||!Number.isInteger(reported)||reported<0||reported>100000||
       typeof collected!=='number'||!Number.isInteger(collected)||collected<0||collected>500||collected>reported||
       typeof item.complete!=='boolean'||(item.complete&&collected!==reported))
     return json({error:'État des sources invalide.'},400);
    unique.add(kind);
    // Never trust a complete=true claim if some reported rows were not included.
    const actual=observations.filter(o=>o.observed_kind===kind).length;
    if(item.complete&&actual!==collected)
     return json({error:'Couverture complète incohérente avec les observations.'},400);
    if(item.complete)completeKinds.add(kind);
    sourceEntries.push({router_id:routerId,company_id:router.company_id,observed_kind:kind,
     reported_count:reported,collected_count:collected,complete:item.complete,observed_at:now});
   }
  }
  if(observations.length){
   const {error}=await service.from('network_observations').upsert(observations,{onConflict:'router_id,observed_kind,identity_key'});
   if(error)return json({error:'Impossible de synchroniser les appareils.'},503);
  }
  for(const kind of completed){
   if(!completeKinds.has(kind))continue;
   const {error}=await service.from('network_observations').update({active:false}).eq('router_id',routerId).eq('observed_kind',kind).lt('observed_at',now);
   if(error)return json({error:'Inventaire partiellement mis à jour.'},503);
  }
  // A partial source must never clear devices that the capped poll did not see.
  if(sourceEntries.length){
   const {error:sourceError}=await service.from('network_inventory_sources')
    .upsert(sourceEntries,{onConflict:'router_id,observed_kind'});
   if(sourceError)return json({error:'État de couverture des inventaires indisponible.'},503);
  }
  // A first authenticated Hotspot session activates the voucher's usage window.
  const connectedNames=new Set(observations.filter(o=>o.observed_kind==='hotspot'&&o.active&&o.client_label).map(o=>o.client_label));
  if(completed.includes('hotspot')&&connectedNames.size){
   const {error:redeemError}=await service.rpc('record_preprinted_wifi_logins',{
     p_router_id:routerId,p_usernames:[...connectedNames].slice(0,500)
   });
   if(redeemError)return json({error:'Comptabilisation des premières connexions indisponible.'},503);
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
  if(b?.resources!==undefined){
   const raw=b.resources;
   if(!raw||typeof raw!=='object'||Array.isArray(raw))
    return json({error:'Ressources RouterOS invalides.'},400);
   const m=raw as Record<string,unknown>;
   const parse=(value:unknown,max:number)=>{
    const v=typeof value==='number'?String(value):value;
    if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,15})$/.test(v))return null;
    const n=Number(v);
    return Number.isSafeInteger(n)&&n<=max?n:null;
   };
   const cpu=parse(m.cpuLoad,100),free=parse(m.freeMemory,Number.MAX_SAFE_INTEGER);
   const total=parse(m.totalMemory,Number.MAX_SAFE_INTEGER),uptime=m.uptime;
   if(cpu===null||free===null||total===null||free>total||
      typeof uptime!=='string'||uptime.length<1||uptime.length>64)
    return json({error:'Ressources RouterOS invalides.'},400);
   const {error:resourceError}=await service.from('network_router_resources').upsert({
    router_id:routerId,company_id:router.company_id,cpu_load_percent:cpu,
    free_memory_bytes:free,total_memory_bytes:total,router_uptime:uptime,
    observed_at:now
   },{onConflict:'router_id'});
   if(resourceError)return json({error:'Synchronisation des ressources indisponible.'},503);
  }
  if(b?.agentKind!==undefined&&!['node-local','routeros-native'].includes(String(b.agentKind)))
   return json({error:'Type d’agent invalide.'},400);
  const model=clean(b?.model,120),version=clean(b?.version,120);
  const routerUpdate:Record<string,unknown>={status:'online',last_seen_at:now,model:model||null,routeros_version:version||null};
  if(b?.agentKind)routerUpdate.agent_kind=b.agentKind;
  const {error}=await service.from('network_routers').update(routerUpdate).eq('id',routerId);
  if(error)return json({error:'État du routeur indisponible.'},503);
  return json({synced:observations.length,kinds:completed});
 }
 await service.from('network_connector_credentials').update({last_poll_at:new Date().toISOString()}).eq('router_id',routerId);
 if(action==='poll'){
  const {data:refreshRequests,error:refreshError}=await service.from('network_inventory_refresh_requests')
   .select('observed_kind,requested_at').eq('router_id',routerId)
   .eq('company_id',router.company_id).is('fulfilled_at',null)
   .gte('requested_at',new Date(Date.now()-10*60000).toISOString())
   .order('requested_at',{ascending:true}).limit(2);
  if(refreshError)return json({error:'Demandes de collecte indisponibles.'},503);
  const refresh=(refreshRequests||[]).filter(v=>kinds.includes(v.observed_kind))
   .map(v=>({kind:v.observed_kind,requestedAt:v.requested_at}));
  if(!router.control_enabled)return json({commands:[],controlEnabled:false,refresh});
  // Keep observations and accounting working when suspended, but never
  // provision, resume or unblock clients for a site that is no longer active.
  const [{data:siteState,error:siteError},{data:companyState,error:companyError}]=await Promise.all([
   service.from('sites').select('status').eq('id',router.site_id).eq('company_id',router.company_id).maybeSingle(),
   service.from('companies').select('status').eq('id',router.company_id).maybeSingle()
  ]);
  if(siteError||!siteState||companyError||!companyState)
   return json({error:'Statut du site ou de l’entreprise indisponible.'},503);
  const siteActive=siteState.status==='active'&&['trial','active'].includes(companyState.status);
  // A native RouterOS script explicitly declares the small set of actions it can execute.
  // Legacy Node connectors omit this parameter and continue receiving every supported command.
  const declared=b?.supportedActions;
  if(declared!==undefined&&(!Array.isArray(declared)||declared.length>8||
   declared.some(x=>typeof x!=='string'||![
    'disconnect_hotspot','disconnect_ppp','suspend_account','resume_account',
    'provision_voucher','expire_voucher','block_hotspot_mac','unblock_hotspot_mac'
   ].includes(x))))return json({error:'Capacités de l’agent invalides.'},400);
  const supported=Array.isArray(declared)?[...new Set(declared as string[])]:null;
  if(supported&&supported.length===0)return json({commands:[],controlEnabled:true});
  // A dropped acknowledgement or router reboot must not permanently strand a command.
  // Redispatch only after a 90-second lease, with all entitlements rechecked.
  const dispatchNow=Date.now();
  let query=service.from('network_commands')
   .select('id,account_id,voucher_id,action,protocol,username,session_id,mac_address,expires_at,status,dispatched_at')
   .eq('router_id',routerId).in('status',['queued','dispatched']).gt('expires_at',new Date().toISOString());
  if(supported)query=query.in('action',supported);
  const {data,error}=await query.order('created_at').limit(100);
  if(error)return json({error:'Commandes indisponibles.'},503);
  const retryable=(data||[]).filter(cmd=>dispatchableNetworkCommand(cmd,dispatchNow)).slice(0,10);
  const commands:Record<string,unknown>[]=[];
  for(const cmd of retryable){

   if(!siteActive&&['provision_voucher','resume_account','unblock_hotspot_mac'].includes(cmd.action)){
    await service.from('network_commands')
     .update({status:'cancelled',outcome:'Site ou entreprise désactivé : activation réseau refusée',completed_at:new Date().toISOString()})
     .eq('id',cmd.id).eq('router_id',routerId).in('status',['queued','dispatched']);
    continue;
   }
   let voucherPayload:Record<string,unknown>={};
   let accountPayload:Record<string,unknown>={};
   if(['provision_voucher','expire_voucher'].includes(cmd.action)){
    if(!cmd.voucher_id){await service.from('network_commands').update({status:'cancelled',outcome:'Ticket manquant'}).eq('id',cmd.id);continue;}
    const [{data:voucher},{data:net}]=await Promise.all([
     service.from('wifi_vouchers').select('id,site_id,username,credential_hash,status,paid_at,duration_minutes,validity_days').eq('id',cmd.voucher_id).eq('company_id',router.company_id).maybeSingle(),
     service.from('wifi_voucher_network').select('router_id,site_id,password_length,credential_scheme,key_version,network_state,unit_price,max_devices').eq('voucher_id',cmd.voucher_id).eq('router_id',routerId).maybeSingle()
    ]);
    const provision=cmd.action==='provision_voucher';
    const valid=!!voucher&&!!net&&net.site_id===router.site_id&&cmd.username===voucher.username&&(
      provision?((voucher.status==='paid'&&!!voucher.paid_at)||
       (voucher.status==='available'&&net.unit_price!==null&&['queued','failed'].includes(net.network_state)))
       &&['hmac-v1','hmac-numeric-v2'].includes(net.credential_scheme)&&[1,2].includes(net.key_version):
       (voucher.status==='expired'||voucher.status==='cancelled'));
    if(!valid){
     await service.from('network_commands').update({status:'cancelled',outcome:'Droit Wi-Fi ou site invalide',completed_at:new Date().toISOString()}).eq('id',cmd.id).eq('router_id',routerId).in('status',['queued','dispatched']);continue;
    }
    if(provision){
      let password='';
      try{password=deriveVoucherPassword(voucher!.id,voucher!.site_id,net!.password_length,net!.credential_scheme as 'hmac-v1'|'hmac-numeric-v2',net!.key_version as VoucherKeyVersion);}
      catch{return json({error:'Clé des tickets Wi-Fi indisponible.'},503);}
      const expected=hashVoucherCredential(voucher!.site_id,voucher!.username,password,net!.key_version as VoucherKeyVersion);
      const actual=voucher!.credential_hash;
      const hashMatches=typeof actual==='string'&&/^[0-9a-f]{64}$/i.test(actual)&&
        timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(actual,'hex'));
      if(!hashMatches){
       await service.from('network_commands').update({status:'failed',outcome:'Empreinte du ticket incohérente',completed_at:new Date().toISOString()}).eq('id',cmd.id).eq('router_id',routerId).in('status',['queued','dispatched']);continue;
      }
      voucherPayload={voucherId:voucher!.id,password,durationMinutes:voucher!.duration_minutes,maxDevices:net!.max_devices,credentialScheme:net!.credential_scheme};
    }else voucherPayload={voucherId:voucher!.id};
   }
   if(['block_hotspot_mac','unblock_hotspot_mac'].includes(cmd.action)){
    const {data:block}=await service.from('network_device_blocks').select('active').eq('router_id',routerId).eq('mac_address',cmd.mac_address).maybeSingle();
    const expected=cmd.action==='block_hotspot_mac';
    if(!block||block.active!==expected){await service.from('network_commands').update({status:'cancelled',outcome:'Restriction obsolète',completed_at:new Date().toISOString()}).eq('id',cmd.id).eq('router_id',routerId).in('status',['queued','dispatched']);continue;}
   }
   if(cmd.account_id){
    const {data:account,error:accountError}=await service.from('network_access_accounts')
     .select('id,company_id,order_id,username,protocol,desired_state,expires_at,grace_until,extension_until,administrative_hold,upload_kbps,download_kbps')
     .eq('id',cmd.account_id).eq('company_id',router.company_id).eq('router_id',routerId).maybeSingle();
    if(accountError)return json({error:'Droit réseau indisponible.'},503);
    const resume=cmd.action==='resume_account';
    const expiry=account?.expires_at?Math.max(...[account.expires_at,account.grace_until,account.extension_until]
     .filter((v):v is string=>typeof v==='string').map(v=>new Date(v).getTime())):0;
    let payable=!!account?.order_id;
    if(resume&&account?.order_id){
     const {data:order,error:orderError}=await service.from('subscription_orders')
      .select('id,status,paid_at,site_id').eq('id',account.order_id).eq('company_id',router.company_id).maybeSingle();
     if(orderError)return json({error:'Paiement de l’abonnement indisponible.'},503);
     payable=!!order?.paid_at&&!!order?.site_id&&order.site_id===router.site_id&&
      ['paid','active','activation_pending'].includes(order.status);
    }
    if(!account||account.username!==cmd.username||account.protocol!==cmd.protocol||
      (resume?account.desired_state!=='active'||account.administrative_hold||!siteActive||!payable||!Number.isFinite(expiry)||expiry<=Date.now():
      account.desired_state!=='suspended')){
     await service.from('network_commands').update({status:'cancelled',outcome:'Droit modifié ou paiement/échéance invalide',completed_at:new Date().toISOString()})
      .eq('id',cmd.id).eq('router_id',routerId).in('status',['queued','dispatched']);
     continue;
    }
    if(resume){
     // RouterOS :timestamp and :tonsec both represent nanoseconds from Unix epoch.
     // The router stores the deadline in its owned account comment for offline checks.
     accountPayload={accountId:account.id,deadlineEpochNs:(BigInt(expiry)*BigInt(1000000)).toString()};
     if(Number.isInteger(account.upload_kbps)&&Number.isInteger(account.download_kbps))
      accountPayload={...accountPayload,uploadKbps:account.upload_kbps,downloadKbps:account.download_kbps};
    }
   }
   let claim=service.from('network_commands').update({status:'dispatched',dispatched_at:new Date().toISOString()})
    .eq('id',cmd.id).eq('router_id',routerId).eq('status',cmd.status);
   if(cmd.status==='dispatched')claim=claim.eq('dispatched_at',cmd.dispatched_at);
   const {data:claimed}=await claim.select('id').maybeSingle();
   if(claimed)commands.push({id:cmd.id,action:cmd.action,protocol:cmd.protocol,username:cmd.username,sessionId:cmd.session_id,macAddress:cmd.mac_address,...voucherPayload,...accountPayload});
  }
  const diagnostics:Record<string,unknown>[]=[];
  if(router.agent_kind==='node-local'){
   const now=Date.now(),cutoff=new Date(now-10*60000).toISOString();
   const {data:pending,error:diagnosticError}=await service.from('network_diagnostic_jobs')
    .select('id,target,kind,status,dispatched_at').eq('router_id',routerId)
    .eq('company_id',router.company_id).in('status',['queued','dispatched'])
    .gte('requested_at',cutoff).order('requested_at',{ascending:true}).limit(3);
   if(diagnosticError)return json({error:'Diagnostics indisponibles.'},503);
   for(const job of pending||[]){
    if(job.kind!=='ping')continue;
    if(job.status==='dispatched'&&(
      !job.dispatched_at||!Number.isFinite(Date.parse(job.dispatched_at))||
      Date.parse(job.dispatched_at)>now-90000
    ))continue;
    let claim=service.from('network_diagnostic_jobs')
     .update({status:'dispatched',dispatched_at:new Date().toISOString()})
     .eq('id',job.id).eq('router_id',routerId).eq('company_id',router.company_id)
     .eq('status',job.status);
    if(job.status==='dispatched')claim=claim.eq('dispatched_at',job.dispatched_at);
    const {data:claimed,error:claimError}=await claim.select('id').maybeSingle();
    if(claimError)return json({error:'Attribution du diagnostic indisponible.'},503);
    if(claimed){
     diagnostics.push({id:job.id,kind:'ping',target:job.target});
     break;
    }
   }
  }
  return json({commands,controlEnabled:true,refresh,diagnostics});
 }
 // Results are accepted only for commands that were actually dispatched to this connector.
 const commandId=clean(b?.commandId,36),ok=b?.ok===true;
 if(!uuid.test(commandId)||typeof b?.ok!=='boolean')return json({error:'Résultat invalide.'},400);
 const {data:recorded,error}=await service.from('network_commands').update({
  status:ok?'success':'failed',outcome:clean(b?.outcome,600)||null,completed_at:new Date().toISOString()
 }).eq('id',commandId).eq('router_id',routerId).eq('status','dispatched')
 .select('id,account_id,voucher_id,action,mac_address').maybeSingle();
 if(error)return json({error:'Enregistrement du résultat impossible.'},503);
 // Replays with the same outcome are idempotent. Retry downstream side effects
 // after a partial server failure without treating the router's receipt as lost.
 let command=recorded;
 if(!command){
  const {data:previous,error:previousError}=await service.from('network_commands')
   .select('id,account_id,voucher_id,action,mac_address,status')
   .eq('id',commandId).eq('router_id',routerId).maybeSingle();
  if(previousError)return json({error:'Résultat indisponible.'},503);
  if(!previous||previous.status!==(ok?'success':'failed'))
   return json({error:'Commande inconnue ou résultat contradictoire.'},409);
  command=previous;
 }
 if(ok&&command.account_id&&['suspend_account','resume_account'].includes(command.action)){
  const applied=command.action==='resume_account'?'active':'suspended';
  const {data:updatedAccount,error:accountSyncError}=await service.from('network_access_accounts')
   .update({applied_state:applied,last_sync_at:new Date().toISOString()})
   .eq('id',command.account_id).eq('company_id',router.company_id)
   .eq('router_id',routerId).eq('desired_state',applied).select('id').maybeSingle();
  // The database trigger records the order's activation only after a trusted
  // MikroTik connector confirms the resume command. Never claim success when
  // the entitlement's applied state could not be persisted.
  if(accountSyncError||!updatedAccount)return json({error:'Commande réseau confirmée, mais synchronisation des droits non enregistrée. Vérifiez le suivi réseau.'},503);
 }
 if(ok&&command.mac_address&&['block_hotspot_mac','unblock_hotspot_mac'].includes(command.action)){
  const applied=command.action==='block_hotspot_mac'?'blocked':'unblocked';
  await service.from('network_device_blocks').update({applied_state:applied,updated_at:new Date().toISOString()})
   .eq('router_id',routerId).eq('mac_address',command.mac_address);
 }

 if(command.voucher_id&&['provision_voucher','expire_voucher'].includes(command.action)){
  const newState=!ok?'failed':command.action==='provision_voucher'?'provisioned':'expired';
  const {error:stateError}=await service.from('wifi_voucher_network').update({network_state:newState,prepared_at:ok&&command.action==='provision_voucher'?new Date().toISOString():undefined,
    last_error:ok?null:clean(b?.outcome,300),updated_at:new Date().toISOString()})
    .eq('voucher_id',command.voucher_id).eq('router_id',routerId);
  if(stateError)return json({error:'Résultat enregistré ; état du ticket non synchronisé.'},503);
 }
 return json({recorded:true});
}
