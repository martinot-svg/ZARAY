import {NextRequest,NextResponse} from 'next/server';
import {createServiceClient} from '@/lib/supabase/service';
import {merchantForSite} from '@/lib/fiveonepay-server';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
export async function GET(request:NextRequest){
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});
 if(!uuid.test(siteId))return json({available:false},400);
 try{
  const service=createServiceClient();
  if(!service)return json({available:false});
  const {data:site,error}=await service.from('sites')
   .select('id,company_id,status').eq('id',siteId).maybeSingle();
  if(error||!site||site.status!=='active')return json({available:false});
  const {data:company}=await service.from('companies')
   .select('status').eq('id',site.company_id).maybeSingle();
  if(!company||!['active','trial'].includes(company.status))return json({available:false});
  const merchant=await merchantForSite(site.company_id,siteId);
  return json({available:!!merchant,environment:merchant?.environment||null});
 }catch{return json({available:false});}
}
