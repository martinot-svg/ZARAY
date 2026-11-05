import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {publicResidentialSite} from '@/lib/residential-site-identity';
import ResidentialAccountPortal from '@/components/residential-account-portal';

export const dynamic='force-dynamic';
type Context={params:Promise<{siteId:string}>};
export async function generateMetadata({params}:Context):Promise<Metadata>{
 const {siteId}=await params;
 const identity=await publicResidentialSite(siteId).catch(()=>null);
 const name=identity?.brandName||'Mon Internet';
 return {
  title:'Mon Internet | '+name,
  applicationName:name,
  description:'Consultez votre abonnement et vos paiements auprès de votre fournisseur Internet.',
  robots:{index:false,follow:false},
  icons:{icon:[{url:'/api/public/residential-icon?siteId='+encodeURIComponent(siteId)}],
    apple:[{url:'/api/public/residential-icon?siteId='+encodeURIComponent(siteId)}]},
  manifest:null,
 };
}
export default async function ResidentialAccountPage({params}:Context){
 const {siteId}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(siteId))notFound();
 return <ResidentialAccountPortal siteId={siteId}/>;
}
