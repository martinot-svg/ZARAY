import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
import {hashRadiusPassword} from '@/lib/network-radius-crypto';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof b?.companyId==='string'?b.companyId:'';
 const accountId=typeof b?.accountId==='string'?b.accountId:'';
 const password=b?.password;
 if(!uuid.test(accountId)||typeof password!=='string'||password.length<12||password.length>128)
  return json({error:'Compte et mot de passe RADIUS de 12 à 128 caractères requis.'},400);
 const session=await createClient(),access=await authorizeTenant(session,companyId);
 if(!access.ok)return json({error:access.error},access.status);
 if(!['owner','admin'].includes(access.member.role))return json({error:'Droits administrateur requis.'},403);
 const service=createServiceClient();if(!service)return json({error:'Service indisponible.'},503);
 const {data:account,error:accountError}=await service.from('network_access_accounts')
  .select('id,router_id,company_id,username').eq('id',accountId).eq('company_id',companyId).maybeSingle();
 if(accountError)return json({error:'Compte réseau indisponible.'},503);
 if(!account)return json({error:'Compte réseau introuvable.'},404);
 const {data:router}=await service.from('network_routers').select('site_id').eq('id',account.router_id).eq('company_id',companyId).maybeSingle();
 if(!router)return json({error:'Routeur introuvable.'},409);
 const credential=await hashRadiusPassword(password);
 const {error}=await service.from('network_radius_credentials').upsert({
   account_id:account.id,router_id:account.router_id,company_id:companyId,...credential,rotated_at:new Date().toISOString()
 },{onConflict:'account_id'});
 if(error)return json({error:'Enregistrement du secret RADIUS impossible.'},503);
 await service.from('network_access_events').insert({company_id:companyId,account_id:account.id,
  actor_user_id:access.user.id,event_type:'network.radius_password_rotated',reason:'Rotation du secret PAP RADIUS.'});
 return json({saved:true,message:'Mot de passe RADIUS enregistré sous forme dérivée, sans activation du serveur.'});
}
