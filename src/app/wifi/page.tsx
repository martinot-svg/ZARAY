import type {Metadata} from 'next';
import PublicWifiPortal from '@/components/public-wifi-portal';
export const metadata:Metadata={
 title:'Portail captif Wi-Fi — Démonstration | ZARAY',
 description:'Découvrez le portail Wi-Fi ZARAY : tickets occasionnels et abonnements résidentiels, avant l’installation sur MikroTik.',
};
export default function WifiPreviewPage(){return <PublicWifiPortal/>;}
