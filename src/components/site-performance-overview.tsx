'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';

type Period='day'|'week'|'month'|'year';
type CurrencySummary={currency:string;total:string;ticketsAmount:string;subscriptionsAmount:string;ticketsSold:number;subscriptionOrdersPaid:number};
type TrendPoint={currency:string;bucket:string;amount:string};
type SitePerformance={
 period:Period;timezone:string;start:string;end:string;
 currencies:CurrencySummary[];trend:TrendPoint[];
 tickets:{sold:number;stock:number;ready:number;unprepared:number;firstConnections:number};
 subscriptions:{total:number;paidOrders:number;overdue:number;inactive:number;failures:number;waitingActivation:number;failedAttempts:number};
};
const periods:{value:Period;label:string}[]=[
 {value:'day',label:'Jour'},{value:'week',label:'Semaine'},
 {value:'month',label:'Mois'},{value:'year',label:'Année'}
];
function formatMoney(value:string,currency:string){
 const numeric=Number(value);
 if(!Number.isFinite(numeric))return 'Montant indisponible';
 const suffix=currency==='MGA'?'Ar':currency;
 return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(numeric)+' '+suffix;
}
const formatDate=(value:string)=>new Intl.DateTimeFormat('fr-FR',{
 day:'numeric',month:'short',year:'numeric',timeZone:'Indian/Antananarivo'
}).format(new Date(value));
const number=(value:number)=>new Intl.NumberFormat('fr-FR').format(value);
export default function SitePerformanceOverview({companyId,siteId}:{
 companyId:string;siteId:string
}){
 const [period,setPeriod]=useState<Period>('day');
 const [result,setResult]=useState<SitePerformance|null>(null);
 const [busy,setBusy]=useState(true);
 const [revision,setRevision]=useState(0);
 const [error,setError]=useState('');
 const [currency,setCurrency]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  setBusy(true);setError('');
  (async()=>{
   try{
    const params=new URLSearchParams({companyId,siteId,period});
    const response=await fetch('/api/site-performance?'+params.toString(),{
      cache:'no-store',signal:controller.signal
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||'Suivi indisponible.');
    if(!controller.signal.aborted){
      setResult(data as SitePerformance);
      setCurrency(old=>(data.currencies||[]).some((x:CurrencySummary)=>x.currency===old)
       ?old:(data.currencies?.[0]?.currency||''));
    }
   }catch(e){
    if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Indicateurs indisponibles.');
   }finally{if(!controller.signal.aborted)setBusy(false);}
  })();
  return()=>controller.abort();
 },[companyId,siteId,period,revision]);
 const visible=result?.period===period?result:null;
 const trend=useMemo(()=>{
  if(!visible||!currency)return [];
  return visible.trend.filter(p=>p.currency===currency).sort((a,b)=>a.bucket.localeCompare(b.bucket));
 },[visible,currency]);
 const maxValue=Math.max(0,...trend.map(point=>Number(point.amount)||0));
 const query=new URLSearchParams({companyId,siteId}).toString();
 return <section className="site-performance panel" aria-labelledby="site-performance-title">
  <div className="sp-heading">
   <div>
    <span className="sp-eyebrow">ACTIVITÉ DU SITE</span>
    <h2 id="site-performance-title">Revenus, tickets et abonnements</h2>
    <p className="muted">Encaissements confirmés, stock et situation des abonnés.</p>
   </div>
   <button type="button" className="sp-refresh" disabled={busy} onClick={()=>setRevision(v=>v+1)}>
    Actualiser
   </button>
  </div>
  <div className="sp-toolbar">
   <div className="sp-periods" role="group" aria-label="Période financière">
    {periods.map(item=><button type="button" key={item.value}
     className={period===item.value?'is-current':''}
     aria-pressed={period===item.value}
     onClick={()=>setPeriod(item.value)}>{item.label}</button>)}
   </div>
   {visible&&<small className="sp-date">{formatDate(visible.start)} – {formatDate(new Date(new Date(visible.end).getTime()-1).toISOString())} · Madagascar</small>}
  </div>
  {error&&<div className="alert alert-error" role="alert">{error}</div>}
  {busy&&<p role="status" className="sp-pending">Actualisation des données du site…</p>}
  {visible&&<>
   <div className="sp-section-header"><h3>Revenus encaissés</h3><span>Par devise, sans conversion approximative</span></div>
   {visible.currencies.length
    ?<div className="sp-revenue-grid">
      {visible.currencies.map(row=><article className="sp-revenue-card" key={row.currency}>
       <span>Encaissements confirmés · {row.currency}</span>
       <strong>{formatMoney(row.total,row.currency)}</strong>
       <div><span>Tickets : {formatMoney(row.ticketsAmount,row.currency)}</span>
        <span>Abonnements : {formatMoney(row.subscriptionsAmount,row.currency)}</span></div>
      </article>)}
     </div>
    :<div className="sp-no-revenue">Aucun encaissement confirmé sur cette période.</div>}
   <div className="sp-section-header"><h3>Tickets Wi-Fi</h3>
    <Link href={'/tickets?'+query+'&tab=sell'}>Voir le stock et les activations</Link>
   </div>
   <div className="sp-metric-grid">
    {[
     ['Tickets vendus',visible.tickets.sold,'Ventes comptabilisées sur la période'],
     ['Stock non vendu',visible.tickets.stock,'Tickets enregistrés non vendus'],
     ['Prêts à vendre',visible.tickets.ready,'Provisionnés sur MikroTik'],
     ['À préparer',visible.tickets.unprepared,'Sans confirmation réseau'],
     ['Premières connexions',visible.tickets.firstConnections,'Activations réseau sur la période']
    ].map(([label,value,note])=><article className="sp-metric" key={String(label)}>
      <span>{label}</span><strong>{number(Number(value))}</strong><small>{note}</small>
     </article>)}
   </div>
   <div className="sp-section-header"><h3>Abonnements résidentiels</h3>
    <Link href={'/abonnements?'+query}>Voir les abonnés</Link>
   </div>
   <div className="sp-metric-grid">
    {[
     ['Encaissements',visible.subscriptions.paidOrders,'Commandes réglées sur la période'],
     ['En retard',visible.subscriptions.overdue,'Échéances dépassées à ce jour'],
     ['Échecs',visible.subscriptions.failures,'Dernier paiement ou commande en échec'],
     ['Inactifs',visible.subscriptions.inactive,'Non activés ou échéance dépassée'],
     ['À activer',visible.subscriptions.waitingActivation,'Règlement reçu, accès réseau non confirmé']
    ].map(([label,value,note])=><article className="sp-metric" key={String(label)}>
      <span>{label}</span><strong>{number(Number(value))}</strong><small>{note}</small>
     </article>)}
   </div>
   <details className="sp-details">
    <summary>Tendance des encaissements</summary>
    {visible.currencies.length>1&&<label>Devise
     <select value={currency} onChange={e=>setCurrency(e.target.value)}>
      {visible.currencies.map(x=><option key={x.currency} value={x.currency}>{x.currency}</option>)}
     </select>
    </label>}
    {trend.length?<div className="sp-trend" role="list" aria-label={'Encaissements '+currency}>
     {trend.map(point=><div role="listitem" className="sp-trend-row" key={point.bucket}>
      <span>{point.bucket.slice(period==='day'?11:0,period==='year'?7:period==='day'?16:10)}</span>
      <div className="sp-trend-track"><div style={{width:((Number(point.amount)||0)/Math.max(maxValue,1)*100)+'%'}}/></div>
      <strong>{formatMoney(point.amount,currency)}</strong>
     </div>)}
    </div>:<p className="muted">Aucune transaction confirmée pour cette devise.</p>}
    <p className="muted">Seuls les intervalles avec encaissement sont listés ; les périodes sans vente valent zéro.</p>
   </details>
   <details className="sp-details">
    <summary>Comprendre les indicateurs</summary>
    <p>Revenus = paiements d’abonnement confirmés + ventes enregistrées en caisse + ventes historiques de vouchers comptabilisées. La première connexion à un HotSpot ne prouve jamais l’encaissement d’espèces.</p>
    <p>Le stock représente les vouchers non vendus. « Prêts » indique une confirmation de provisionnement réseau ; sans MikroTik, il peut rester à zéro. Les échéances dépassées et les abonnements inactifs peuvent se recouper : ces compteurs ne doivent pas être additionnés.</p>
    <p>Les encaissements suivent la période sélectionnée. Les états « en retard », « échec », « inactif » et « à activer » représentent la situation actuelle. Les tentatives de paiement échouées sur la période : {number(visible.subscriptions.failedAttempts)}.</p>
   </details>
  </>}
 </section>;
}
