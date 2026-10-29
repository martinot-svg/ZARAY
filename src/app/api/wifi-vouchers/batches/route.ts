import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
import {deriveVoucherPassword,type VoucherCredentialScheme} from '@/lib/network-voucher-secret';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const manager=['owner','admin','site_manager'];
export async function GET(req:NextRequest){
 const companyId=req.nextUrl.searchParams.get('companyId')||'',siteId=req.nextUrl.searchParams.get('siteId')||'';
 const auth=await authorizeTenant(await createClient(),companyId,siteId);
 if(!auth.ok)return json({error:auth.error},auth.status);
 const service=createServiceClient();if(!service)return json({error:'Service indisponible.'},503);
 const {data:vouchers,error}=await service.from('wifi_vouchers')
  .select('id,batch_id,offer_id,status,created_at')
  .eq('company_id',companyId).eq('site_id',siteId).order('created_at',{ascending:false}).limit(3000);
 if(error)return json({error:'Lots indisponibles.'},503);
 const ids=(vouchers??[]).map(v=>v.id);
 const {data:network,error:linkError}=ids.length?
  await service.from('wifi_voucher_network').select('voucher_id,network_state,unit_price,unit_currency,last_printed_at,reprint_count').in('voucher_id',ids):
  {data:[],error:null};
 if(linkError)return json({error:'Statut des lots indisponible.'},503);
 const links=new Map((network??[]).map(n=>[n.voucher_id,n]));
 const map=new Map<string,{batchId:string;createdAt:string;count:number;ready:number;activated:number;pending:number;expired:number;printed:number;offerId:string}>();
 for(const v of vouchers??[]){
  const l=links.get(v.id),key=v.batch_id;
  if(!map.has(key))map.set(key,{batchId:key,createdAt:v.created_at,count:0,ready:0,activated:0,pending:0,expired:0,printed:0,offerId:v.offer_id});
  const x=map.get(key)!;x.count++;
  if(v.status==='active')x.activated++;
  else if(v.status==='expired'||v.status==='cancelled')x.expired++;
  else if(v.status==='available'&&l?.network_state==='provisioned')x.ready++;
  else x.pending++;
  if(l?.last_printed_at)x.printed++;
 }
 return json({batches:[...map.values()],truncated:(vouchers??[]).length===3000});
}
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>null) as {companyId?:string;siteId?:string;batchId?:string}|null;
 const companyId=b?.companyId||'',siteId=b?.siteId||'',batchId=b?.batchId||'';
 if(!/^[0-9a-f-]{36}$/i.test(batchId))return json({error:'Identifiant de lot invalide.'},400);
 const auth=await authorizeTenant(await createClient(),companyId,siteId);
 if(!auth.ok)return json({error:auth.error},auth.status);
 if(!manager.includes(auth.member.role))return json({error:'Impression non autorisée.'},403);
 const service=createServiceClient();if(!service)return json({error:'Service indisponible.'},503);
 const {data:vouchers,error}=await service.from('wifi_vouchers')
  .select('id,username,status,offer_id,duration_minutes,validity_days').eq('company_id',companyId).eq('site_id',siteId).eq('batch_id',batchId).limit(100);
 if(error||!vouchers?.length)return json({error:'Lot introuvable.'},404);
 if(vouchers.length>99||vouchers.some(v=>v.status!=='available'))return json({error:'Réimpression réservée aux lots intégralement en stock.'},409);
 const ids=vouchers.map(v=>v.id);
 const {data:links,error:linkError}=await service.from('wifi_voucher_network')
  .select('voucher_id,network_state,password_length,credential_scheme,unit_price,unit_currency,last_printed_at,reprint_count')
  .eq('company_id',companyId).eq('site_id',siteId).in('voucher_id',ids);
 if(linkError||links?.length!==vouchers.length)return json({error:'Lots réseau incomplets.'},409);
 const net=new Map((links??[]).map(l=>[l.voucher_id,l]));
 if(vouchers.some(v=>net.get(v.id)?.network_state!=='provisioned'))return json({error:'Attendez la préparation effective du lot sur MikroTik avant toute impression.'},409);
 const alreadyPrinted=links!.some(l=>l.last_printed_at!==null);
 if(alreadyPrinted&&!['owner','admin'].includes(auth.member.role))return json({error:'Réimpression autorisée uniquement au dirigeant ou administrateur.'},403);
 const {data:offers}=await service.from('offers')
  .select('id,name').eq('company_id',companyId).in('id',[...new Set(vouchers.map(v=>v.offer_id))]);
 const names=new Map((offers??[]).map(o=>[o.id,o.name]));
 const tickets=[];
 try{
  for(const v of vouchers){
   const n=net.get(v.id)!;
   if(!['hmac-v1','hmac-numeric-v2'].includes(n.credential_scheme))throw Error('Schéma de ticket inconnu.');
   tickets.push({id:v.id,username:v.username,
    password:deriveVoucherPassword(v.id,siteId,n.password_length,n.credential_scheme as VoucherCredentialScheme),
    offer_name:names.get(v.offer_id)||'Offre Wi-Fi',
    price_amount:n.unit_price,currency:n.unit_currency,duration_minutes:v.duration_minutes,
    validity_days:v.validity_days,status:v.status});
  }
 }catch{return json({error:'Codes indisponibles, vérifiez la configuration serveur.'},503);}
 const now=new Date().toISOString();
 // Printing is deliberately audited; it is not interpreted as a cash sale.
 const {error:auditError}=await service.from('network_access_events').insert({
  company_id:companyId,actor_user_id:auth.user.id,
  event_type:alreadyPrinted?'wifi.batch_reprint':'wifi.batch_export',
  reason:'Lot '+batchId+' · '+vouchers.length+' tickets'
 });
 if(auditError)return json({error:'Journalisation de l’export indisponible.'},503);
 for(const n of links!){
  await service.from('wifi_voucher_network').update({
   last_printed_at:now,reprint_count:(n.reprint_count||0)+(n.last_printed_at?1:0)
  }).eq('voucher_id',n.voucher_id).eq('company_id',companyId);
 }
 return json({batchId,tickets,reprint:alreadyPrinted});
}
