import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
import {networkWritesBlockedInPreview} from '@/lib/network-preview-guard';
import {parseManagedConfigRequest} from '@/lib/network-managed-config';
import {routerHeartbeatIsFresh} from '@/lib/network-inventory-freshness';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});
const fail=(message:string,status:number)=>respond({error:message},status);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const itemId=/^\*[0-9a-f]{1,16}$/i;

export async function GET(request:NextRequest){
 const companyId=request.nextUrl.searchParams.get('companyId')||'';
 const routerId=request.nextUrl.searchParams.get('routerId')||'';
 if(!uuid.test(companyId)||!uuid.test(routerId))return fail('Identifiants invalides.',400);
 const client=await createClient();
 const auth=await authorizeTenant(client,companyId);
 if(!auth.ok)return fail(auth.error,auth.status);
 const {data:router,error:routerError}=await client.from('network_routers')
  .select('id').eq('company_id',companyId).eq('id',routerId).maybeSingle();
 if(routerError||!router)return fail('Routeur inaccessible.',404);
 const {data:jobs,error}=await client.from('network_managed_config_jobs')
  .select('id,category,operation,target_id,requested_values,reason,status,created_at,completed_at,before_state,after_state,outcome')
  .eq('router_id',routerId).eq('company_id',companyId)
  .order('created_at',{ascending:false}).limit(20);
 if(error)return fail('Journal de configuration indisponible : migration requise.',503);
 const safe=(jobs||[]).map(job=>{
  if(['queued','dispatched'].includes(job.status)&&Date.now()-Date.parse(job.created_at)>600000)
   return {...job,status:'manual_review',outcome:'Résultat non confirmé. Vérifier le routeur avant une nouvelle configuration.'};
  return job;
 });
 return respond({jobs:safe});
}

export async function POST(request:NextRequest){
 if(networkWritesBlockedInPreview())
  return fail('Opérations réseau interdites sur Preview sans laboratoire isolé.',403);
 if(Number(request.headers.get('content-length')||0)>4096)return fail('Requête trop volumineuse.',413);
 const origin=request.headers.get('origin');
 if(origin&&origin!==request.nextUrl.origin)
  return fail('Origine de la requête non autorisée.',403);
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=body?.companyId,routerId=body?.routerId;
 if(typeof companyId!=='string'||!uuid.test(companyId)||
    typeof routerId!=='string'||!uuid.test(routerId))return fail('Entreprise ou routeur invalide.',400);
 const data=parseManagedConfigRequest(body);
 if(!data)return fail('Paramètres réseau invalides ou non autorisés.',400);
 if(body?.confirmation!==(data.operation==='delete'?'SUPPRIMER':'CONFIRMER'))
  return fail('Confirmation explicite obligatoire.',400);
 const client=await createClient();
 const auth=await authorizeTenant(client,companyId);
 if(!auth.ok)return fail(auth.error,auth.status);
 if(!['owner','admin'].includes(auth.member.role))
  return fail('Droits administrateur requis.',403);
 const service=createServiceClient();
 if(!service)return fail('Service RouterOS non configuré.',503);
 const [{data:router,error:routerError},{data:credential,error:credentialError}]=await Promise.all([
  service.from('network_routers')
   .select('id,company_id,site_id,control_enabled,agent_kind,last_seen_at')
   .eq('company_id',companyId).eq('id',routerId).maybeSingle(),
  service.from('network_connector_credentials').select('paired_at,revoked_at')
   .eq('router_id',routerId).maybeSingle()
 ]);
 if(routerError||!router)return fail('Routeur inaccessible.',404);
 if(credentialError||!credential?.paired_at||credential.revoked_at)
  return fail('Connecteur non appairé.',409);
 if(!router.control_enabled||router.agent_kind!=='node-local'||
    !routerHeartbeatIsFresh(router.last_seen_at))
  return fail('Administration désactivée ou connecteur Node local hors ligne.',409);
 const {data:site,error:siteError}=await service.from('sites')
  .select('id,status').eq('id',router.site_id).eq('company_id',companyId).maybeSingle();
 if(siteError||!site||site.status!=='active')return fail('Site réseau inactif.',409);
 let targetId:string|null=null;
 if(data.operation!=='create'){
  const {data:observation,error:obsError}=await service.from('network_observations')
   .select('id,observed_kind,identity_key,observed_at')
   .eq('company_id',companyId).eq('router_id',routerId)
   .eq('id',data.observationId).maybeSingle();
  if(obsError||!observation||observation.observed_kind!==data.category||
     !routerHeartbeatIsFresh(observation.observed_at,Date.now(),300000)||
     !itemId.test(observation.identity_key))
   return fail('Élément indisponible ou observation périmée. Actualiser son inventaire.',409);
  targetId=observation.identity_key;
 }
 // Prevent concurrent changes with the existing Hotspot, PPP and voucher job queue.
 const {data:pendingCommands,error:pendingError}=await service.from('network_commands')
  .select('id').eq('company_id',companyId).eq('router_id',routerId)
  .in('status',['queued','dispatched']).limit(1);
 if(pendingError)return fail('Contrôle des autres opérations indisponible.',503);
 if(pendingCommands?.length)return fail('Une autre commande RouterOS est en cours sur ce routeur.',409);
 const {data:queued,error:queueError}=await service.from('network_managed_config_jobs').insert({
  company_id:companyId,router_id:routerId,actor_user_id:auth.user.id,
  category:data.category,operation:data.operation,target_id:targetId,
  requested_values:data.values,reason:data.reason,status:'queued'
 }).select('id,status').single();
 if(queueError)return fail(queueError.code==='23505'
  ?'Une configuration est en cours ou nécessite une vérification manuelle.'
  :'Enregistrement de la configuration impossible.',queueError.code==='23505'?409:503);
 return respond({
  jobId:queued.id,status:queued.status,
  message:'Modification mise en file. Aucune réussite ne sera annoncée avant la vérification RouterOS.'
 },202);
}
