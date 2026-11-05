import {NextRequest,NextResponse} from 'next/server';
import {createServiceClient} from '@/lib/supabase/service';

export const dynamic='force-dynamic';
const aliasPattern=/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
type Context={params:Promise<{alias:string}>};
const unavailable=()=>new NextResponse('Lien public introuvable.',{
 status:404,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});
export async function GET(request:NextRequest,{params}:Context){
 const {alias}=await params;
 if(alias.length<3||alias.length>100||!aliasPattern.test(alias))return unavailable();
 try{
  const service=createServiceClient();
  if(!service)return new NextResponse('Service momentanément indisponible.',{status:503});
  const {data:link,error}=await service.from('site_public_links')
   .select('site_id,company_id').eq('alias',alias).maybeSingle();
  if(error)return new NextResponse('Service momentanément indisponible.',{status:503});
  if(!link)return unavailable();
  const {data:site,error:siteError}=await service.from('sites')
   .select('id,company_id,status').eq('id',link.site_id).eq('company_id',link.company_id).maybeSingle();
  if(siteError||!site||site.status!=='active')return unavailable();
  const {data:company,error:companyError}=await service.from('companies')
   .select('slug,status').eq('id',link.company_id).maybeSingle();
  if(companyError||!company||!['active','trial'].includes(company.status))return unavailable();
  const redirect=new URL('/wifi/'+encodeURIComponent(company.slug),request.url);
  redirect.searchParams.set('siteId',site.id);
  redirect.searchParams.set('inscription','1');
  return NextResponse.redirect(redirect,307,{
   headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}
  });
 }catch{return new NextResponse('Lien public indisponible.',{status:503});}
}
