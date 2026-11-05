import {NextRequest,NextResponse} from 'next/server';
import {publicResidentialSite} from '@/lib/residential-site-identity';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 try{
  const site=await publicResidentialSite(siteId);
  if(!site)return new Response(null,{status:404});
  const logo=site.logoDataUri;
  if(logo){
   const match=/^data:image\/(png|jpeg|webp);base64,(.*)$/.exec(logo);
   if(match){
    const buffer=Buffer.from(match[2],'base64');
    return new Response(new Uint8Array(buffer),{headers:{
     'Content-Type':'image/'+match[1],'Cache-Control':'public,max-age=300',
     'X-Content-Type-Options':'nosniff'
    }});
   }
  }
  const name=(site.brandName||site.siteName).trim().slice(0,1).toUpperCase().replace(/[<>&"']/g,'');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="'+site.primaryColor+'"/><text x="32" y="45" text-anchor="middle" font-family="Arial,sans-serif" font-size="39" font-weight="700" fill="white">'+name+'</text></svg>';
  return new Response(svg,{headers:{'Content-Type':'image/svg+xml','Cache-Control':'public,max-age=300','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response(null,{status:503});}
}
