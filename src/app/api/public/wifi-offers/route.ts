import {NextRequest,NextResponse} from 'next/server';
import {createServiceClient} from '@/lib/supabase/service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers={
 'Cache-Control':'public, max-age=15, s-maxage=15, stale-while-revalidate=30',
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Methods':'GET, OPTIONS',
 'X-Content-Type-Options':'nosniff'
};
const respond=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
export function OPTIONS(){return new NextResponse(null,{status:204,headers});}
export async function GET(request:NextRequest){
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 if(!uuid.test(siteId))return respond({error:'Identifiant du site invalide.'},400);
 const service=createServiceClient();
 if(!service)return respond({error:'Catalogue temporairement indisponible.'},503);
 const {data:site,error:siteError}=await service.from('sites')
  .select('id,name,status,company_id').eq('id',siteId).eq('status','active').maybeSingle();
 if(siteError)return respond({error:'Catalogue temporairement indisponible.'},503);
 if(!site)return respond({error:'Site Wi-Fi indisponible.'},404);
 const {data:company,error:companyError}=await service.from('companies')
  .select('slug,legal_name,status').eq('id',site.company_id).maybeSingle();
 if(companyError)return respond({error:'Portail entreprise temporairement indisponible.'},503);
 if(!company||!['active','trial'].includes(company.status)||!company.slug)
  return respond({error:'Portail entreprise indisponible.'},404);
 const {data,error}=await service.rpc('get_hotspot_offer_catalog',{p_site_id:siteId});
 if(error)return respond({error:'Offres temporairement indisponibles.'},503);
 const offers=(data??[]).map((offer:{
  offer_id:string;offer_name:string;offer_description:string|null;
  duration_minutes:number;price_amount:number|string;currency:string;prepared_stock:number;
 })=>({
  id:offer.offer_id,
  name:offer.offer_name,
  description:offer.offer_description||'',
  durationMinutes:offer.duration_minutes,
  priceAmount:Number(offer.price_amount),
  currency:offer.currency,
  available:true
 }));
 return respond({
  siteName:site.name,
  companyName:company.legal_name,
  companySlug:company.slug,
  offers,
  selectionChangesVoucher:false,
  registrationRequiresPaymentConfirmation:true
 });
}
