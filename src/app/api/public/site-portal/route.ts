import {NextRequest,NextResponse} from 'next/server';
import {createServiceClient} from '@/lib/supabase/service';
import {readPortalConfig} from '@/lib/site-portal-config';

export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers={'Cache-Control':'public, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});

/** Only the explicitly published snapshot is visible on an active site.
 * Drafts, actor IDs, credentials and private organization data never leave the server.
 */
export async function GET(request:NextRequest){
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 if(!uuid.test(siteId))return json({error:'Site invalide.'},400);
 try{
  const service=createServiceClient();
  if(!service)return json({error:'Service indisponible.'},503);
  const {data:site,error:siteError}=await service.from('sites')
   .select('id,company_id,status').eq('id',siteId).eq('status','active').maybeSingle();
  if(siteError)throw Error('Site indisponible');
  if(!site)return json({error:'Site indisponible.'},404);
  const [{data:company,error:companyError},{data:row,error:readError}]=await Promise.all([
   service.from('companies').select('slug,status').eq('id',site.company_id).maybeSingle(),
   service.from('site_portal_configs').select('published,published_version')
    .eq('company_id',site.company_id).eq('site_id',siteId).maybeSingle()
  ]);
  if(companyError||readError)throw Error('Portail indisponible');
  if(!company||!['trial','active'].includes(company.status))
   return json({error:'Portail indisponible.'},404);
  const published=readPortalConfig(row?.published);
  return json({companySlug:company.slug,siteId,published:published??null,
   version:published?row?.published_version:0});
 }catch{return json({error:'Portail temporairement indisponible.'},503);}
}
