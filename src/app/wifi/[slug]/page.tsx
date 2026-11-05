import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {publicResidentialSite} from '@/lib/residential-site-identity';
import PublicWifiPortal from '@/components/public-wifi-portal';
type Context={params:Promise<{slug:string}>;searchParams:Promise<{siteId?:string;inscription?:string}>};
export const dynamic='force-dynamic';
export async function generateMetadata({params,searchParams}:Context):Promise<Metadata>{
 const {slug}=await params;
 const {siteId}=await searchParams;
 const identity=siteId?await publicResidentialSite(siteId).catch(()=>null):null;
 const allowed=identity?.companySlug===slug.toLowerCase()?identity:null;
 return {
  title:'Portail Internet | '+(allowed?.brandName||'Votre fournisseur'),
  applicationName:allowed?.brandName||'Portail Internet',
  description:'Accédez à Internet et à votre abonnement chez votre fournisseur.',
  manifest:null,
  icons:allowed?{icon:[{url:'/api/public/residential-icon?siteId='+encodeURIComponent(allowed.siteId)}]}:undefined,
 };
}
export default async function WifiCompanyPage({params,searchParams}:Context){
 const {slug}=await params;
 const {siteId,inscription}=await searchParams;
 if(!/^[a-z0-9-]{2,80}$/i.test(slug))notFound();
 return <PublicWifiPortal slug={slug.toLowerCase()} linkedSiteId={siteId||''} startInSubscription={inscription==='1'}/>;
}
