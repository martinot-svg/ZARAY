'use client';
import {useEffect,useState} from 'react';
import WifiVoucherSales from '@/components/wifi-voucher-sales';
import WifiTicketHistoryLegacy from '@/components/wifi-ticket-history-legacy';
export default function WifiTicketHistory(){
 const [companyId,setCompanyId]=useState('');
 useEffect(()=>{
  const requested=new URLSearchParams(location.search).get('companyId')||'';
  if(requested){setCompanyId(requested);return;}
  (async()=>{try{
   const r=await fetch('/api/sites',{cache:'no-store'}),d=await r.json();
   if(r.ok&&d.companies?.[0]?.id)setCompanyId(d.companies[0].id);
  }catch{}})();
 },[]);
 return <div>
  <div className="panel" style={{padding:18,marginBottom:16}}>
   <h2 className="panel-title">Historique des tickets Wi-Fi</h2>
   <p className="muted">Génération, stock, premières connexions Hotspot, durée cumulée et valeur par ticket. Les premières connexions sont comptées une seule fois, même après reconnexions.</p>
  </div>
  {companyId?<WifiVoucherSales companyId={companyId}/>:<p className="muted">Sélectionnez une entreprise pour consulter son historique.</p>}
  <details className="panel" style={{padding:18,marginTop:18}}>
   <summary style={{cursor:'pointer',fontWeight:600}}>Archives des anciens tickets liés aux abonnements</summary>
   <p className="muted">Les anciens codes, liés aux commandes d'abonnement, restent consultables séparément afin de ne pas les mélanger aux tickets préimprimés occasionnels.</p>
   <WifiTicketHistoryLegacy />
  </details>
 </div>;
}
