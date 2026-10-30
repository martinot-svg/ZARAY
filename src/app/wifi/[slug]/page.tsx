import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import PublicWifiPortal from '@/components/public-wifi-portal';
type Context={params:Promise<{slug:string}>};
export const dynamic='force-dynamic';
export const metadata:Metadata={
 title:'Portail Wi-Fi client | ZARAY',
 description:'Portail Wi-Fi unifié de votre fournisseur : tickets occasionnels et inscription aux abonnements résidentiels.',
};
export default async function WifiCompanyPage({params}:Context){
 const {slug}=await params;
 if(!/^[a-z0-9-]{2,80}$/i.test(slug))notFound();
 return <PublicWifiPortal slug={slug.toLowerCase()}/>;
}
