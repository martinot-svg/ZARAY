import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
import {createServiceClient} from '@/lib/supabase/service';

type SiteDomain={siteId:string;companySlug:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function activeSiteForHostname(hostname:string):Promise<SiteDomain|null>{
 const service=createServiceClient();
 if(!service)throw new Error('Domain registry offline');
 const {data,error}=await service.from('site_custom_domains')
  .select('site_id,company_id').eq('hostname',hostname).eq('status','active').maybeSingle();
 if(error)throw new Error('Domain registry unavailable');
 if(!data)return null;
 const [{data:site,error:siteError},{data:company,error:companyError}]=await Promise.all([
  service.from('sites').select('status').eq('id',data.site_id).eq('company_id',data.company_id).maybeSingle(),
  service.from('companies').select('slug,status').eq('id',data.company_id).maybeSingle()
 ]);
 if(siteError||companyError)throw new Error('Site domain lookup unavailable');
 if(!site||!company||site.status!=='active'||!['active','trial'].includes(company.status))return null;
 return {siteId:data.site_id,companySlug:company.slug};
}

/** A free branded hostname must be explicitly mapped to an active tenant site. */
async function activeSiteForPublicHostname(hostname:string,field:'public_hostname'|'alias'='public_hostname'):Promise<SiteDomain|null>{
 const service=createServiceClient();
 if(!service)throw new Error('Site link registry offline');
 const {data,error}=await service.from('site_public_links')
  .select('site_id,company_id').eq(field,hostname).maybeSingle();
 if(error)throw new Error('Site link registry unavailable');
 if(!data)return null;
 const [{data:site,error:siteError},{data:company,error:companyError}]=await Promise.all([
  service.from('sites').select('status').eq('id',data.site_id).eq('company_id',data.company_id).maybeSingle(),
  service.from('companies').select('slug,status').eq('id',data.company_id).maybeSingle()
 ]);
 if(siteError||companyError)throw new Error('Site link identity unavailable');
 if(!site||!company||site.status!=='active'||!['active','trial'].includes(company.status))return null;
 return {siteId:data.site_id,companySlug:company.slug};
}

function customHostResponse(request:NextRequest,site:SiteDomain|null,vanity=false){
 const denied=()=>new NextResponse('Domaine non disponible.',{
  status:404,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}
 });
 if(!site)return denied();
 const path=request.nextUrl.pathname;
 const search=request.nextUrl.searchParams;
 const target=new URL(request.url);
 // A branded free address opens its own subscription page, not the admin site.
 if(vanity&&path==='/'){
  target.pathname='/wifi/'+encodeURIComponent(site.companySlug);
  target.search='?siteId='+encodeURIComponent(site.siteId)+'&inscription=1';
  return NextResponse.rewrite(target,{request});
 }
 if(path==='/'||path==='/compte'||path==='/mon-internet'){
  target.pathname='/mon-internet/'+site.siteId;
  target.search='';
  return NextResponse.rewrite(target,{request});
 }
 if(path==='/favicon.ico'){
  target.pathname='/api/public/residential-icon';
  target.search='?siteId='+encodeURIComponent(site.siteId);
  return NextResponse.rewrite(target,{request});
 }
 if(path==='/offres'){
  target.pathname='/wifi/'+encodeURIComponent(site.companySlug);
  target.search='?siteId='+encodeURIComponent(site.siteId);
  return NextResponse.rewrite(target,{request});
 }
 const paymentReference=path.startsWith('/paiement/')?path.slice('/paiement/'.length):'';
 if(paymentReference.length===12&&/^[A-Fa-f0-9]+$/.test(paymentReference)){
  target.pathname='/mon-internet/'+site.siteId+'/paiement/'+path.split('/')[2].toUpperCase();
  target.search='';
  return NextResponse.rewrite(target,{request});
 }
 if(path==='/mon-internet/'+site.siteId)return NextResponse.next({request});
 if(path==='/mon-internet/'+site.siteId+'/manifest.webmanifest')
  return NextResponse.next({request});
 if(path==='/wifi/'+site.companySlug
  &&(!search.has('siteId')||search.get('siteId')===site.siteId)){
  if(!search.has('siteId')){
   target.searchParams.set('siteId',site.siteId);
   return NextResponse.rewrite(target,{request});
  }
  return NextResponse.next({request});
 }
 const ownSiteRoutes=new Set([
  '/api/public/residential-site','/api/public/residential-icon',
  '/api/public/residential-app-icon',
  '/api/residential/account','/api/residential/notifications',
  '/api/residential/notification-preferences',
  '/api/public/wifi-offers'
 ]);
 if(ownSiteRoutes.has(path)&&search.get('siteId')===site.siteId)
  return NextResponse.next({request});
 if(path==='/api/residential/otp'&&request.method==='POST')
  return NextResponse.next({request});
 if(path==='/api/manual-payments/status'&&search.get('siteId')===site.siteId)
  return NextResponse.next({request});
 if(path==='/api/portal/'+site.companySlug){
  if(request.method==='GET'){
   if(search.has('siteId')&&search.get('siteId')!==site.siteId)return denied();
   target.searchParams.set('siteId',site.siteId);
   return NextResponse.rewrite(target,{request});
  }
  if(request.method==='POST')return NextResponse.next({request});
 }
 if(path==='/api/portal/'+site.companySlug+'/payment-methods')
  return NextResponse.next({request});
 if(path==='/api/manual-payments/submit'&&request.method==='POST')
  return NextResponse.next({request});
 return denied();
}

export async function proxy(request:NextRequest){
 const hostname=request.nextUrl.hostname.toLowerCase();
 // Built-in Vercel URLs remain reserved for the ZARAY administration.
 const platformHost=hostname==='localhost'||hostname==='127.0.0.1'
  ||hostname.endsWith('.vercel.app');
 const cookiesToSet:Array<{name:string;value:string;options:Parameters<ReturnType<typeof NextResponse.next>['cookies']['set']>[2]}>=[];
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(url&&key){
  const supabase=createServerClient(url,key,{
   cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll:(cookies)=>{
     for(const cookie of cookies){
      request.cookies.set(cookie.name,cookie.value);
      cookiesToSet.push(cookie);
     }
    }
   }
  });
  await supabase.auth.getUser();
 }
 let response:NextResponse;
 // Reserved ZARAY project hosts remain admin-only. Assigned vanity hosts
 // are isolated to their tenant's public registration and account routes.
 if(hostname.endsWith('.vercel.app')&&!['zaray.vercel.app','localhost'].includes(hostname)
    &&hostname==='mlayconnexion.vercel.app'){
  try{
   const site=await activeSiteForPublicHostname(hostname);
   response=customHostResponse(request,site,true);
  }catch{
   response=new NextResponse('Portail temporairement indisponible.',{
    status:503,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}
   });
  }
 }else if(platformHost)response=NextResponse.next({request});
 else{
  try{
   const accountAlias=hostname.startsWith('compte.')?hostname.slice('compte.'.length):null;
   const site=await activeSiteForHostname(hostname)
    ?? await activeSiteForPublicHostname(accountAlias||hostname,'alias');
   response=customHostResponse(request,site);
  }catch{
   response=new NextResponse('Domaine temporairement indisponible.',{
    status:503,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}
   });
  }
 }
 for(const cookie of cookiesToSet)response.cookies.set(cookie.name,cookie.value,cookie.options);
 return response;
}

export const config={
 matcher:['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)'],
};
