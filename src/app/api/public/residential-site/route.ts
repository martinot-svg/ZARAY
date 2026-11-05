import {NextRequest,NextResponse} from 'next/server';
import {publicResidentialSite} from '@/lib/residential-site-identity';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request:NextRequest){
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 if(!/^[0-9a-f-]{36}$/i.test(siteId))return NextResponse.json({error:'Site invalide.'},{status:400,headers});
 try{
  const identity=await publicResidentialSite(siteId);
  return identity?NextResponse.json({site:identity},{headers})
    :NextResponse.json({error:'Site indisponible.'},{status:404,headers});
 }catch{return NextResponse.json({error:'Identité du site indisponible.'},{status:503,headers});}
}
