import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
type Context = { params: Promise<{ slug: string }> };
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Hostname binding is server-side and only active for its own site. */
async function customSiteOf(request:NextRequest){
 const hostname=request.nextUrl.hostname.toLowerCase();
 const brandedHost=hostname==='mlayconnexion.vercel.app';
 if(hostname==='localhost'||hostname==='127.0.0.1'||hostname.endsWith('.vercel.app')&&!brandedHost)return null;
 const service=createServiceClient();
 if(!service)throw new Error('Site identity unavailable');
 let binding:{site_id:string;company_id:string}|null=null;
 if(brandedHost){
  const result=await service.from('site_public_links')
   .select('site_id,company_id').eq('public_hostname',hostname).maybeSingle();
  if(result.error)throw new Error('Site hostname unavailable');
  binding=result.data;
 }else{
  const verified=await service.from('site_custom_domains')
   .select('site_id,company_id').eq('hostname',hostname).eq('status','active').maybeSingle();
  if(verified.error)throw new Error('Domain binding unavailable');
  binding=verified.data;
  if(!binding){
   const local=await service.from('site_public_links')
    .select('site_id,company_id').eq('alias',hostname.startsWith('compte.')?hostname.slice(7):hostname).maybeSingle();
   if(local.error)throw new Error('Local hostname unavailable');
   binding=local.data;
  }
 }
 if(!binding)throw new Error('Site hostname unknown');
 const [{data:company,error:companyError},{data:site,error:siteError}]=await Promise.all([
  service.from('companies').select('slug,status').eq('id',binding.company_id).maybeSingle(),
  service.from('sites').select('id,status').eq('id',binding.site_id)
   .eq('company_id',binding.company_id).maybeSingle()
 ]);
 if(companyError||siteError||!company||!site||site.status!=='active'||
    !['active','trial'].includes(company.status))
  throw new Error('Site unavailable');
 return {siteId:binding.site_id,companySlug:company.slug};
}


export async function GET(request: NextRequest, { params }: Context) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,80}$/i.test(slug)) return json({ error: 'Portail introuvable.' }, 404);
  try {
    const domainSite=await customSiteOf(request);
    const siteId=request.nextUrl.searchParams.get('siteId')||'';
    if(siteId&&!uuid.test(siteId))return json({error:'Site invalide.'},400);
    if(domainSite&&(domainSite.companySlug!==slug||siteId&&siteId!==domainSite.siteId))
      return json({error:'Site indisponible.'},404);
    const requestedSite=domainSite?.siteId||siteId;
    const supabase = await createClient();
    const [{ data, error }, sitesResult] = await Promise.all([
      supabase.rpc('get_public_offer_catalog', { p_company_slug: slug }),
      supabase.rpc('get_public_residential_sites', { p_company_slug: slug }),
    ]);
    if (error || sitesResult.error) {
      console.error('portal catalogue failed', { catalogueCode: error?.code, sitesCode: sitesResult.error?.code });
      return json({ error: 'Le catalogue est temporairement indisponible.' }, 503);
    }
    const rows = (data ?? []) as Array<{ company_name: string; company_slug: string; offer_id: string; offer_name: string; description: string; duration_minutes: number; validity_days: number; price_amount: number | string; currency: string; max_devices: number }>;
    if (!rows.length) return json({ error: 'Aucune offre active pour ce portail.' }, 404);
    const allowedSites=(sitesResult.data??[]).filter((site:{site_id:string})=>!requestedSite||site.site_id===requestedSite);
    if(!allowedSites.length)return json({error:'Aucun site actif disponible pour ce portail.'},404);
    return json({ companyName: rows[0].company_name, slug: rows[0].company_slug, sites: allowedSites.map((site: {site_id:string;site_name:string;site_status:string}) => ({id:site.site_id,name:site.site_name,status:site.site_status})), offers: rows.map((o) => ({ id: o.offer_id, name: o.offer_name, description: o.description, durationMinutes: o.duration_minutes, validityDays: o.validity_days, priceAmount: Number(o.price_amount), currency: o.currency, maxDevices: o.max_devices })) });
  } catch { return json({ error: 'Le catalogue est temporairement indisponible.' }, 503); }
}

export async function POST(request: NextRequest, { params }: Context) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,80}$/i.test(slug)) return json({ error: 'Portail introuvable.' }, 404);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.offerId !== 'string' || typeof body.customerName !== 'string' || typeof body.customerEmail !== 'string') return json({ error: 'Informations de souscription incomplètes.' }, 400);
  const siteId = typeof body.siteId === 'string' && body.siteId ? body.siteId : null;
  if (siteId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(siteId)) return json({ error: 'Site de souscription invalide.' }, 400);
  const customerName = body.customerName.trim();
  const customerEmail = body.customerEmail.trim().toLowerCase();
  const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
  if (customerName.length < 2 || customerName.length > 160 || customerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || customerPhone.length > 32 || (customerPhone && customerPhone.length < 5)) return json({ error: 'Vérifiez le nom, l’adresse e-mail et le téléphone.' }, 400);
  try {
    const domainSite=await customSiteOf(request);
    if(domainSite&&(domainSite.companySlug!==slug||siteId!==domainSite.siteId))
      return json({error:'Ce domaine accepte uniquement les inscriptions de son site.'},403);
    const supabase = await createClient();
    const {data:availableSites,error:availabilityError}=await supabase.rpc(
      'get_public_residential_sites',{p_company_slug:slug}
    );
    if(availabilityError)return json({error:'Disponibilité des sites momentanément indisponible.'},503);
    const eligible=(availableSites??[]) as Array<{site_id:string}>;
    if(!eligible.length||(siteId&&!eligible.some(s=>s.site_id===siteId)))
      return json({error:'Le site est désactivé ou indisponible pour une nouvelle souscription.'},409);
    const { data, error } = await supabase.rpc('create_public_subscription_order_at_site', { p_company_slug: slug, p_offer_id: body.offerId, p_customer_name: customerName, p_customer_email: customerEmail, p_customer_phone: customerPhone || null, p_site_id: siteId });
    if (error) {
      console.error('portal order creation failed', { code: error.code, message: error.message });
      if (error.message?.includes('too_many_orders')) return json({ error: 'Trop de commandes récentes pour cette adresse. Réessayez dans 15 minutes.' }, 429);
      if (error.message?.includes('offer_not_available') || error.message?.includes('company_not_found')) return json({ error: 'Cette offre n’est plus disponible.' }, 409);
      if (error.message?.includes('site_required')) return json({ error: 'Choisissez le site de votre abonnement.' }, 400);
      if (error.message?.includes('site_not_available')||error.code==='23514') return json({ error: 'Ce site n’est pas disponible pour cette entreprise.' }, 409);
      if (error.message?.includes('customer_already_assigned_to_site')) return json({ error: 'Ce client est déjà rattaché à un autre site. Contactez le fournisseur pour demander un transfert.' }, 409);
      if (error.code === '22023') return json({ error: 'Les informations fournies sont invalides.' }, 400);
      return json({ error: 'Impossible de créer la commande pour le moment.' }, 503);
    }
    return json({ order: data, message: 'Commande créée. Le paiement reste à confirmer ; aucun accès Internet n’a été activé.' }, 201);
  } catch { return json({ error: 'Service indisponible.' }, 503); }
}
