import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {publicResidentialSite} from '@/lib/residential-site-identity';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request:NextRequest){
 const body=await request.json().catch(()=>null) as {siteId?:unknown,email?:unknown}|null;
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 const email=typeof body?.email==='string'?body.email.trim().toLowerCase():'';
 if(!uuid.test(siteId)||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  return reply({error:'Site ou adresse e-mail invalide.'},400);
 try{
  const identity=await publicResidentialSite(siteId);
  if(!identity)return reply({error:'Site indisponible.'},404);
  const service=createServiceClient();
  if(!service)return reply({error:'Connexion temporairement indisponible.'},503);
  const {data:site}=await service.from('sites').select('company_id').eq('id',siteId).maybeSingle();
  if(!site)return reply({error:'Site indisponible.'},404);
  const {data:customer,error}=await service.from('customers').select('id')
   .eq('company_id',site.company_id).eq('site_id',siteId).eq('email',email)
   .eq('status','active').maybeSingle();
  if(error)return reply({error:'Connexion temporairement indisponible.'},503);
  // Always return the same message to avoid disclosing customer enrollment.
  if(customer){
   const session=await createClient();
   const {error:otpError}=await session.auth.signInWithOtp({
    email,options:{shouldCreateUser:true}
   });
   if(otpError){
    console.error('residential OTP dispatch failed',{code:otpError.code});
    return reply({error:'Envoi temporairement indisponible. Réessayez plus tard.'},503);
   }
  }
  return reply({message:'Si cette adresse possède un abonnement sur ce site, un e-mail de connexion lui a été envoyé.'});
 }catch{return reply({error:'Connexion temporairement indisponible.'},503);}
}
