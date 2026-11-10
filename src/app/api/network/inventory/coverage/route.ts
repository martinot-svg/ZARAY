import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {authorizeTenant} from '@/lib/tenant-context';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds=[
 'interface','hotspot','pppoe','dhcp','wifi','neighbor','radius',
 'hotspot-user','hotspot-profile','ppp-secret','ppp-profile','ip-address',
 'ip-pool','dhcp-server','queue','firewall-filter','firewall-nat','route'
] as const;
const nativeKinds=new Set<string>(['interface','hotspot','pppoe']);
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});

/** Read-only inventory coverage for the current tenant and a single router.
 * This never enables RouterOS services and never returns raw router configs.
 */
export async function GET(req:NextRequest){
 const companyId=req.nextUrl.searchParams.get('companyId')||'';
 const routerId=req.nextUrl.searchParams.get('routerId')||'';
 if(!uuid.test(companyId)||!uuid.test(routerId))return fail('Identifiants invalides.',400);
 const client=await createClient();
 const permission=await authorizeTenant(client,companyId);
 if(!permission.ok)return fail(permission.error,permission.status);
 const {data:router,error:routerError}=await client.from('network_routers')
  .select('id,company_id,agent_kind,last_seen_at')
  .eq('id',routerId).eq('company_id',companyId).maybeSingle();
 if(routerError||!router)return fail('Routeur inaccessible dans cette entreprise.',404);
 const {data:sources,error:sourceError}=await client.from('network_inventory_sources')
  .select('observed_kind,reported_count,collected_count,complete,observed_at')
  .eq('company_id',companyId).eq('router_id',routerId).limit(100);
 // An isolated Preview may not have the additive inventory migration yet.
 if(sourceError)return NextResponse.json({routerId,schemaReady:false,
  sources:kinds.map(kind=>({kind,state:'migration_required'}))},{headers});
 const byKind=new Map((sources||[]).map(s=>[s.observed_kind,s]));
 const now=Date.now();
 const states=kinds.map(kind=>{
  const source=byKind.get(kind);
  if(!source)return {kind,state:router.agent_kind==='routeros-native'&&!nativeKinds.has(kind)
    ?'requires_local_connector':'not_collected'};
  const time=Date.parse(source.observed_at||'');
  const fresh=Number.isFinite(time)&&time<=now+30000&&now-time<180000;
  return {kind,state:!fresh?'stale':source.complete?'complete':'partial',
   reportedCount:source.reported_count,collectedCount:source.collected_count,
   observedAt:source.observed_at};
 });
 return NextResponse.json({routerId,schemaReady:true,agentKind:router.agent_kind,
  lastRouterContact:router.last_seen_at,sources:states},{headers});
}
