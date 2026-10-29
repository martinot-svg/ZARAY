#!/usr/bin/env node
// ZARAY Network Connector — Node.js 22+; outbound-only, no third-party packages.
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {homedir} from 'node:os';
const env=process.env;
const CLOUD=env.ZARAY_URL||'https://zaray.vercel.app';
const ROUTER=env.MIKROTIK_URL||'';
const ROUTER_ID=env.ZARAY_ROUTER_ID||'';
const SECRET_FILE=env.ZARAY_SECRET_FILE||join(homedir(),'.config','zaray','connector.json');
const INTERVAL=Math.max(15000,Math.min(300000,Number(env.ZARAY_POLL_MS)||30000));
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
function ensureHttps(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('Une URL HTTPS sans identifiants est obligatoire.');return u.origin;}
if(env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw Error('Refus : vérification TLS désactivée. Importez le CA du MikroTik via NODE_EXTRA_CA_CERTS.');
if(!ROUTER_ID||!ROUTER||!env.MIKROTIK_USER||!env.MIKROTIK_PASSWORD)throw Error('ZARAY_ROUTER_ID, MIKROTIK_URL, MIKROTIK_USER et MIKROTIK_PASSWORD sont requis.');
const cloud=ensureHttps(CLOUD),router=ensureHttps(ROUTER);
const basic='Basic '+Buffer.from(env.MIKROTIK_USER+':'+env.MIKROTIK_PASSWORD).toString('base64');
async function request(url,opts={}){
 const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(12000),...opts});
 const text=await r.text();
 let data;try{data=text?JSON.parse(text):null;}catch{data=text;}
 if(!r.ok)throw Error('HTTP '+r.status+' '+String(data?.message||'').slice(0,130));
 return data;
}
async function ros(path,method='GET',body){
 const safe=path.split('/').map(encodeURIComponent).join('/');
 return request(router+'/rest/'+safe,{method,headers:{Authorization:basic,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
}
let token='';
try{const saved=JSON.parse(await readFile(SECRET_FILE,'utf8'));if(saved.routerId===ROUTER_ID&&/^[0-9a-f]{64}$/i.test(saved.secret))token=saved.secret;}catch{}
async function api(action,details={}){
 return request(cloud+'/api/network/agent',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({routerId:ROUTER_ID,action,...details})});
}
if(!token){
 const pair=env.ZARAY_PAIRING_TOKEN||'';
 if(!/^[0-9a-f]{64}$/i.test(pair))throw Error('Code d’appairage initial requis : ZARAY_PAIRING_TOKEN (valide 15 minutes).');
 token=pair;
 const response=await api('claim');
 token=response.connectorSecret;
 await mkdir(dirname(SECRET_FILE),{recursive:true,mode:0o700});
 await writeFile(SECRET_FILE,JSON.stringify({routerId:ROUTER_ID,secret:token}),{mode:0o600});
 await chmod(SECRET_FILE,0o600);
 console.log('[ZARAY] Connecteur appairé, secret enregistré localement.');
}
const sources=[
 {kind:'hotspot',path:'ip/hotspot/active',key:o=>o['.id'],label:o=>o.user,ip:o=>o.address,mac:o=>o['mac-address'],active:()=>true},
 {kind:'pppoe',path:'ppp/active',key:o=>o['.id'],label:o=>o.name,ip:o=>o.address,mac:o=>o['caller-id'],active:()=>true},
 {kind:'dhcp',path:'ip/dhcp-server/lease',key:o=>o['.id'],label:o=>o['host-name'],ip:o=>o.address,mac:o=>o['mac-address'],active:o=>o.status==='bound'},
 {kind:'wifi',path:'interface/wifi/registration-table',key:o=>o['.id']||o['mac-address'],label:o=>o.interface,ip:o=>o['last-ip'],mac:o=>o['mac-address'],active:()=>true},
 {kind:'wifi',path:'interface/wireless/registration-table',key:o=>o['.id']||o['mac-address'],label:o=>o.interface,ip:o=>o['last-ip'],mac:o=>o['mac-address'],active:()=>true},
 {kind:'neighbor',path:'ip/neighbor',key:o=>o['.id']||o['mac-address']||o.address,label:o=>o.identity||o['interface-name'],ip:o=>o.address,mac:o=>o['mac-address'],active:()=>false}
];

function routerUptimeSeconds(input){
 if(typeof input!=='string')return null;
 const s=input.trim();
 if(!s)return null;
 const clock=/^(?:(\d+)w)?(?:(\d+)d)?(\d{1,2}):(\d{2}):(\d{2})$/.exec(s);
 if(clock)return Number(clock[1]||0)*604800+Number(clock[2]||0)*86400+
  Number(clock[3])*3600+Number(clock[4])*60+Number(clock[5]);
 if(!/^(?:(?:\d+)w)?(?:(?:\d+)d)?(?:(?:\d+)h)?(?:(?:\d+)m)?(?:(?:\d+)s)?$/.test(s))return null;
 if(!/\d/.test(s))return null;
 const parts=[...s.matchAll(/(\d+)([wdhms])/g)];
 const multipliers={w:604800,d:86400,h:3600,m:60,s:1};
 const seconds=parts.reduce((sum,p)=>sum+Number(p[1])*multipliers[p[2]],0);
 return Number.isSafeInteger(seconds)&&seconds>=0?seconds:null;
}
async function voucherUptimeReadings(){
 const users=await ros('ip/hotspot/user');
 if(!Array.isArray(users))return [];
 const readings=[];
 for(const user of users){
  const match=/^zaray:voucher:([0-9a-f-]{36})$/i.exec(String(user.comment||''));
  if(!match)continue;
  const seconds=routerUptimeSeconds(user.uptime);
  if(seconds===null)continue;
  readings.push({voucherId:match[1],username:String(user.name||''),uptimeSeconds:seconds});
  if(readings.length>=500)break;
 }
 return readings;
}

function normalize(v){return typeof v==='string'?v:'';}
async function sync(){
 const resource=await ros('system/resource');
 const board=await ros('system/routerboard').catch(()=>null);
 const kinds=new Set(),items=[];
 let voucherUsage=[];
 try{voucherUsage=await voucherUptimeReadings();}catch(e){console.warn('[ZARAY] Compteurs Hotspot indisponibles',e.message);}
 for(const source of sources){
  try{
   const response=await ros(source.path);
   if(!Array.isArray(response))continue;
   kinds.add(source.kind);
   for(const entry of response){
    if(items.length>=500)break;
    const key=normalize(source.key(entry)).slice(0,255);if(!key)continue;
    items.push({kind:source.kind,key,ip:normalize(source.ip(entry)),mac:normalize(source.mac(entry)),
     label:normalize(source.label(entry)),active:source.active(entry)});
   }
  }catch(e){console.warn('[ZARAY] Source indisponible',source.path,e.message);}
 }
 if(kinds.size){
  const result=await api('sync',{model:board?.['model']||resource?.['board-name']||'',version:resource?.version||'',
   kinds:[...kinds],observations:items,voucherUsage});
  console.log('[ZARAY] Synchronisées :',result.synced,'observations');
 }
}
async function findAccount(protocol,username){
 const path=protocol==='hotspot'?'ip/hotspot/user':'ppp/secret';
 const list=await ros(path);
 const row=Array.isArray(list)?list.find(o=>(protocol==='hotspot'?o.name:o.name)===username):null;
 if(!row?.['.id'])throw Error('Compte RouterOS introuvable : '+username);
 return {path,id:row['.id']};
}
async function disconnect(protocol,username,sessionId){
 const path=protocol==='hotspot'?'ip/hotspot/active':'ppp/active';
 const list=await ros(path);
 const sessions=(Array.isArray(list)?list:[]).filter(o=>
  (protocol==='hotspot'?o.user:o.name)===username&&(!sessionId||o['.id']===sessionId));
 for(const row of sessions){await ros(path+'/'+row['.id'],'DELETE');}
 return sessions.length;
}
async function hotspotMacRestriction(mac,block){
 if(!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac))throw Error('Adresse MAC invalide');
 const path='ip/hotspot/ip-binding',tag='zaray:device:'+mac.toLowerCase();
 const rows=await ros(path);
 if(!Array.isArray(rows))throw Error('Liste des règles Hotspot indisponible');
 const matching=rows.filter(row=>String(row['mac-address']||'').toLowerCase()===mac.toLowerCase());
 if(block){
  if(matching.some(row=>row.comment!==tag))throw Error('Règle existante non gérée par ZARAY : intervention manuelle nécessaire');
  if(!matching.some(row=>row.comment===tag))await ros(path,'PUT',{'mac-address':mac,type:'blocked',comment:tag});
  const active=await ros('ip/hotspot/active');
  for(const session of Array.isArray(active)?active:[]){
   if(String(session['mac-address']||'').toLowerCase()===mac.toLowerCase())await ros('ip/hotspot/active/'+session['.id'],'DELETE');
  }
 }else{
  for(const row of matching.filter(row=>row.comment===tag)){
   await ros(path+'/'+row['.id'],'DELETE');
  }
 }
 const after=await ros(path);
 const existing=Array.isArray(after)&&after.some(row=>String(row['mac-address']||'').toLowerCase()===mac.toLowerCase()&&row.comment===tag&&row.type==='blocked');
 if(existing!==block)throw Error('Etat du blocage non confirmé par RouterOS');
 return block?'Appareil bloqué sur Hotspot':'Restriction ZARAY retirée';
}
async function ensureVoucherProfile(maxDevices){
 if(!Number.isInteger(maxDevices)||maxDevices<1||maxDevices>100)throw Error('Limite appareils invalide.');
 const name='zaray-vouchers-'+maxDevices,comment='zaray:managed-hotspot-profile';
 const table='ip/hotspot/user/profile';
 const list=await ros(table);
 if(!Array.isArray(list))throw Error('Profils Hotspot indisponibles.');
 const existing=list.find(row=>row.name===name);
 if(existing){
  if(existing.comment!==comment||Number(existing['shared-users'])!==maxDevices)
   throw Error('Un profil Hotspot de même nom existe avec une configuration non gérée par ZARAY.');
 }else{
  await ros(table,'PUT',{name,'shared-users':String(maxDevices),'add-mac-cookie':'no',comment});
 }
 const after=await ros(table);
 if(!Array.isArray(after)||!after.some(row=>row.name===name&&Number(row['shared-users'])===maxDevices&&row.comment===comment))
  throw Error('Limite des appareils non confirmée par MikroTik.');
 return name;
}
async function voucherAccount(command){
 const {action,username,voucherId,password,durationMinutes,credentialScheme,maxDevices}=command;
 if(!/^[0-9a-f-]{36}$/i.test(String(voucherId||''))||!username||username.length>128)throw Error('Identité du ticket non valide.');
 const table='ip/hotspot/user',comment='zaray:voucher:'+voucherId;
 const list=await ros(table);
 if(!Array.isArray(list))throw Error('Liste des comptes Hotspot indisponible.');
 const matches=list.filter(u=>u.name===username);
 if(matches.length>1)throw Error('Identifiant Hotspot en double.');
 const existing=matches[0];
 if(existing&&existing.comment!==comment)throw Error('Identifiant existant non géré par ZARAY.');
 if(action==='provision_voucher'){
  const legacy=credentialScheme==='hmac-v1'||credentialScheme===undefined;
  const matchesCredential=legacy?/^[A-Z0-9]{3,32}$/.test(password||''):
   credentialScheme==='hmac-numeric-v2'&&/^[0-9]{3,5}$/.test(password||'');
  if(typeof password!=='string'||!matchesCredential||!Number.isInteger(durationMinutes)||durationMinutes<1||durationMinutes>525600)
   throw Error('Ticket invalide.');
  const profile=await ensureVoucherProfile(maxDevices||1);
  const payload={name:username,password,disabled:'false','limit-uptime':String(durationMinutes)+'m',profile,comment};
  if(existing)await ros(table+'/'+existing['.id'],'PATCH',payload);
  else await ros(table,'PUT',payload);
  const after=await ros(table);
  const row=Array.isArray(after)?after.find(u=>u.name===username&&u.comment===comment):null;
  if(!row||String(row.disabled)==='true'||row.profile!==profile)throw Error('Provisionnement non confirmé.');
  return 'Compte Hotspot provisionné et activé ; première connexion attendue.';
 }
 if(action==='expire_voucher'){
  if(existing){
   await ros(table+'/'+existing['.id'],'PATCH',{disabled:'true'});
   await disconnect('hotspot',username);
   const after=await ros(table+'/'+existing['.id']);
   if(String(after.disabled)!=='true')throw Error('Désactivation Hotspot non confirmée.');
  }
  return 'Ticket expiré ; accès désactivé ou déjà absent.';
 }
 throw Error('Action non autorisée pour ce ticket.');
}
async function execute(command){
 const {action,protocol,username,sessionId,macAddress}=command;
 if(action==='provision_voucher'||action==='expire_voucher')return voucherAccount(command);
 if(action==='block_hotspot_mac'||action==='unblock_hotspot_mac')return hotspotMacRestriction(macAddress,action==='block_hotspot_mac');
 if(!['hotspot','pppoe'].includes(protocol)||!username||username.length>128)throw Error('Cible invalide');
 if(action==='disconnect_hotspot'&&protocol==='hotspot'||action==='disconnect_ppp'&&protocol==='pppoe'){
  const count=await disconnect(protocol,username,sessionId);
  return 'Sessions déconnectées : '+count;
 }
 if(action==='suspend_account'||action==='resume_account'){
  const target=await findAccount(protocol,username);
  await ros(target.path+'/'+target.id,'PATCH',{disabled:action==='suspend_account'?'true':'false'});
  const current=await ros(target.path+'/'+target.id);
  if(String(current.disabled)!==(action==='suspend_account'?'true':'false'))throw Error('Etat du compte non confirmé');
  if(action==='suspend_account'){
   const count=await disconnect(protocol,username);
   return 'Compte désactivé, sessions terminées : '+count;
  }
  return 'Compte autorisé dans RouterOS ; reconnexion à confirmer côté client';
 }
 throw Error('Action non autorisée : '+action);
}
async function poll(){
 const r=await api('poll');
 for(const command of r.commands||[]){
  let ok=false,outcome='';
  try{outcome=await execute(command);ok=true;}catch(e){outcome=String(e.message).slice(0,450);}
  try{await api('result',{commandId:command.id,ok,outcome});}
  catch(e){console.error('[ZARAY] Résultat non confirmé :',command.id,e.message);}
 }
}
console.log('[ZARAY] Surveillance démarrée pour',ROUTER_ID,'via',cloud);
for(;;){
 try{await sync();await poll();}catch(e){console.error('[ZARAY] Cycle interrompu :',e.message);}
 await sleep(INTERVAL);
}
