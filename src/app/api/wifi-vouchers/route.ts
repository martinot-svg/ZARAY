import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizeTenant } from '@/lib/tenant-context';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomText(length:number){
  const bytes=crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
}
async function sha256(input:string){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function GET(request:NextRequest){
  const companyId=request.nextUrl.searchParams.get('companyId')??'';
  const siteId=request.nextUrl.searchParams.get('siteId')??'';
  if(!companyId||!siteId)return fail('Entreprise et site requis.',400);
  const supabase=await createClient();
  const access=await authorizeTenant(supabase,companyId,siteId);
  if(!access.ok)return fail(access.error,access.status);
  const {data,error}=await supabase.from('wifi_vouchers')
    .select('id,company_id,site_id,offer_id,batch_id,username,status,duration_minutes,validity_days,paid_at,activated_at,expires_at,created_at')
    .eq('company_id',companyId).eq('site_id',siteId).order('created_at',{ascending:false}).limit(200);
  if(error)return fail('Inventaire des tickets indisponible.',503);
  return NextResponse.json({vouchers:data??[]},{headers});
}
export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const companyId=typeof body?.companyId==='string'?body.companyId:'';
  const siteId=typeof body?.siteId==='string'?body.siteId:'';
  const offerId=typeof body?.offerId==='string'?body.offerId:'';
  const count=body?.count;
  if(!companyId||!siteId||!offerId||!Number.isInteger(count)||Number(count)<1||Number(count)>99)return fail('Entreprise, site, offre et quantité (1 à 99) requis.',400);
  try{
    const supabase=await createClient();
    const access=await authorizeTenant(supabase,companyId,siteId);
    if(!access.ok)return fail(access.error,access.status);
    if(!['owner','admin','site_manager'].includes(access.member.role))return fail('Rôle non autorisé pour créer des tickets.',403);
    if(access.site?.status!=='active')return fail('Activez le site avant de préparer les tickets.',409);
    const {data:offer,error:offerError}=await supabase.from('offers')
      .select('id,company_id,name,duration_minutes,validity_days,price_amount,currency,status')
      .eq('id',offerId).eq('company_id',companyId).maybeSingle();
    if(offerError||!offer)return fail('Offre introuvable.',404);
    if(offer.status!=='active')return fail('Seules les offres actives peuvent être imprimées.',409);
    const {data:templates,error:templateError}=await supabase.from('ticket_templates')
      .select('offer_id,username_length,password_length')
      .eq('company_id',companyId).eq('site_id',siteId);
    if(templateError)return fail('Configuration des tickets indisponible.',503);
    const general=(templates??[]).find(r=>r.offer_id===null);
    const specific=(templates??[]).find(r=>r.offer_id===offerId);
    const usernameLength=specific?.username_length??general?.username_length??5;
    const passwordLength=specific?.password_length??general?.password_length??12;
    if(!Number.isInteger(usernameLength)||usernameLength<3||usernameLength>5||!Number.isInteger(passwordLength)||passwordLength<12||passwordLength>32)return fail('Configuration non conforme.',409);
    const batchId=crypto.randomUUID();
    for(let attempt=0;attempt<4;attempt++){
      const used=new Set<string>();
      const printable:{id:string;username:string;password:string;offer_name:string;price_amount:number|string;currency:string;duration_minutes:number;validity_days:number;status:string}[]=[];
      const rows:{id:string;company_id:string;site_id:string;offer_id:string;batch_id:string;username:string;credential_hash:string;created_by:string;duration_minutes:number;validity_days:number}[]=[];
      for(let i=0;i<Number(count);i++){
        let username='';
        do{username=randomText(usernameLength);}while(used.has(username));
        used.add(username);
        const password=randomText(passwordLength);
        const id=crypto.randomUUID();
        rows.push({id,company_id:companyId,site_id:siteId,offer_id:offerId,batch_id:batchId,username,credential_hash:await sha256(siteId+':'+username+':'+password),created_by:access.user.id,duration_minutes:offer.duration_minutes,validity_days:offer.validity_days});
        printable.push({id,username,password,offer_name:offer.name,price_amount:offer.price_amount,currency:offer.currency,duration_minutes:offer.duration_minutes,validity_days:offer.validity_days,status:'available'});
      }
      const {error}=await supabase.from('wifi_vouchers').insert(rows);
      if(!error)return NextResponse.json({batchId,tickets:printable,warning:'Les mots de passe sont remis une seule fois. Tickets non payés, non activés et non provisionnés sur MikroTik.'},{status:201,headers});
      if(error.code==='23505')continue;
      console.error('voucher batch create',{code:error.code});
      return fail(error.code==='42501'?'Action non autorisée.':'Création du lot impossible.',error.code==='42501'?403:503);
    }
    return fail('Collisions d’identifiants : réessayez avec une longueur supérieure.',409);
  }catch{return fail('Service indisponible.',503);}
}
