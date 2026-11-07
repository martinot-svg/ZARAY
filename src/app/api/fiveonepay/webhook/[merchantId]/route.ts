import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createServiceClient} from '@/lib/supabase/service';
import {decryptFiveOne,type FiveOneMerchant} from '@/lib/fiveonepay-server';

export const dynamic='force-dynamic';
export const runtime='nodejs';
type Context={params:Promise<{merchantId:string}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
type Event={id:string;event:string;data:{id:string;status:string;amount:number;
 currency:string;reference:string;fiveonepay_reference:string;commission?:number;
 net_amount?:number;payable_amount?:number}};
function validEvent(obj:unknown):obj is Event{
 if(!obj||typeof obj!=='object')return false;
 const v=obj as Record<string,unknown>,d=v.data as Record<string,unknown>|null;
 return typeof v.id==='string'&&v.id.length>2&&v.id.length<=200&&
  ['payment.success','payment.expired'].includes(String(v.event))&&
  !!d&&typeof d.id==='string'&&d.id.length>2&&d.id.length<=200&&
  typeof d.reference==='string'&&/^ABWIFI-[A-Z0-9]{3,6}-\d{6,}$/.test(d.reference)&&
  typeof d.amount==='number'&&Number.isSafeInteger(d.amount)&&d.amount>0&&
  d.currency==='MGA'&&typeof d.fiveonepay_reference==='string'&&
  /^\d{8}$/.test(d.fiveonepay_reference)&&
  ((v.event==='payment.success'&&d.status==='SUCCESS')||
   (v.event==='payment.expired'&&d.status==='EXPIRED'));
}
export async function POST(request:NextRequest,{params}:Context){
 const {merchantId}=await params;
 if(!uuid.test(merchantId))return reply({error:'Marchand invalide.'},404);
 const raw=await request.text();
 if(raw.length>32000)return reply({error:'Événement trop volumineux.'},413);
 const signature=request.headers.get('x-fiveone-signature')||'';
 if(!/^[a-f0-9]{64}$/i.test(signature))return reply({error:'Signature invalide.'},401);
 try{
  const service=createServiceClient();
  if(!service)return reply({error:'Service indisponible.'},503);
  const {data:merchant,error:merchantError}=await service.from('fiveonepay_merchants')
   .select('*').eq('id',merchantId).maybeSingle();
  if(merchantError||!merchant)return reply({error:'Marchand introuvable.'},404);
  const verified=merchant as FiveOneMerchant;
  const secret=decryptFiveOne(verified.webhook_secret_ciphertext);
  const expected=createHmac('sha256',secret).update(raw,'utf8').digest();
  const received=Buffer.from(signature,'hex');
  if(expected.length!==received.length||!timingSafeEqual(expected,received))
   return reply({error:'Signature invalide.'},401);
  let parsed:unknown;
  try{parsed=JSON.parse(raw);}catch{return reply({error:'JSON invalide.'},400);}
  if(!validEvent(parsed))return reply({error:'Événement incorrect.'},400);
  const event=parsed as Event;
  const {data:attempt,error:attemptError}=await service.from('fiveonepay_attempts')
   .select('id,company_id,order_id,site_id,merchant_id,environment,amount,status,provider_payment_id,fiveonepay_reference')
   .eq('merchant_id',merchantId).eq('internal_reference',event.data.reference).maybeSingle();
  if(attemptError||!attempt)return reply({error:'Paiement inconnu.'},404);
  if(attempt.company_id!==merchant.company_id||
     (merchant.site_id&&attempt.site_id!==merchant.site_id)||
     attempt.environment!==merchant.environment||Number(attempt.amount)!==event.data.amount||
     (attempt.provider_payment_id&&attempt.provider_payment_id!==event.data.id)||
     (attempt.fiveonepay_reference&&attempt.fiveonepay_reference!==event.data.fiveonepay_reference))
   return reply({error:'Paiement incohérent.'},409);
  const hash=createHash('sha256').update(raw,'utf8').digest('hex');
  if(event.event==='payment.expired'){
   // Expiry never cancels a confirmed order: late Mobile Money confirmations
   // may generate SUCCESS after EXPIRED, as FiveOne Pay documents.
   if(attempt.status!=='succeeded'&&attempt.status!=='review_required'){
    const {error:updateError}=await service.from('fiveonepay_attempts').update({
     status:'expired',updated_at:new Date().toISOString()
    }).eq('id',attempt.id).in('status',['pending','prepared','expired']);
    if(updateError)return reply({error:'Enregistrement impossible.'},503);
   }
   const {error:eventError}=await service.from('fiveonepay_webhook_events').upsert({
    merchant_id:merchantId,attempt_id:attempt.id,provider_event_id:event.id,
    event_type:event.event,payload_hash:hash
   },{onConflict:'merchant_id,provider_event_id',ignoreDuplicates:true});
   if(eventError)return reply({error:'Journal indisponible.'},503);
   return reply({accepted:true});
  }
  // SANDBOX never updates subscription_orders or payments; fake money must
  // never activate a real MikroTik subscription or appear in revenue KPIs.
  if(verified.environment==='sandbox'){
   const {error:updateError}=await service.from('fiveonepay_attempts').update({
    status:'succeeded',provider_payment_id:event.data.id,
    fiveonepay_reference:event.data.fiveonepay_reference,updated_at:new Date().toISOString()
   }).eq('id',attempt.id);
   if(updateError)return reply({error:'Sandbox indisponible.'},503);
   const {error:eventError}=await service.from('fiveonepay_webhook_events').upsert({
    merchant_id:merchantId,attempt_id:attempt.id,provider_event_id:event.id,
    event_type:event.event,payload_hash:hash
   },{onConflict:'merchant_id,provider_event_id',ignoreDuplicates:true});
   if(eventError)return reply({error:'Journal Sandbox indisponible.'},503);
   return reply({accepted:true,sandbox:true});
  }
  const {data:order,error:orderError}=await service.from('subscription_orders')
   .select('id,public_reference,company_id,site_id,amount,currency')
   .eq('id',attempt.order_id).eq('company_id',attempt.company_id).single();
  if(orderError||!order||order.site_id!==attempt.site_id||
     Number(order.amount)!==event.data.amount||order.currency!=='MGA')
   return reply({error:'Commande incohérente.'},409);
  const {data:ledger,error:ledgerError}=await service.rpc('process_payment_webhook',{
   p_provider:'fiveonepay',
   p_provider_payment_id:event.data.id,
   p_event_id:event.id,
   p_order_reference:order.public_reference,
   p_amount:event.data.amount,
   p_currency:'MGA',
   p_event_status:'success',
   p_payload_hash:hash
  });
  if(ledgerError){console.error('fiveonepay ledger reconciliation failed',{code:ledgerError.code});
   return reply({error:'Rapprochement en attente.'},503);}
  const paymentStatus=String(ledger?.payment_status||'');
  const {error:updateError}=await service.from('fiveonepay_attempts').update({
   status:paymentStatus==='review_required'?'review_required':'succeeded',
   provider_payment_id:event.data.id,
   fiveonepay_reference:event.data.fiveonepay_reference,
   updated_at:new Date().toISOString()
  }).eq('id',attempt.id);
  if(updateError){console.error('fiveonepay attempt update failed',{code:updateError.code});
   return reply({error:'Suivi temporairement indisponible.'},503);}
  return reply({accepted:true,reviewRequired:paymentStatus==='review_required'});
 }catch(e){console.error('fiveonepay webhook unavailable',{reason:e instanceof Error?e.message:'unknown'});
  return reply({error:'Traitement indisponible.'},503);}
}
