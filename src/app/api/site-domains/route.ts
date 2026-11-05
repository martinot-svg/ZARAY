import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
import {checkSiteProjectDomain,vercelDomainIntegrationReady} from '@/lib/site-domain-vercel';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validHostname=(input:string)=>{
 const hostname=input.trim().toLowerCase().replace(/\.$/,'');
 if(hostname.length>253||hostname.length<4||!hostname.includes('.')
  ||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(hostname))
  return '';
 const parts=hostname.split('.');
 const tld=parts[parts.length-1];
 if(!/^[a-z]{2,63}$/.test(tld)
  ||parts.some(v=>v.length>63||v.includes('--')&&!v.startsWith('xn--'))
  ||hostname.endsWith('.vercel.app')||hostname.endsWith('.supabase.co')
  ||['localhost','example.com','example.org','example.net','zaray.vercel.app'].includes(hostname)
  ||hostname.endsWith('.localhost')||hostname.endsWith('.test')||hostname.endsWith('.invalid'))
  return '';
 return hostname;
};

async function authorized(companyId:string,siteId:string){
 if(!uuid.test(companyId)||!uuid.test(siteId))return {response:json({error:'Entreprise ou site invalide.'},400)};
 const client=await createClient();
 const access=await authorizeTenant(client,companyId,siteId);
 if(!access.ok)return {response:json({error:access.error},access.status)};
 if(!['owner','admin'].includes(access.member.role))
  return {response:json({error:'Seul un administrateur autorisé peut gérer le domaine du site.'},403)};
 const service=createServiceClient();
 if(!service)return {response:json({error:'Service indisponible.'},503)};
 return {service,userId:access.user.id};
}
async function existing(service:NonNullable<Awaited<ReturnType<typeof authorized>>['service']>,companyId:string,siteId:string){
 const {data,error}=await service.from('site_custom_domains')
  .select('hostname,status,verified_at,last_checked_at')
  .eq('company_id',companyId).eq('site_id',siteId).maybeSingle();
 if(error)throw new Error('Configuration du domaine indisponible.');
 return data;
}
export async function GET(request:NextRequest){
 const companyId=request.nextUrl.searchParams.get('companyId')||'';
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 try{
  const a=await authorized(companyId,siteId);
  if(a.response)return a.response;
  return json({domain:await existing(a.service!,companyId,siteId),
   automaticVerification:vercelDomainIntegrationReady()});
 }catch{return json({error:'Configuration du domaine indisponible.'},503);}
}
export async function PUT(request:NextRequest){
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof body?.companyId==='string'?body.companyId:'';
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 const hostname=validHostname(typeof body?.hostname==='string'?body.hostname:'');
 if(!hostname)return json({error:'Entrez un domaine valide que vous contrôlez, par exemple monsite.mg.'},400);
 try{
  const a=await authorized(companyId,siteId);
  if(a.response)return a.response;
  const current=await existing(a.service!,companyId,siteId);
  if(current?.hostname===hostname)
   return json({domain:current,automaticVerification:vercelDomainIntegrationReady()});
  const {data,error}=await a.service!.from('site_custom_domains').upsert({
   company_id:companyId,site_id:siteId,hostname,status:'pending',
   verified_at:null,last_checked_at:null,created_by:a.userId!
  },{onConflict:'site_id'}).select('hostname,status,verified_at,last_checked_at').single();
  if(error)return json({error:error.code==='23505'?'Ce domaine est déjà attribué à un autre site.':'Enregistrement du domaine impossible.'},error.code==='23505'?409:503);
  let verification=null;let warning='';
  try{
   verification=await checkSiteProjectDomain(hostname,'register');
  }catch{
   warning='Domaine enregistré mais pas encore ajouté au projet Vercel. Consultez la configuration DNS.';
  }
  // NEVER activate a domain here, even if another Vercel project owns it.
  return json({domain:data,verification,warning,
   automaticVerification:vercelDomainIntegrationReady()},201);
 }catch{return json({error:'Enregistrement du domaine indisponible.'},503);}
}
export async function PATCH(request:NextRequest){
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof body?.companyId==='string'?body.companyId:'';
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 try{
  const a=await authorized(companyId,siteId);
  if(a.response)return a.response;
  const current=await existing(a.service!,companyId,siteId);
  if(!current)return json({error:'Enregistrez d’abord un domaine.'},404);
  const check=await checkSiteProjectDomain(current.hostname,'verify');
  if(!check.integrationReady)return json({domain:current,verification:check,
   warning:'La vérification automatique Vercel n’est pas encore configurée dans le serveur.'});
  const {data,error}=await a.service!.from('site_custom_domains').update({
   status:check.active?'active':'pending',
   verified_at:check.active?new Date().toISOString():null,
   last_checked_at:new Date().toISOString()
  }).eq('site_id',siteId).eq('company_id',companyId).eq('hostname',current.hostname)
   .select('hostname,status,verified_at,last_checked_at').single();
  if(error)return json({error:'État de vérification indisponible.'},503);
  return json({domain:data,verification:check});
 }catch{return json({error:'Vérification Vercel indisponible. Le domaine reste en attente.'},503);}
}
