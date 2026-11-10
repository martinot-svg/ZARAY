import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {authorizeTenant} from '@/lib/tenant-context';
import {networkWritesBlockedInPreview} from '@/lib/network-preview-guard';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const error=(message:string,status:number)=>NextResponse.json({error:message},{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const kinds=new Set(['interface','vlan','bridge','bridge-port','ip-address','ipv6-address',
 'dhcp','dhcp-server','dhcp-client','dhcp-network','ip-pool','arp','dns-static',
 'hotspot','hotspot-user','hotspot-profile','pppoe','ppp-secret','ppp-profile',
 'wifi','neighbor','radius','queue','queue-tree','firewall-filter','firewall-nat',
 'firewall-address-list','route','routing-rule','wireguard-interface','wireguard-peer']);

/** Request a read-only refresh. Only the local connector can execute it.
 * This endpoint never opens a RouterOS connection or runs in a worker.
 */
export async function POST(req:NextRequest){
 if(networkWritesBlockedInPreview())
  return error('Prévisualisation réseau en lecture seule : laboratoire isolé requis.',403);
 const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=body?.companyId,routerId=body?.routerId,kind=body?.kind;
 if(typeof companyId!=='string'||!uuid.test(companyId)||
    typeof routerId!=='string'||!uuid.test(routerId)||
    typeof kind!=='string'||!kinds.has(kind))
  return error('Source, routeur ou entreprise invalides.',400);
 const client=await createClient();
 const auth=await authorizeTenant(client,companyId);
 if(!auth.ok)return error(auth.error,auth.status);
 if(!['owner','admin'].includes(auth.member.role))
  return error('Droits administrateur requis pour actualiser depuis RouterOS.',403);
 const {data:router,error:routerError}=await client.from('network_routers')
  .select('id,agent_kind,last_seen_at').eq('id',routerId)
  .eq('company_id',companyId).maybeSingle();
 if(routerError||!router)return error('Routeur inaccessible dans cette entreprise.',404);
 if(router.agent_kind!=='node-local')
  return error('Actualisation manuelle disponible uniquement avec le connecteur local.',409);
 const last=Date.parse(router.last_seen_at||'');
 if(!Number.isFinite(last)||last>Date.now()||Date.now()-last>=150000)
  return error('Connecteur hors ligne ou données de connexion trop anciennes.',409);
 // The SQL function checks tenant+admin again, locks this router, limits to one
 // request per router per minute and grants no direct browser write privilege.
 const {data:queued,error:queueError}=await client.rpc('request_network_inventory_refresh',{
  p_company_id:companyId,p_router_id:routerId,p_kind:kind
 });
 if(queueError)return error('File de rafraîchissement indisponible : migration requise.',503);
 if(queued!==true)return error('Actualisation déjà demandée récemment ou non autorisée.',429);
 return NextResponse.json({queued:true,kind,routerId,
  message:'Nouvelle collecte RouterOS demandée. Les données seront disponibles après le prochain passage du connecteur.'},
  {status:202,headers});
}
