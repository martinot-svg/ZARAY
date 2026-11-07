'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';

// This bridge upgrades legacy internal <a> links to Next.js client routing.
// Next <Link> handles its own clicks first (event.defaultPrevented), so it is
// never navigated twice. External links, downloads and modifier keys stay native.
const prefetched=new Set<string>();
const commonModules=new Set([
 '/entreprises','/mon-compte','/tableau-de-bord','/sites','/clients','/offres',
 '/commandes','/abonnements','/tickets','/notifications','/membres',
 '/paiements','/paiements/verification','/parametres-paiement','/portail',
 '/portail/editeur','/gestion-reseau','/finance-globale',
 '/personnalisation-tickets'
]);
function internalDestination(target:EventTarget|null):{anchor:HTMLAnchorElement;href:string;path:string}|null{
 if(!(target instanceof Element))return null;
 const anchor=target.closest('a[href]');
 if(!(anchor instanceof HTMLAnchorElement)||anchor.hasAttribute('download')||
   anchor.getAttribute('target')&&anchor.getAttribute('target')!=='_self'||
   anchor.relList.contains('external')||anchor.hasAttribute('data-native-navigation'))return null;
 const value=anchor.getAttribute('href')||'';
 if(!value||value.startsWith('#')||/^(mailto:|tel:|sms:|javascript:|blob:|data:)/i.test(value))return null;
 let url:URL;
 try{url=new URL(value,window.location.href);}catch{return null;}
 if(!['http:','https:'].includes(url.protocol)||url.origin!==window.location.origin)return null;
 if(/^\/(api|auth|_next|hotspot)\//.test(url.pathname)||
   /\.(?:pdf|csv|zip|png|jpe?g|svg|webp|html|json|ics)$/i.test(url.pathname))return null;
 const href=url.pathname+url.search+url.hash;
 if(url.pathname===window.location.pathname&&url.search===window.location.search&&url.hash)return null;
 return {anchor,href,path:url.pathname};
}
export default function SeamlessNavigation(){
 const router=useRouter();
 useEffect(()=>{
  function click(event:MouseEvent){
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||
      event.altKey||event.shiftKey)return;
   const destination=internalDestination(event.target);
   if(!destination)return;
   event.preventDefault();
   router.push(destination.href,{scroll:true});
  }
  function preload(event:Event){
   const target=internalDestination(event.target);
   if(!target||!commonModules.has(target.path)||prefetched.has(target.href))return;
   if(prefetched.size>35)prefetched.clear();
   prefetched.add(target.href);
   router.prefetch(target.href);
  }
  document.addEventListener('click',click);
  document.addEventListener('pointerover',preload,{passive:true});
  document.addEventListener('focusin',preload);
  return()=>{
   document.removeEventListener('click',click);
   document.removeEventListener('pointerover',preload);
   document.removeEventListener('focusin',preload);
  };
 },[router]);
 return null;
}
