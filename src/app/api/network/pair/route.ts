import { randomBytes, createHash } from 'node:crypto';
import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { authorizeTenant } from '@/lib/tenant-context';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>null) as {companyId?:string;routerId?:string}|null;
 if(!b?.companyId||!b.routerId)return json({error:'Entreprise et routeur requis.'},400);
 const session=await createClient(),access=await authorizeTenant(session,b.companyId);
 if(!access.ok)return json({error:access.error},access.status);
 if(!['owner','admin'].includes(access.member.role))return json({error:'Dirigeant ou administrateur requis.'},403);
 const service=createServiceClient();
 if(!service)return json({error:'Service sécurisé indisponible.'},503);
 const {data:router,error}=await service.from('network_routers').select('id,company_id').eq('id',b.routerId).eq('company_id',b.companyId).maybeSingle();
 if(error||!router)return json({error:'Routeur inaccessible.'},404);
 const token=randomBytes(32).toString('hex');
 const hash=createHash('sha256').update(token).digest('hex');
 const expires=new Date(Date.now()+15*60_000).toISOString();
 const {error:upsertError}=await service.from('network_connector_credentials').upsert({
  router_id:router.id,pairing_hash:hash,pairing_expires_at:expires,secret_hash:null,paired_at:null,revoked_at:null,updated_at:new Date().toISOString()
 },{onConflict:'router_id'});
 if(upsertError)return json({error:'Appairage indisponible.'},503);
 const {error:disableError}=await service.from('network_routers').update({control_enabled:false,status:'pending'}).eq('id',router.id).eq('company_id',b.companyId);
 if(disableError)return json({error:'Impossible de préparer le routeur.'},503);
 return json({routerId:router.id,pairingToken:token,expiresAt:expires,warning:'Code affiché une seule fois. Réappairer révoque immédiatement la clé précédente. La commande réseau reste désactivée.'});
}
