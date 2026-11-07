import {NextRequest,NextResponse} from 'next/server';
import {createServiceClient} from '@/lib/supabase/service';
import {createFiveOnePayment,merchantForSite} from '@/lib/fiveonepay-server';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});
const hexRef=/^[0-9A-F]{12}$/;
const operators=new Set(['MVOLA','ORANGE_MONEY','AIRTEL_MONEY']);
type Order={id:string;public_reference:string;company_id:string;site_id:string|null;
 customer_email:string;status:string;paid_at:string|null;amount:number|string;currency:string};
async function hostCanPay(request:NextRequest,siteId:string){
 const host=request.nextUrl.hostname.toLowerCase();
 if(host==='zaray.vercel.app'||host==='localhost'||host==='127.0.0.1')return true;
 const service=createServiceClient();
 if(!service)return false;
 if(host==='mlayconnexion.vercel.app'){
  const {data}=await service.from('site_public_links').select('site_id')
   .eq('public_hostname',host).eq('site_id',siteId).maybeSingle();
  return !!data;
 }
 if(host.endsWith('.vercel.app'))return false;
 const {data:domain}=await service.from('site_custom_domains').select('site_id')
  .eq('hostname',host).eq('status','active').eq('site_id',siteId).maybeSingle();
 if(domain)return true;
 const alias=host.startsWith('compte.')?host.slice(7):host;
 const {data:local}=await service.from('site_public_links').select('site_id')
  .eq('alias',alias).eq('site_id',siteId).maybeSingle();
 return !!local;
}
export async function POST(request:NextRequest){
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const reference=typeof body?.reference==='string'?body.reference.trim().toUpperCase():'';
 const email=typeof body?.customerEmail==='string'?body.customerEmail.trim().toLowerCase():'';
 const operator=typeof body?.operator==='string'?body.operator.toUpperCase():'';
 if(!hexRef.test(reference)||!email||email.length>254||
   !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||(operator&&!operators.has(operator)))
  return json({error:'Référence, e-mail ou opérateur invalide.'},400);
 try{
  const service=createServiceClient();
  if(!service)return json({error:'Service indisponible.'},503);
  const {data:order,error:orderError}=await service.from('subscription_orders')
   .select('id,public_reference,company_id,site_id,customer_email,status,paid_at,amount,currency')
   .eq('public_reference',reference).maybeSingle();
  if(orderError||!order)return json({error:'Commande introuvable.'},404);
  const subscription=order as Order;
  if(subscription.customer_email.toLowerCase()!==email)
   return json({error:'Commande introuvable.'},404);
  if(!subscription.site_id||!await hostCanPay(request,subscription.site_id))
   return json({error:'Le paiement ne correspond pas à ce site.'},403);
  if(subscription.status!=='pending_payment'||subscription.paid_at)
   return json({error:'Cette commande n’accepte plus de paiement.'},409);
  const amount=Number(subscription.amount);
  if(subscription.currency!=='MGA'||!Number.isSafeInteger(amount)||amount<1)
   return json({error:'Le paiement doit être un montant entier en ariary.'},409);
  const {data:manual,error:manualError}=await service.from('manual_payment_submissions')
   .select('id').eq('order_id',subscription.id).in('status',['submitted','approved']).limit(1);
  if(manualError)return json({error:'Impossible de vérifier les paiements en cours.'},503);
  if(manual?.length)return json({error:'Un paiement manuel est déjà en cours de vérification.'},409);
  const merchant=await merchantForSite(subscription.company_id,subscription.site_id);
  if(!merchant)return json({error:'FiveOne Pay n’est pas encore configuré pour ce site.'},409);
  if(merchant.environment==='sandbox'&&process.env.ZARAY_FIVEONEPAY_SANDBOX_ENABLED!=='true')
   return json({error:'Paiement Sandbox désactivé.'},409);
  const {data:reserved,error:reserveError}=await service.rpc('reserve_fiveonepay_attempt',
   {p_order_id:subscription.id,p_merchant_id:merchant.id});
  if(reserveError){console.error('fiveonepay reserve failed',{code:reserveError.code});
   return json({error:'Impossible de préparer ce paiement.'},409);}
  const attemptId=String(reserved?.id||'');
  const {data:attempt,error:attemptError}=await service.from('fiveonepay_attempts')
   .select('id,merchant_id,internal_reference,status,payment_url,expires_at,amount')
   .eq('id',attemptId).eq('order_id',subscription.id).single();
  if(attemptError||!attempt||attempt.merchant_id!==merchant.id)
   return json({error:'Paiement indisponible.'},503);
  if(attempt.payment_url&&attempt.status==='pending'&&Date.parse(attempt.expires_at)>Date.now())
   return json({paymentUrl:attempt.payment_url,reference:attempt.internal_reference,
    environment:merchant.environment});
  const base='https://zaray.vercel.app';
  const resultPage=base+'/mon-internet/'+encodeURIComponent(subscription.site_id)
   +'/paiement/'+encodeURIComponent(subscription.public_reference);
  let created;
  try{
   created=await createFiveOnePayment(merchant,{
    amount,reference:attempt.internal_reference,attemptId:attempt.id,
    callbackUrl:base+'/api/fiveonepay/webhook/'+merchant.id,
    successUrl:resultPage,cancelUrl:resultPage,
    ...(operator?{operator}:{})
   });
  }catch(e){console.error('FiveOne Pay request unsuccessful',{message:e instanceof Error?e.message:'unknown'});
   return json({error:'FiveOne Pay est momentanément indisponible. Vous pouvez réessayer.'},503);}
  if(!((merchant.environment==='sandbox'&&created.environment==='SANDBOX')||
       (merchant.environment==='production'&&created.environment==='PRODUCTION')))
   return json({error:'Environnement du paiement incohérent.'},503);
  const {error:saveError}=await service.from('fiveonepay_attempts').update({
   provider_payment_id:created.id,fiveonepay_reference:created.fiveonepay_reference,
   payment_url:created.payment_url,status:'pending',
   commission:created.commission,net_amount:created.net_amount,
   payable_amount:created.payable_amount,operator:created.operator||operator||null,
   expires_at:created.expires_at,updated_at:new Date().toISOString()
  }).eq('id',attempt.id).eq('merchant_id',merchant.id).in('status',['prepared','pending']);
  if(saveError){console.error('FiveOne checkout persistence failed',{code:saveError.code});
   return json({error:'Le paiement est préparé mais son lien n’est pas encore disponible. Réessayez.'},503);}
  return json({paymentUrl:created.payment_url,reference:attempt.internal_reference,
   environment:merchant.environment},201);
 }catch{return json({error:'Paiement temporairement indisponible.'},503);}
}
