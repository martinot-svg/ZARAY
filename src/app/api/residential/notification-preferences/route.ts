import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {publicResidentialSite} from '@/lib/residential-site-identity';
import {customerEmailDeliveryReady} from '@/lib/customer-notification-email';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function verifiedResident(siteId:string){
 if(!uuid.test(siteId))return {response:json({error:'Site invalide.'},400)};
 const session=await createClient();
 const {data:{user},error}=await session.auth.getUser();
 if(error||!user?.email||!user.email_confirmed_at)
  return {response:json({error:'Authentification requise.'},401)};
 const identity=await publicResidentialSite(siteId);
 if(!identity)return {response:json({error:'Site indisponible.'},404)};
 const service=createServiceClient();
 if(!service)return {response:json({error:'Service indisponible.'},503)};
 const {data:site,error:siteError}=await service.from('sites').select('company_id').eq('id',siteId).maybeSingle();
 if(siteError||!site)return {response:json({error:'Site indisponible.'},404)};
 const {data:customer,error:customerError}=await service.from('customers')
  .select('id').eq('company_id',site.company_id).eq('site_id',siteId)
  .eq('email',user.email.trim().toLowerCase()).eq('status','active').maybeSingle();
 if(customerError)return {response:json({error:'Préférences indisponibles.'},503)};
 if(!customer)return {response:json({error:'Compte résidentiel non autorisé.'},403)};
 return {service,customerId:customer.id,companyId:site.company_id};
}

async function readiness(service:NonNullable<ReturnType<typeof createServiceClient>>,companyId:string,siteId:string){
 const {data,error}=await service.from('site_custom_domains').select('hostname,verified_at,status')
  .eq('company_id',companyId).eq('site_id',siteId).maybeSingle();
 if(error)throw Error('Domaine indisponible');
 return customerEmailDeliveryReady()&&!!data&&data.status==='active'&&!!data.verified_at;
}

export async function GET(request:NextRequest){
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 try{
  const ctx=await verifiedResident(siteId);
  if(ctx.response)return ctx.response;
  const {data,error}=await ctx.service!.from('residential_notification_preferences')
   .select('email_enabled').eq('company_id',ctx.companyId!).eq('site_id',siteId)
   .eq('customer_id',ctx.customerId!).maybeSingle();
  if(error)return json({error:'Préférences indisponibles.'},503);
  return json({emailEnabled:data?.email_enabled===true,
   emailAvailable:await readiness(ctx.service!,ctx.companyId!,siteId)});
 }catch{return json({error:'Préférences indisponibles.'},503);}
}
export async function PUT(request:NextRequest){
 if(request.headers.get('origin')!==request.nextUrl.origin)
  return json({error:'Origine non autorisée.'},403);
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 const emailEnabled=body?.emailEnabled;
 if(typeof emailEnabled!=='boolean')return json({error:'Choix invalide.'},400);
 try{
  const ctx=await verifiedResident(siteId);
  if(ctx.response)return ctx.response;
  if(emailEnabled&&!(await readiness(ctx.service!,ctx.companyId!,siteId)))
   return json({error:'Les notifications par e-mail ne sont pas encore activées pour ce fournisseur.'},409);
  const {data,error}=await ctx.service!.from('residential_notification_preferences').upsert({
   company_id:ctx.companyId!,site_id:siteId,customer_id:ctx.customerId!,
   email_enabled:emailEnabled
  },{onConflict:'company_id,site_id,customer_id'}).select('email_enabled').single();
  if(error)return json({error:'Enregistrement des préférences impossible.'},503);
  return json({emailEnabled:data.email_enabled===true});
 }catch{return json({error:'Enregistrement des préférences impossible.'},503);}
}
