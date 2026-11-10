import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
import {networkWritesBlockedInPreview} from '@/lib/network-preview-guard';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const fail=(message:string,status:number)=>NextResponse.json({error:message},{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fresh=(value:string|null,max=150000)=>!!value&&Number.isFinite(Date.parse(value))&&
 Date.now()>=Date.parse(value)&&Date.now()-Date.parse(value)<max;
const ipv4=(value:string)=>{
 const parts=value.split('/')[0].split('.');
 return parts.length===4&&parts.every(p=>/^\d{1,3}$/.test(p)&&Number(p)<=255)
  ?parts.join('.'):null;
};
export async function GET(req:NextRequest){
 const companyId=req.nextUrl.searchParams.get('companyId')||'';
 const routerId=req.nextUrl.searchParams.get('routerId')||'';
 if(!uuid.test(companyId)||!uuid.test(routerId))return fail('Identifiants invalides.',400);
 const client=await createClient();
 const auth=await authorizeTenant(client,companyId);
 if(!auth.ok)return fail(auth.error,auth.status);
 const {data:router}=await client.from('network_routers').select('id')
  .eq('id',routerId).eq('company_id',companyId).maybeSingle();
 if(!router)return fail('Routeur inaccessible.',404);
 const {data,error}=await client.from('network_diagnostic_jobs')
  .select('id,kind,target,status,reply,error_message,requested_at,completed_at')
  .eq('company_id',companyId).eq('router_id',routerId)
  .order('requested_at',{ascending:false}).limit(10);
 if(error)return fail('Historique de diagnostics indisponible : migration requise.',503);
 return NextResponse.json({jobs:data||[]},{headers});
}
export async function POST(req:NextRequest){
 if(networkWritesBlockedInPreview())return fail('Laboratoire Preview isolé requis.',403);
 const b=await req.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=b?.companyId,routerId=b?.routerId,observationId=b?.observationId;
 if(typeof companyId!=='string'||!uuid.test(companyId)||
    typeof routerId!=='string'||!uuid.test(routerId)||
    typeof observationId!=='string'||!uuid.test(observationId)||b?.kind!=='ping')
  return fail('Diagnostic ou cible invalide.',400);
 const client=await createClient();
 const auth=await authorizeTenant(client,companyId);
 if(!auth.ok)return fail(auth.error,auth.status);
 if(!['owner','admin'].includes(auth.member.role))return fail('Droits administrateur requis.',403);
 const service=createServiceClient();
 if(!service)return fail('Connecteur réseau indisponible.',503);
 const [{data:router},{data:observation},{data:credential}]=await Promise.all([
  service.from('network_routers').select('id,company_id,agent_kind,control_enabled,last_seen_at')
   .eq('id',routerId).eq('company_id',companyId).maybeSingle(),
  service.from('network_observations').select('id,router_id,company_id,ip_address,observed_at,active')
   .eq('id',observationId).eq('company_id',companyId).eq('router_id',routerId).maybeSingle(),
  service.from('network_connector_credentials').select('paired_at,revoked_at')
   .eq('router_id',routerId).maybeSingle()
 ]);
 if(!router||!observation)return fail('Routeur ou destination inaccessible.',404);
 if(!router.control_enabled||router.agent_kind!=='node-local'||!credential?.paired_at||
    credential.revoked_at||!fresh(router.last_seen_at))
  return fail('Connecteur local non disponible pour ce diagnostic.',409);
 if(!fresh(observation.observed_at)||!observation.active||!observation.ip_address)
  return fail('Adresse observée trop ancienne ou inactive.',409);
 // No arbitrary target: resolve it exclusively from a recent tenant-owned row.
 const target=ipv4(String(observation.ip_address));
 if(!target)return fail('Adresse IPv4 observée non prise en charge.',409);
 const cutoff=new Date(Date.now()-10*60000).toISOString();
 await service.from('network_diagnostic_jobs')
  .update({status:'failed',completed_at:new Date().toISOString(),error_message:'Demande expirée.'})
  .eq('company_id',companyId).eq('router_id',routerId)
  .in('status',['queued','dispatched']).lt('requested_at',cutoff);
 const {data:latest,error:latestError}=await service.from('network_diagnostic_jobs')
  .select('requested_at').eq('router_id',routerId).eq('company_id',companyId)
  .order('requested_at',{ascending:false}).limit(1);
 if(latestError)return fail('État des diagnostics indisponible.',503);
 if(latest?.[0]&&fresh(latest[0].requested_at,60000))
  return fail('Un diagnostic a déjà été demandé récemment.',429);
 const {data:job,error:queueError}=await service.from('network_diagnostic_jobs')
  .insert({company_id:companyId,router_id:routerId,observation_id:observationId,
   requested_by:auth.user.id,target,kind:'ping',status:'queued'})
  .select('id,status').single();
 if(queueError)return fail(queueError.code==='23505'?'Un diagnostic est déjà en cours.':'Diagnostic non enregistré.',
  queueError.code==='23505'?409:503);
 return NextResponse.json({jobId:job.id,status:job.status,
  message:'Ping RouterOS mis en file (3 paquets maximum). Résultat à confirmer par le routeur.'},
  {status:202,headers});
}
