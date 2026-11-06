import {NextRequest} from 'next/server';
import sharp from 'sharp';
import {publicResidentialSite} from '@/lib/residential-site-identity';

export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function GET(request:NextRequest){
 const siteId=request.nextUrl.searchParams.get('siteId')||'';
 const size=Number(request.nextUrl.searchParams.get('size'));
 if(size!==180&&size!==192&&size!==512)return new Response(null,{status:400});
 try{
  const site=await publicResidentialSite(siteId);
  if(!site)return new Response(null,{status:404});
  const logo=site.logoDataUri;
  const data=logo?.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i);
  let png:Buffer;
  if(data){
   const source=Buffer.from(data[2],'base64');
   png=await sharp(source,{limitInputPixels:5000000})
    .resize(size,size,{fit:'contain',background:site.secondaryColor})
    .png().toBuffer();
  }else{
   const character=(site.siteName||site.brandName).trim().slice(0,1).toUpperCase()
    .replace(/[<>&"'\\]/g,'');
   const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+size+
    '" height="'+size+'" viewBox="0 0 512 512"><rect width="512" height="512" rx="105" fill="'+
    site.primaryColor+'"/><text x="256" y="348" text-anchor="middle" font-family="Arial,sans-serif" '+
    'font-size="300" font-weight="bold" fill="'+site.secondaryColor+'">'+character+'</text></svg>';
   png=await sharp(Buffer.from(svg)).png().toBuffer();
  }
  return new Response(new Uint8Array(png),{headers:{
   'Content-Type':'image/png','Cache-Control':'public,max-age=300',
   'X-Content-Type-Options':'nosniff'
  }});
 }catch{return new Response(null,{status:503});}
}
