import 'server-only';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {createServiceClient} from '@/lib/supabase/service';

export const FIVEONE_API='https://api.fiveonepay.com/v1';
const key=()=>{
 const raw=process.env.ZARAY_FIVEONEPAY_ENCRYPTION_KEY||'';
 if(!/^[0-9a-f]{64}$/i.test(raw))throw new Error('FiveOne Pay credential encryption unavailable');
 return Buffer.from(raw,'hex');
};
export function encryptionReady(){
 return /^[0-9a-f]{64}$/i.test(process.env.ZARAY_FIVEONEPAY_ENCRYPTION_KEY||'');
}
export function encryptFiveOne(secret:string){
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',key(),iv);
 const encrypted=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
 return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function decryptFiveOne(payload:string){
 const parts=payload.split('.');
 if(parts.length!==3)throw new Error('Invalid stored FiveOne credentials');
 const decipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(parts[0],'base64url'));
 decipher.setAuthTag(Buffer.from(parts[1],'base64url'));
 return Buffer.concat([decipher.update(Buffer.from(parts[2],'base64url')),decipher.final()]).toString('utf8');
}
export type FiveOneMerchant={
 id:string;company_id:string;site_id:string|null;label:string;
 environment:'sandbox'|'production';enabled:boolean;
 api_key_ciphertext:string;webhook_secret_ciphertext:string;
};
export async function merchantForSite(companyId:string,siteId:string){
 const service=createServiceClient();
 if(!service)throw new Error('Payment service unavailable');
 const {data:routing,error:routingError}=await service.from('fiveonepay_site_routing')
  .select('mode').eq('site_id',siteId).eq('company_id',companyId).maybeSingle();
 if(routingError)throw new Error('Payment routing unavailable');
 const scope=routing?.mode==='dedicated'?siteId:null;
 const {data,error}=await service.from('fiveonepay_merchants').select('*')
  .eq('company_id',companyId).eq('enabled',true).eq('environment','production')
  .is('site_id',scope).maybeSingle();
 // Sandbox merchant can be used only with explicit server-side sandbox opt-in.
 if(error)throw new Error('Merchant lookup unavailable');
 if(data)return data as FiveOneMerchant;
 if(process.env.ZARAY_FIVEONEPAY_SANDBOX_ENABLED==='true'){
  const {data:test,error:testError}=await service.from('fiveonepay_merchants').select('*')
   .eq('company_id',companyId).eq('enabled',true).eq('environment','sandbox')
   .is('site_id',scope).maybeSingle();
  if(testError)throw new Error('Sandbox merchant lookup unavailable');
  return (test||null) as FiveOneMerchant|null;
 }
 return null;
}
export function validFiveOneKey(secret:string,env:'sandbox'|'production'){
 return secret.startsWith(env==='sandbox'?'sk_test_':'sk_live_')&&secret.length>=16&&secret.length<=512;
}
export function validWebhookSecret(secret:string){
 return secret.startsWith('whsec_')&&secret.length>=12&&secret.length<=512;
}
export type FiveOneCreated={
 id:string;status:string;environment:string;amount:number;payable_amount:number;
 currency:string;commission:number;net_amount:number;reference:string;
 fiveonepay_reference:string;operator?:string|null;payment_url:string;expires_at:string;
};
export async function createFiveOnePayment(
 merchant:FiveOneMerchant,details:{amount:number;reference:string;attemptId:string;
 callbackUrl:string;successUrl:string;cancelUrl:string;operator?:string}
):Promise<FiveOneCreated>{
 const keyValue=decryptFiveOne(merchant.api_key_ciphertext);
 if(!validFiveOneKey(keyValue,merchant.environment))throw new Error('FiveOne API key invalid');
 const res=await fetch(FIVEONE_API+'/payments',{
  method:'POST',cache:'no-store',
  headers:{'Content-Type':'application/json','Authorization':'Bearer '+keyValue,
   'Idempotency-Key':'zaray-'+details.attemptId},
  body:JSON.stringify({
   amount:details.amount,reference:details.reference,
   description:'Abonnement Wi-Fi',
   ...(details.operator?{operator:details.operator}:{}),
   callbackUrl:details.callbackUrl,successUrl:details.successUrl,cancelUrl:details.cancelUrl,
   expiresInMinutes:15
  }),signal:AbortSignal.timeout(15000)
 });
 if(!res.ok)throw new Error('FiveOne payment creation failed: '+res.status);
 const payload=await res.json() as Partial<FiveOneCreated>;
 if(!payload||typeof payload.id!=='string'||payload.reference!==details.reference||
    Number(payload.amount)!==details.amount||payload.currency!=='MGA'||
    typeof payload.payment_url!=='string'||typeof payload.fiveonepay_reference!=='string'||
    !['PENDING','SUCCESS'].includes(String(payload.status))||
    !/^\d{8}$/.test(payload.fiveonepay_reference)||
    !Number.isSafeInteger(Number(payload.commission))||
    !Number.isSafeInteger(Number(payload.net_amount))||
    !Number.isSafeInteger(Number(payload.payable_amount))||
    !Number.isFinite(Date.parse(String(payload.expires_at))))throw new Error('FiveOne returned invalid checkout data');
 const url=new URL(payload.payment_url);
 if(url.protocol!=='https:'||url.hostname!=='pay.fiveonepay.com')
  throw new Error('Unexpected FiveOne checkout host');
 return payload as FiveOneCreated;
}
