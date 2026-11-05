import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {publicResidentialSite} from '@/lib/residential-site-identity';
import ResidentialPaymentStatus from '@/components/residential-payment-status';

export const dynamic='force-dynamic';
type Params={params:Promise<{siteId:string;reference:string}>};
export async function generateMetadata({params}:Params):Promise<Metadata>{
 const {siteId}=await params;
 const site=await publicResidentialSite(siteId).catch(()=>null);
 const name=site?.brandName||'Votre fournisseur';
 return {
  title:'Paiement | '+name,applicationName:name,robots:{index:false,follow:false},
  description:'Suivi du paiement de votre abonnement Internet.',
  manifest:null,icons:{icon:[{url:'/api/public/residential-icon?siteId='+encodeURIComponent(siteId)}]}
 };
}
export default async function BrandedPaymentPage({params}:Params){
 const {siteId,reference}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(siteId)
  ||!/^[A-Fa-f0-9]{12}$/.test(reference))notFound();
 const site=await publicResidentialSite(siteId);
 if(!site)notFound();
 return <ResidentialPaymentStatus site={site} reference={reference.toUpperCase()}/>;
}
