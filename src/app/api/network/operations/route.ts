import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const error=(message:string,status:number)=>NextResponse.json({error:message},{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof b?.companyId==='string'?b.companyId:'',
  routerId=typeof b?.routerId==='string'?b.routerId:'',
  observationId=typeof b?.observationId==='string'?b.observationId:'',
  reason=typeof b?.reason==='string'?b.reason.trim():'',
  confirmation=b?.confirmation;
 if(!uuid.test(routerId)||!uuid.test(observationId)||reason.length<3||reason.length>250||
    confirmation!=='DECONNECTER')return error('Confirmation et motif requis.',400);
 const client=await createClient();
 const auth=await authorizeTenant(client,companyId);
 if(!auth.ok)return error(auth.error,auth.status);
 if(!['owner','admin'].includes(auth.member.role))return error('Droits administrateur requis.',403);
 const service=createServiceClient();
 if(!service)return error('Service réseau indisponible.',503);
 const [{data:router,error:routerError},{data:observation,error:observationError},{data:credential}]=await Promise.all([
  service.from('network_routers').select('id,company_id,site_id,control_enabled,last_seen_at')
   .eq('id',routerId).eq('company_id',companyId).maybeSingle(),
  service.from('network_observations').select('id,router_id,company_id,observed_kind,identity_key,client_label,active,observed_at')
   .eq('id',observationId).eq('router_id',routerId).eq('company_id',companyId).maybeSingle(),
  service.from('network_connector_credentials').select('paired_at,revoked_at')
   .eq('router_id',routerId).maybeSingle()
 ]);
 if(routerError||!router||observationError||!observation)return error('Routeur ou session non autorisé.',404);
 const {data:site,error:siteError}=await service.from('sites').select('id')
  .eq('id',router.site_id).eq('company_id',companyId).maybeSingle();
 if(siteError||!site)return error('Site introuvable pour ce routeur.',409);
 if(!router.control_enabled)return error('Contrôle réseau désactivé sur ce routeur.',409);
 if(!credential?.paired_at||credential.revoked_at)return error('Connecteur non appairé.',409);
 const recent=(value:string|null)=>!!value&&Number.isFinite(Date.parse(value))&&
  Date.now()-Date.parse(value)>=0&&Date.now()-Date.parse(value)<150000;
 if(!recent(router.last_seen_at)||!recent(observation.observed_at))
  return error('Routeur ou observation trop ancien : actualiser avant une déconnexion.',409);
 const protocol=observation.observed_kind==='hotspot'?'hotspot':observation.observed_kind==='pppoe'?'pppoe':null;
 const username=observation.client_label?.trim()||'';
 const sessionId=observation.identity_key?.trim()||'';
 if(!protocol||!observation.active||username.length<1||username.length>128||
    !/^\*?[a-zA-Z0-9-]{1,40}$/.test(sessionId))
  return error('Cette observation ne correspond pas à une session déconnectable.',409);
 const action=protocol==='hotspot'?'disconnect_hotspot':'disconnect_ppp';
 const {data:already,error:alreadyError}=await service.from('network_commands')
  .select('id,status').eq('company_id',companyId).eq('router_id',routerId)
  .eq('action',action).eq('session_id',sessionId).in('status',['queued','dispatched']).limit(1);
 if(alreadyError)return error('État des commandes indisponible.',503);
 if(already?.length)return NextResponse.json({commandId:already[0].id,state:already[0].status,
  message:'Déconnexion déjà demandée, en attente du routeur.'},{status:202,headers});
 const {data:command,error:queueError}=await service.from('network_commands')
  .insert({company_id:companyId,router_id:routerId,action,protocol,username,session_id:sessionId,
   created_by:auth.user.id,reason,expires_at:new Date(Date.now()+10*60000).toISOString()})
  .select('id,status').single();
 if(queueError)return error(queueError.code==='23505'?'Déconnexion déjà en attente.':'Commande non enregistrée.',queueError.code==='23505'?409:503);
 const {error:logError}=await service.from('network_access_events').insert({
  company_id:companyId,actor_user_id:auth.user.id,
  event_type:'network.session_disconnect_requested',
  reason:'Routeur '+routerId+' · session '+sessionId+' · '+protocol+' · '+reason
 });
 return NextResponse.json({commandId:command.id,state:command.status,auditRecorded:!logError,
  message:'Déconnexion enregistrée et mise en file. Confirmation MikroTik en attente.'},{status:202,headers});
}
