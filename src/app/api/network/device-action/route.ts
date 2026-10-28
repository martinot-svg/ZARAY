import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof body?.companyId==='string'?body.companyId:'';
 const routerId=typeof body?.routerId==='string'?body.routerId:'';
 const mac=typeof body?.mac==='string'?body.mac.toLowerCase():'';
 const action=body?.action;
 const reason=typeof body?.reason==='string'?body.reason.trim():'';
 const respond=(error:string,status:number)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
 if(!/^[a-f0-9-]{36}$/i.test(routerId)||!/^([a-f0-9]{2}:){5}[a-f0-9]{2}$/i.test(mac)||!['block','unblock'].includes(String(action))||reason.length<3||reason.length>600)return respond('Paramètres invalides.',400);
 const client=await createClient(),auth=await authorizeTenant(client,companyId);
 if(!auth.ok)return respond(auth.error,auth.status);
 if(!['owner','admin'].includes(auth.member.role))return respond('Autorisation insuffisante.',403);
 const service=createServiceClient();if(!service)return respond('Service indisponible.',503);
 const {data:router}=await service.from('network_routers').select('id,control_enabled').eq('id',routerId).eq('company_id',companyId).maybeSingle();
 if(!router)return respond('Routeur inaccessible.',404);
 const {data:observations}=await service.from('network_observations').select('id').eq('company_id',companyId).eq('router_id',routerId).eq('observed_kind','hotspot').eq('mac_address',mac).limit(1);
 if(!observations?.length)return respond('Appareil non identifié sur le Hotspot sélectionné.',409);
 const {error}=await service.from('network_device_blocks').upsert({company_id:companyId,router_id:routerId,mac_address:mac,active:action==='block',applied_state:'unknown',reason,requested_by:auth.user.id,updated_at:new Date().toISOString()},{onConflict:'router_id,mac_address'});
 if(error)return respond('Blocage non enregistré.',503);
 if(router.control_enabled){
  const {error:queueError}=await service.from('network_commands').insert({company_id:companyId,router_id:routerId,action:action==='block'?'block_hotspot_mac':'unblock_hotspot_mac',protocol:'hotspot',username:'device:'+mac,mac_address:mac,reason,created_by:auth.user.id});
  if(queueError)return respond('Restriction enregistrée, mais commande non transmise.',503);
 }
 await service.from('network_access_events').insert({company_id:companyId,actor_user_id:auth.user.id,event_type:action==='block'?'network.device_block_requested':'network.device_unblock_requested',reason});
 return NextResponse.json({requested:true,applied:false,message:'Restriction demandée. Application à confirmer par MikroTik.'},{headers:{'Cache-Control':'no-store'}});
}
