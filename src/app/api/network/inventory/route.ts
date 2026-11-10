import {NextRequest,NextResponse} from 'next/server';
import {inventorySourceIsCurrent} from '@/lib/network-inventory-freshness';
import {createClient} from '@/lib/supabase/server';
import {authorizeTenant} from '@/lib/tenant-context';
export const dynamic='force-dynamic';
const kinds=['hotspot','pppoe','dhcp','wifi','neighbor','radius','interface',
 'hotspot-user','hotspot-profile','ppp-secret','ppp-profile','ip-address',
 'ip-pool','dhcp-server','dhcp-client','vlan','arp','queue','firewall-filter','firewall-nat','route','bridge','bridge-port','dhcp-network','dns-static','firewall-address-list','queue-tree','wireguard-interface','wireguard-peer','routing-rule','ipv6-address'] as const;
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const headers={'Cache-Control':'no-store'};
const err=(error:string,status:number)=>NextResponse.json({error},{status,headers});
export async function GET(req:NextRequest){
 const params=req.nextUrl.searchParams,companyId=params.get('companyId')||'',
  routerId=params.get('routerId')||'',kind=params.get('kind')||'interface';
 const rawPage=params.get('page')||'1',page=/^[1-9][0-9]{0,4}$/.test(rawPage)?Number(rawPage):0;
 if(!uuid.test(routerId)||!kinds.includes(kind as typeof kinds[number])||page<1||page>10000)
  return err('Paramètres de l’inventaire invalides.',400);
 const client=await createClient();
 const auth=await authorizeTenant(client,companyId);
 if(!auth.ok)return err(auth.error,auth.status);
 const {data:router,error:routerError}=await client.from('network_routers')
  .select('id,site_id,company_id,agent_kind,last_seen_at,control_enabled')
  .eq('id',routerId).eq('company_id',companyId).maybeSingle();
 if(routerError||!router)return err('Routeur inaccessible dans cette entreprise.',404);
 const size=50,offset=(page-1)*size;
 const {data:rows,error:observationsError,count}=await client.from('network_observations')
  .select('id,router_id,observed_kind,identity_key,ip_address,mac_address,client_label,active,observed_at',{count:'exact'})
  .eq('router_id',routerId).eq('company_id',companyId).eq('observed_kind',kind)
  .order('observed_at',{ascending:false}).range(offset,offset+size-1);
 if(observationsError)return err('Lecture de l’inventaire impossible.',503);
 const {data:source,error:sourceError}=await client.from('network_inventory_sources')
  .select('reported_count,collected_count,complete,observed_at')
  .eq('router_id',routerId).eq('company_id',companyId).eq('observed_kind',kind).maybeSingle();
 // During a preview, the additive migration may not yet have been applied.
 const inventorySchemaReady=!sourceError;
 const latest=source?.observed_at||null;
 const recentlyReported=inventorySourceIsCurrent(kind,latest);
 const nativeSupported=['interface','hotspot','pppoe'].includes(kind);
 return NextResponse.json({
  routerId,kind,items:rows??[],page,pageSize:size,total:count??0,
  source:inventorySchemaReady?source:null,
  schemaReady:inventorySchemaReady,
  sourceState:!inventorySchemaReady?'migration_required':
   !source?(router.agent_kind==='routeros-native'&&!nativeSupported?'requires_local_connector':'not_collected'):
   !recentlyReported?'stale':source.complete?'complete':'partial',
  lastRouterContact:router.last_seen_at,agentKind:router.agent_kind,
  controlEnabled:router.control_enabled
 },{headers});
}
