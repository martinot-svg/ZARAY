import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
import {newRadiusToken,radiusTokenHash} from '@/lib/network-radius-crypto';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function ctx(companyId:string,routerId:string){
 if(!uuid.test(routerId))return {error:json({error:'Routeur invalide.'},400)};
 const session=await createClient(),a=await authorizeTenant(session,companyId);
 if(!a.ok)return {error:json({error:a.error},a.status)};
 const service=createServiceClient();if(!service)return {error:json({error:'Service indisponible.'},503)};
 const {data:router,error}=await service.from('network_routers').select('id,site_id').eq('id',routerId).eq('company_id',companyId).maybeSingle();
 if(error)return {error:json({error:'Inventaire indisponible.'},503)};
 if(!router)return {error:json({error:'Routeur introuvable.'},404)};
 return {a,service,router};
}
export async function GET(req:NextRequest){
 const companyId=req.nextUrl.searchParams.get('companyId')||'',routerId=req.nextUrl.searchParams.get('routerId')||'';
 const c=await ctx(companyId,routerId);if(c.error)return c.error;
 const {data,error}=await c.service!.from('network_radius_gateways').select('enabled,created_at,updated_at,last_auth_at')
  .eq('router_id',routerId).eq('company_id',companyId).maybeSingle();
 if(error)return json({error:'État RADIUS indisponible.'},503);
 return json({configured:!!data,enabled:data?.enabled===true,lastAuthAt:data?.last_auth_at||null,
  message:'La création d’une passerelle ne démarre pas de serveur RADIUS et n’active aucun accès.'});
}
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof b?.companyId==='string'?b.companyId:'',routerId=typeof b?.routerId==='string'?b.routerId:'';
 const c=await ctx(companyId,routerId);if(c.error)return c.error;
 if(c.a!.member.role!=='owner')return json({error:'Seul le dirigeant peut préparer ou renouveler une passerelle RADIUS.'},403);
 const token=newRadiusToken();
 const {error}=await c.service!.from('network_radius_gateways').upsert({
  router_id:routerId,company_id:companyId,secret_hash:radiusTokenHash(token),
  enabled:false,updated_at:new Date().toISOString(),last_auth_at:null
 },{onConflict:'router_id'});
 if(error)return json({error:'Préparation RADIUS impossible.'},503);
 await c.service!.from('network_access_events').insert({
  company_id:companyId,actor_user_id:c.a!.user.id,event_type:'network.radius_gateway_rotated',
  reason:'Nouvelle clé RADIUS créée, passerelle désactivée par défaut.'
 });
 return json({routerId,gatewayToken:token,enabled:false,
  message:'Clé affichée une seule fois. Passerelle désactivée : aucune authentification RADIUS active.'},201);
}
