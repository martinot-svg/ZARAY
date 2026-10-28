import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const roles=['owner','admin'];
const uuid=/^[0-9a-f-]{36}$/i;
async function context(companyId:string){
 const session=await createClient(),access=await authorizeTenant(session,companyId);
 if(!access.ok)return {error:json({error:access.error},access.status)};
 const service=createServiceClient();
 if(!service)return {error:json({error:'Configuration du service indisponible.'},503)};
 return {access,service};
}
export async function GET(req:NextRequest){
 const companyId=req.nextUrl.searchParams.get('companyId')||'';
 const c=await context(companyId);if(c.error)return c.error;
 const [accounts,orders,policies,commands]=await Promise.all([
  c.service!.from('network_access_accounts').select('id,router_id,order_id,username,protocol,expires_at,grace_until,extension_until,administrative_hold,desired_state,applied_state').eq('company_id',companyId).order('created_at',{ascending:false}).limit(300),
  c.service!.from('subscription_orders').select('id,site_id,public_reference,customer_name,status,validity_days,paid_at').eq('company_id',companyId).order('created_at',{ascending:false}).limit(200),
  c.service!.from('network_company_policies').select('company_id,grace_hours,extension_max_hours').eq('company_id',companyId).maybeSingle(),
  c.service!.from('network_commands').select('id,router_id,action,username,status,outcome,created_at').eq('company_id',companyId).order('created_at',{ascending:false}).limit(50)
 ]);
 if(accounts.error||orders.error||policies.error||commands.error)return json({error:'Informations réseau indisponibles.'},503);
 return json({accounts:accounts.data||[],orders:orders.data||[],policy:policies.data||{grace_hours:72,extension_max_hours:24},commands:commands.data||[]});
}
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof b?.companyId==='string'?b.companyId:'';
 const routerId=typeof b?.routerId==='string'?b.routerId:'';
 const orderId=typeof b?.orderId==='string'?b.orderId:'';
 const username=typeof b?.username==='string'?b.username.trim():'';
 const protocol=b?.protocol;
 if(!uuid.test(routerId)||!uuid.test(orderId)||!username||username.length>128||!['hotspot','pppoe'].includes(String(protocol)))return json({error:'Routeur, commande et compte réseau requis.'},400);
 const c=await context(companyId);if(c.error)return c.error;
 if(!roles.includes(c.access!.member.role))return json({error:'Accès réservé aux responsables.'},403);
 const [{data:router},{data:order},{data:policy}]=await Promise.all([
  c.service!.from('network_routers').select('id,company_id,site_id,control_enabled').eq('id',routerId).eq('company_id',companyId).maybeSingle(),
  c.service!.from('subscription_orders').select('id,site_id,company_id,status,paid_at,validity_days').eq('id',orderId).eq('company_id',companyId).maybeSingle(),
  c.service!.from('network_company_policies').select('grace_hours').eq('company_id',companyId).maybeSingle()
 ]);
 if(!router||!order||router.site_id!==order.site_id)return json({error:'Le routeur et la commande doivent appartenir au même site.'},409);
 let expiry:string|null=null,grace:string|null=null;
 if(order.status==='paid'&&order.paid_at){
  const until=new Date(Math.max(Date.now(),new Date(order.paid_at).getTime())+Math.max(1,Number(order.validity_days))*86400000);
  expiry=until.toISOString();grace=new Date(until.getTime()+(policy?.grace_hours??72)*3600000).toISOString();
 }
 const {data:account,error}=await c.service!.from('network_access_accounts').insert({
  company_id:companyId,router_id:routerId,order_id:orderId,username,protocol,
  expires_at:expiry,grace_until:grace,desired_state:expiry?'active':'suspended'
 }).select('id,router_id,username,protocol,desired_state').single();
 if(error)return json({error:error.code==='23505'?'Ce compte réseau ou cette commande est déjà lié.':'Association impossible.'},error.code==='23505'?409:503);
 if(router.control_enabled&&expiry){
  await c.service!.from('network_commands').insert({company_id:companyId,router_id:routerId,account_id:account.id,action:'resume_account',protocol,username,created_by:c.access!.user.id,reason:'Association à une commande payée'});
 }
 await c.service!.from('network_access_events').insert({company_id:companyId,account_id:account.id,actor_user_id:c.access!.user.id,event_type:'network.account_bound',reason:'Association à la commande '+orderId});
 return json({account,message:'Compte associé. La synchronisation sera confirmée par le connecteur.'},201);
}
export async function PATCH(req:NextRequest){
 const b=await req.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof b?.companyId==='string'?b.companyId:'';
 const kind=b?.kind,reason=typeof b?.reason==='string'?b.reason.trim().slice(0,600):'';
 const c=await context(companyId);if(c.error)return c.error;
 if(!roles.includes(c.access!.member.role))return json({error:'Responsable autorisé requis.'},403);
 if(kind==='policy'){
  if(c.access!.member.role!=='owner')return json({error:'Réservé au dirigeant.'},403);
  const grace=Number(b?.graceHours),max=Number(b?.extensionMaxHours);
  if(!Number.isInteger(grace)||grace<0||grace>2160||!Number.isInteger(max)||max<1||max>87600)return json({error:'Limites invalides.'},400);
  const {error}=await c.service!.from('network_company_policies').upsert({company_id:companyId,grace_hours:grace,extension_max_hours:max,updated_at:new Date().toISOString()});
  return error?json({error:'Enregistrement impossible.'},503):json({saved:true,appliesTo:'future renewals'});
 }
 if(kind==='control'){
  if(c.access!.member.role!=='owner')return json({error:'Activation réservée au dirigeant.'},403);
  const routerId=typeof b?.routerId==='string'?b.routerId:'';
  const enabled=b?.enabled===true;
  const {data:router}=await c.service!.from('network_routers').select('id,last_seen_at').eq('id',routerId).eq('company_id',companyId).maybeSingle();
  if(!router)return json({error:'Routeur introuvable.'},404);
  if(enabled){
   const {data:creds}=await c.service!.from('network_connector_credentials').select('paired_at,revoked_at').eq('router_id',routerId).maybeSingle();
   if(!creds?.paired_at||creds.revoked_at||!router.last_seen_at||Date.now()-new Date(router.last_seen_at).getTime()>5*60000)return json({error:'Connecteur non associé ou découverte trop ancienne.'},409);
  }
  const {error}=await c.service!.from('network_routers').update({control_enabled:enabled}).eq('id',routerId).eq('company_id',companyId);
  if(error)return json({error:'Mise à jour impossible.'},503);
  if(enabled){
   const {data:accounts}=await c.service!.from('network_access_accounts').select('id,protocol,username,desired_state,applied_state').eq('router_id',routerId).eq('company_id',companyId);
   for(const account of accounts||[])if(account.desired_state!==account.applied_state){
    await c.service!.from('network_commands').insert({company_id:companyId,router_id:routerId,account_id:account.id,protocol:account.protocol,username:account.username,
     action:account.desired_state==='active'?'resume_account':'suspend_account',created_by:c.access!.user.id,reason:'Activation du contrôle réseau'});
   }
  }
  return json({controlEnabled:enabled});
 }
 const accountId=typeof b?.accountId==='string'?b.accountId:'';
 if(!uuid.test(accountId)||!reason)return json({error:'Compte et motif obligatoires.'},400);
 const {data:a}=await c.service!.from('network_access_accounts').select('*').eq('id',accountId).eq('company_id',companyId).maybeSingle();
 if(!a)return json({error:'Compte introuvable.'},404);
 let changes:Record<string,unknown>={},event='';
 if(kind==='hold'){if(typeof b?.blocked!=='boolean')return json({error:'État invalide.'},400);changes={administrative_hold:b.blocked};event=b.blocked?'network.account_held':'network.hold_released';}
 else if(kind==='extend'){
  const hours=Number(b?.hours);
  const {data:policy}=await c.service!.from('network_company_policies').select('extension_max_hours').eq('company_id',companyId).maybeSingle();
  if(!Number.isInteger(hours)||hours<1||hours>(policy?.extension_max_hours??24))return json({error:'Durée supérieure à la limite de l’entreprise.'},400);
  if(!a.order_id)return json({error:'Aucune commande associée.'},409);
  const {data:submissions}=await c.service!.from('manual_payment_submissions').select('id').eq('order_id',a.order_id).eq('company_id',companyId).eq('status','pending').limit(1);
  if(!submissions?.length)return json({error:'Aucun justificatif en attente de validation.'},409);
  changes={extension_until:new Date(Date.now()+hours*3600000).toISOString()};event='network.exception_granted';
 }else return json({error:'Action inconnue.'},400);
 const after={...a,...changes};
 const active=!after.administrative_hold&&!!after.expires_at&&Date.now()<=Math.max(new Date(after.expires_at).getTime(),after.grace_until?new Date(after.grace_until).getTime():0,after.extension_until?new Date(after.extension_until).getTime():0);
 changes.desired_state=active?'active':'suspended';
 const {error}=await c.service!.from('network_access_accounts').update(changes).eq('id',accountId).eq('company_id',companyId);
 if(error)return json({error:'Modification impossible.'},503);
 await c.service!.from('network_commands').update({status:'cancelled',completed_at:new Date().toISOString(),outcome:'Règle mise à jour'})
  .eq('account_id',accountId).eq('status','queued');
 const {data:router}=await c.service!.from('network_routers').select('control_enabled').eq('id',a.router_id).maybeSingle();
 if(router?.control_enabled&&a.applied_state!==(active?'active':'suspended')){
  await c.service!.from('network_commands').insert({company_id:companyId,router_id:a.router_id,account_id:accountId,
   action:active?'resume_account':'suspend_account',protocol:a.protocol,username:a.username,created_by:c.access!.user.id,reason});
 }
 await c.service!.from('network_access_events').insert({company_id:companyId,account_id:accountId,actor_user_id:c.access!.user.id,event_type:event,reason});
 return json({desiredState:changes.desired_state,message:'Décision enregistrée, application réseau à confirmer.'});
}
