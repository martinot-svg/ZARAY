import {NextRequest,NextResponse} from 'next/server';
import {createServiceClient} from '@/lib/supabase/service';
import {siteLogoForSurface} from '@/lib/site-logo-variants';
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
 const [{data,error},{data:style,error:styleError},{data:variants}]=await Promise.all([
  service.rpc('get_hotspot_offer_catalog',{p_site_id:siteId}),
  service.from('ticket_templates')
   .select('brand_name,logo_data_uri,primary_color,secondary_color,accent_color,welcome_message')
   .eq('site_id',siteId).eq('company_id',site.company_id).is('offer_id',null).maybeSingle(),
  service.from('site_brand_assets').select('light_data_uri,dark_data_uri')
   .eq('site_id',siteId).eq('company_id',site.company_id).maybeSingle()
 ]);
 if(error)return respond({error:'Offres temporairement indisponibles.'},503);
 // Degrade gracefully to company/site defaults; a branding read failure must
 // never prevent access to a valid local MikroTik ticket.
 if(styleError)console.error('public hotspot style unavailable',{code:styleError.code});
 const publicColor=(value:unknown,fallback:string)=>
  typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value)?value:fallback;
 const logo=typeof style?.logo_data_uri==='string'
  &&style.logo_data_uri.length<=180000
  &&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(style.logo_data_uri)
  ?style.logo_data_uri:null;
 const branding={
  siteName:site.name,
  brandName:typeof style?.brand_name==='string'&&style.brand_name.trim()
   ?style.brand_name.trim().slice(0,90):site.name,
  primaryColor:publicColor(style?.primary_color,'#40caff'),
  accentColor:publicColor(style?.accent_color,'#66eabe'),
  welcomeMessage:typeof style?.welcome_message==='string'
   ?style.welcome_message.slice(0,120):'',
  logoDataUri:siteLogoForSurface({logoLightDataUri:variants?.light_data_uri,
   logoDarkDataUri:variants?.dark_data_uri,logoDataUri:logo},
   publicColor(style?.secondary_color,'#ffffff')),
  logoLightDataUri:variants?.light_data_uri??logo,
  logoDarkDataUri:variants?.dark_data_uri??logo
 };
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
  branding,
  offers,
  selectionChangesVoucher:false,
  registrationRequiresPaymentConfirmation:true
 });
}
