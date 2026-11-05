import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {publicResidentialSite} from '@/lib/residential-site-identity';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request:NextRequest){
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 if(!uuid.test(siteId))return reply({error:'Site invalide.'},400);
 try{
  const session=await createClient();
  const {data:{user},error:authError}=await session.auth.getUser();
  if(authError||!user?.email||!user.email_confirmed_at)return reply({error:'Authentification requise.'},401);
  const service=createServiceClient();
  if(!service)return reply({error:'Service indisponible.'},503);
  const site=await publicResidentialSite(siteId);
  if(!site)return reply({error:'Site indisponible.'},404);
  const {data:siteRow,error:siteError}=await service.from('sites').select('company_id').eq('id',siteId).maybeSingle();
  if(siteError||!siteRow)return reply({error:'Site indisponible.'},404);
  // Match ONLY verified auth email, server-side tenant and selected site.
  // No client-provided customer ID/email is ever trusted for authorization.
  const {data:customer,error:customerError}=await service.from('customers')
   .select('id,full_name,email,status').eq('company_id',siteRow.company_id)
   .eq('site_id',siteId).eq('email',user.email.toLowerCase()).eq('status','active').maybeSingle();
  if(customerError)return reply({error:'Dossier momentanément indisponible.'},503);
  if(!customer)return reply({error:'Aucun dossier résidentiel autorisé pour ce site.'},403);
  const [{data:subscriptions,error:subError},{data:orders,error:ordersError}]=await Promise.all([
   service.from('residential_subscriptions')
    .select('id,offer_name,validity_days,paid_cycles,activated_cycles,activated_at,expires_at,created_at')
    .eq('company_id',siteRow.company_id).eq('site_id',siteId)
    .eq('customer_id',customer.id).order('created_at',{ascending:false}).limit(10),
   service.from('subscription_orders')
    .select('id,public_reference,offer_name,status,amount,currency,paid_at,created_at')
    .eq('company_id',siteRow.company_id).eq('site_id',siteId)
    .eq('customer_id',customer.id).order('created_at',{ascending:false}).limit(15)
  ]);
  if(subError||ordersError)return reply({error:'Abonnements momentanément indisponibles.'},503);
  const first=Array.isArray(subscriptions)?subscriptions[0]:null;
  let cycles:unknown[]=[];
  if(first){
   const {data,error}=await service.from('residential_subscription_cycles')
    .select('order_id,offer_name,amount,currency,paid_at,activated_at,period_start,period_end')
    .eq('company_id',siteRow.company_id).eq('subscription_id',first.id)
    .order('paid_at',{ascending:false}).limit(12);
   if(error)return reply({error:'Historique momentanément indisponible.'},503);
   cycles=data||[];
  }
  const status=!first?'Aucun abonnement':!first.paid_cycles?'Paiement attendu'
   :!first.activated_cycles?'Activation en attente'
   :!first.expires_at?'Échéance à confirmer'
   :Date.parse(first.expires_at)<Date.now()?'Expiré':'En cours';
  return reply({customer:{name:customer.full_name},site,
   subscriptions:subscriptions||[],orders:orders||[],cycles,status,
   usage:{available:false,downloadBytes:null,uploadBytes:null,rateDownBps:null,rateUpBps:null,
    message:'Les mesures de consommation et de débit ne sont pas encore transmises par le routeur.'}
  });
 }catch{return reply({error:'Service indisponible.'},503);}
}
