import {NextRequest,NextResponse} from 'next/server';
import {publicResidentialSite} from '@/lib/residential-site-identity';
import {subscriberAccountName} from '@/lib/residential-site-labels';

export const dynamic='force-dynamic';
type Context={params:Promise<{siteId:string}>};

export async function GET(_request:NextRequest,{params}:Context){
 const {siteId}=await params;
 const identity=await publicResidentialSite(siteId).catch(()=>null);
 if(!identity)return NextResponse.json({error:'Site indisponible.'},{status:404,
  headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
 const name=subscriberAccountName(identity);
 const entry='/mon-internet/'+identity.siteId;
 const icon='/api/public/residential-app-icon?siteId='+encodeURIComponent(identity.siteId);
 return NextResponse.json({
  id:entry,
  name,
  short_name:(identity.siteName||identity.brandName).trim().slice(0,30),
  description:'Consultez votre abonnement Internet auprès de '+identity.brandName+'.',
  lang:'fr',dir:'ltr',start_url:entry,scope:entry,display:'standalone',
  background_color:identity.secondaryColor,theme_color:identity.primaryColor,
  icons:[
   {src:icon+'&size=192',sizes:'192x192',type:'image/png',purpose:'any'},
   {src:icon+'&size=512',sizes:'512x512',type:'image/png',purpose:'any'}
  ]
 },{
  headers:{
   'Content-Type':'application/manifest+json; charset=utf-8',
   'Cache-Control':'private, no-store',
   'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'
  }
 });
}
