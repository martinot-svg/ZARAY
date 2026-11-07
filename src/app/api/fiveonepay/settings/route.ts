import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
import {encryptionReady,encryptFiveOne,validFiveOneKey,validWebhookSecret} from '@/lib/fiveonepay-server';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,
 headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const environments=['sandbox','production'] as const;
async function admin(companyId:string,siteId?:string){
 if(!uuid.test(companyId)||(siteId&&!uuid.test(siteId)))return {error:reply({error:'Identifiants invalides.'},400)};
 const session=await createClient();
 const access=await authorizeTenant(session,companyId,siteId||null);
 if(!access.ok)return {error:reply({error:access.error},access.status)};
 if(!['owner','admin'].includes(access.member.role))
  return {error:reply({error:'Configuration réservée au dirigeant et aux administrateurs.'},403)};
 const service=createServiceClient();
 if(!service)return {error:reply({error:'Service indisponible.'},503)};
 return {service};
}
export async function GET(request:NextRequest){
 const companyId=request.nextUrl.searchParams.get('companyId')||'';
 const siteId=request.nextUrl.searchParams.get('siteId')||undefined;
 try{
  const a=await admin(companyId,siteId);
  if(a.error)return a.error;
  const [merchants,routing]=await Promise.all([
   a.service!.from('fiveonepay_merchants')
    .select('id,label,site_id,environment,enabled,updated_at')
    .eq('company_id',companyId).order('created_at',{ascending:true}),
   a.service!.from('fiveonepay_site_routing')
    .select('site_id,mode').eq('company_id',companyId)
  ]);
  if(merchants.error||routing.error)return reply({error:'Paramètres indisponibles.'},503);
  return reply({merchants:merchants.data||[],routing:routing.data||[],
   encryptionReady:encryptionReady(),sandboxEnabled:process.env.ZARAY_FIVEONEPAY_SANDBOX_ENABLED==='true'});
 }catch{return reply({error:'Paramètres indisponibles.'},503);}
}
export async function PUT(request:NextRequest){
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof body?.companyId==='string'?body.companyId:'';
 const scope=body?.scope==='site'?'site':body?.scope==='company'?'company':'';
 const siteId=scope==='site'&&typeof body?.siteId==='string'?body.siteId:undefined;
 const environment=body?.environment;
 const apiKey=typeof body?.apiKey==='string'?body.apiKey.trim():'';
 const webhookSecret=typeof body?.webhookSecret==='string'?body.webhookSecret.trim():'';
 const label=typeof body?.label==='string'?body.label.trim():'Compte FiveOne Pay';
 const enabled=body?.enabled===true;
 if(!scope||(scope==='site'&&!siteId)||!environments.includes(environment as typeof environments[number])
    ||label.length<2||label.length>80||(apiKey&&!validFiveOneKey(apiKey,environment as 'sandbox'|'production'))
    ||(webhookSecret&&!validWebhookSecret(webhookSecret))||(enabled&&environment==='production'&&body?.kycConfirmed!==true))
  return reply({error:'Vérifiez le compte, les clés, l’environnement et la validation KYC de production.'},400);
 if(!encryptionReady())return reply({error:'Chiffrement des clés indisponible côté serveur.'},503);
 try{
  const a=await admin(companyId,siteId);
  if(a.error)return a.error;
  const service=a.service!;
  const existingQuery=service.from('fiveonepay_merchants')
   .select('id,api_key_ciphertext,webhook_secret_ciphertext').eq('company_id',companyId)
   .eq('environment',environment);
  const {data:existing,error:existingError}=await (
   siteId?existingQuery.eq('site_id',siteId):existingQuery.is('site_id',null)
  ).maybeSingle();
  if(existingError)return reply({error:'Compte marchand indisponible.'},503);
  if(!existing&&(!apiKey||!webhookSecret))
   return reply({error:'Les deux secrets sont obligatoires pour créer un compte marchand.'},400);
  const payload={
   company_id:companyId,site_id:siteId||null,environment,label,enabled,
   api_key_ciphertext:apiKey?encryptFiveOne(apiKey):existing!.api_key_ciphertext,
   webhook_secret_ciphertext:webhookSecret?encryptFiveOne(webhookSecret):existing!.webhook_secret_ciphertext,
   updated_at:new Date().toISOString()
  };
  const query=existing
   ?service.from('fiveonepay_merchants').update(payload).eq('id',existing.id)
   :service.from('fiveonepay_merchants').insert(payload);
  const {data,error}=await query.select('id,label,site_id,environment,enabled').single();
  if(error){console.error('fiveonepay merchant config failed',{code:error.code});
   return reply({error:'Enregistrement du compte marchand impossible.'},503);}
  return reply({merchant:data,message:'Compte enregistré. Les clés secrètes ne sont pas consultables.'});
 }catch{return reply({error:'Enregistrement indisponible.'},503);}
}
export async function PATCH(request:NextRequest){
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof body?.companyId==='string'?body.companyId:'';
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 const mode=body?.mode;
 if(!uuid.test(siteId)||!['shared','dedicated'].includes(String(mode)))
  return reply({error:'Choisissez un site et le mode centralisé ou indépendant.'},400);
 try{
  const a=await admin(companyId,siteId);
  if(a.error)return a.error;
  const {data,error}=await a.service!.from('fiveonepay_site_routing')
   .upsert({company_id:companyId,site_id:siteId,mode,updated_at:new Date().toISOString()},
    {onConflict:'site_id'}).select('site_id,mode').single();
  if(error)return reply({error:'Routage du site impossible.'},503);
  return reply({routing:data});
 }catch{return reply({error:'Routage indisponible.'},503);}
}
