import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const respond=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
// Financial access is explicit; do not grant read access to all company members.
const reportingRoles=new Set(['owner','admin','finance','sales','site_manager']);

export async function GET(request:NextRequest){
 const companyId=request.nextUrl.searchParams.get('companyId')||'';
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 const period=request.nextUrl.searchParams.get('period')||'day';
 if(!['day','week','month','year'].includes(period))
  return respond({error:'Période de suivi invalide.'},400);
 if(!siteId)return respond({error:'Sélectionnez un site pour le suivi.'},400);
 try{
  const client=await createClient();
  const access=await authorizeTenant(client,companyId,siteId);
  if(!access.ok)return respond({error:access.error},access.status);
  if(!reportingRoles.has(access.member.role))
   return respond({error:'Le suivi financier est réservé aux responsables autorisés.'},403);
  const service=createServiceClient();
  if(!service)return respond({error:'Service de statistiques indisponible.'},503);
  // Only the trusted server can invoke this aggregate; the public roles lack
  // EXECUTE permission. The authenticated user's company and site were checked.
  const {data,error}=await service.rpc('site_performance_overview',{
   p_company_id:companyId,p_site_id:siteId,p_period:period
  });
  if(error||!data){
   console.error('site performance overview',error?.code);
   return respond({error:'Indicateurs du site temporairement indisponibles.'},503);
  }
  return respond(data);
 }catch{return respond({error:'Service de suivi temporairement indisponible.'},503);}
}
