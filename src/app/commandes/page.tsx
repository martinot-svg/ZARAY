'use client';

import {useEffect,useMemo,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {
  AlertCircle,ArrowRight,CalendarDays,CheckCircle2,ChevronLeft,ChevronRight,
  Clock3,CreditCard,FileText,History,ListFilter,Receipt,RefreshCw,
  Search,ShoppingCart,UserRound,Wallet,Wifi,X
} from 'lucide-react';
import AppShell from '@/components/app-shell';
import {MotionFeedback} from '@/components/motion';
import {activeSiteId,selectedCompany,scopedQuery} from '@/lib/workspace-url';
import './orders-workspace.css';

type Company={id:string;legal_name:string;role:string};
type Site={id:string;company_id:string;name:string};
type Order={
  id:string;company_id:string;site_id:string|null;customer_id:string|null;
  public_reference:string;customer_name:string;customer_email:string;customer_phone:string|null;
  offer_name:string;amount:number|string;currency:string;status:string;
  created_at:string;paid_at:string|null;activated_at:string|null;
};
type CashReceipt={receipt_number:string;public_reference:string;customer_name:string;offer_name:string;amount:number|string;currency:string;paid_at:string;payment_method:string};
type Stats={total:number;unpaid:number;paid:number;activation:number};
type Tab='all'|'pending'|'history';
const initialStats:Stats={total:0,unpaid:0,paid:0,activation:0};
const statuses:Record<string,string>={
 pending_payment:'Paiement en attente',paid:'Payée',
 activation_pending:'Activation en attente',active:'Service actif',
 cancelled:'Annulée',expired:'Expirée',failed:'Échec'
};
const pending=new Set(['pending_payment','paid','activation_pending','failed']);
const historical=new Set(['active','cancelled','expired']);
const perPage=25;
function dateLabel(iso:string|null){return iso?new Date(iso).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'}):'—';}
function money(amount:number|string,currency:string){return Number(amount).toLocaleString('fr-FR')+' '+(currency==='MGA'?'Ar':currency);}
function statusTone(status:string){
 if(status==='active')return 'success';
 if(status==='pending_payment'||status==='activation_pending'||status==='paid')return 'warning';
 if(status==='cancelled'||status==='expired'||status==='failed')return 'danger';
 return 'neutral';
}
function Timeline({order}:{order:Order}){
 const stages=[
  {label:'Souscription enregistrée',value:dateLabel(order.created_at),done:true},
  {label:'Paiement confirmé',value:order.paid_at?dateLabel(order.paid_at):'En attente de vérification ou d’encaissement',done:Boolean(order.paid_at)},
  {label:'Activation du service',value:order.activated_at?dateLabel(order.activated_at):'Non confirmée par le réseau',done:Boolean(order.activated_at)}
 ];
 return <ol className="co-timeline">{stages.map((stage,i)=><li key={i} className={stage.done?'co-timeline-done':'co-timeline-pending'}>
  <span className="co-timeline-dot">{stage.done?<CheckCircle2 size={18}/>:<Clock3 size={18}/>}</span>
  <div><strong>{stage.label}</strong><small>{stage.value}</small></div>
 </li>)}</ol>;
}
export default function OrdersWorkspace(){
 const [companies,setCompanies]=useState<Company[]>([]);
 const [sites,setSites]=useState<Site[]>([]);
 const [companyId,setCompanyId]=useState('');
 const [orders,setOrders]=useState<Order[]>([]);
 const [stats,setStats]=useState<Stats>(initialStats);
 const [tab,setTab]=useState<Tab>('all');
 const [status,setStatus]=useState('all');
 const [searchField,setSearchField]=useState('');
 const [search,setSearch]=useState('');
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const [page,setPage]=useState(1);
 const [total,setTotal]=useState(0);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [busy,setBusy]=useState(true);
 const [checking,setChecking]=useState(false);
 const [canReview,setCanReview]=useState(false);
 const [recordingId,setRecordingId]=useState('');
 const [receipt,setReceipt]=useState<CashReceipt|null>(null);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [refresh,setRefresh]=useState(0);

 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const response=await fetch('/api/sites',{cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Entreprises indisponibles.');
    if(!active)return;
    setCompanies(data.companies||[]);
    setSites(data.sites||[]);
    setCompanyId(selectedCompany(data.companies||[],data.sites||[]));
   }catch(e){if(active)setError(e instanceof Error?e.message:'Contexte inaccessible.');}
   finally{if(active)setBusy(false);}
  })();
  return()=>{active=false;};
 },[]);

 useEffect(()=>{
  if(!companyId)return;
  const member=companies.find(c=>c.id===companyId);
  if(!member||!['owner','admin'].includes(member.role)){setCanReview(false);return;}
  let active=true;
  (async()=>{
   try{
    const r=await fetch('/api/manual-payments/access?companyId='+encodeURIComponent(companyId),{cache:'no-store'});
    const d=await r.json();
    if(active)setCanReview(r.ok&&d.canReview===true);
   }catch{if(active)setCanReview(false);}
  })();
  return()=>{active=false;};
 },[companyId,companies]);

 useEffect(()=>{
  if(!companyId){setOrders([]);setStats(initialStats);return;}
  let active=true;
  setChecking(true);setError('');
  const params=new URLSearchParams(scopedQuery(companyId));
  params.set('tab',tab);
  params.set('status',status);
  params.set('page',String(page));
  params.set('pageSize',String(perPage));
  if(search)params.set('search',search);
  if(from)params.set('from',from);
  if(to)params.set('to',to);
  (async()=>{
   try{
    const r=await fetch('/api/subscription-orders?'+params.toString(),{cache:'no-store'});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Impossible de charger les commandes.');
    if(!active)return;
    setOrders(d.orders||[]);
    setStats(d.stats||initialStats);
    setTotal(Number(d.total)||0);
   }catch(e){if(active){setOrders([]);setTotal(0);setStats(initialStats);setError(e instanceof Error?e.message:'Chargement impossible.');}}
   finally{if(active)setChecking(false);}
  })();
  return()=>{active=false;};
 },[companyId,tab,status,search,from,to,page,refresh]);

 const selected=useMemo(()=>orders.find(o=>o.id===selectedId)||null,[orders,selectedId]);
 const siteName=(siteId:string|null)=>sites.find(site=>site.id===siteId)?.name||'Site non attribué';
 const activeCompany=companies.find(c=>c.id===companyId);
 const activeScope=activeSiteId();
 const context=companyId?'?'+scopedQuery(companyId):'';
 const totalPages=Math.max(1,Math.ceil(total/perPage));

 function changeTab(t:Tab){setTab(t);setStatus('all');setPage(1);setSelectedId(null);setReceipt(null);}
 function changeStatus(s:string){setStatus(s);setPage(1);setSelectedId(null);}
 function changePeriod(key:'from'|'to',value:string){if(key==='from')setFrom(value);else setTo(value);setPage(1);setSelectedId(null);}
 function applySearch(event:FormEvent<HTMLFormElement>){event.preventDefault();setSearch(searchField.trim());setPage(1);setSelectedId(null);}
 function clearFilters(){setSearchField('');setSearch('');setStatus('all');setFrom('');setTo('');setPage(1);setSelectedId(null);}
 function viewOrder(o:Order){setSelectedId(selectedId===o.id?null:o.id);setReceipt(null);}
 async function collectCash(order:Order){
  if(order.status!=='pending_payment'||!window.confirm('Avez-vous réellement reçu '+money(order.amount,order.currency)+' en espèces de '+order.customer_name+' ? Confirmer l’encaissement et émettre le reçu ?'))return;
  setRecordingId(order.id);setError('');setNotice('');setReceipt(null);
  try{
   const r=await fetch('/api/subscription-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:order.id})});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Encaissement impossible.');
   setReceipt(d.receipt as CashReceipt);
   setOrders(previous=>previous.map(o=>o.id===order.id?{...o,status:'paid',paid_at:d.receipt.paid_at}:o));
   setNotice('Paiement en espèces enregistré. Le reçu peut être imprimé ; l’accès Internet reste distinct.');
   setRefresh(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:'Encaissement impossible.');}
  finally{setRecordingId('');}
 }

 return <AppShell activePath="/commandes" eyebrow="COMMERCIAL · SOUSCRIPTIONS" title="Gestion des commandes"
  description="Retrouvez les demandes d’abonnement créées automatiquement sur vos portails, suivez les paiements et l’activation, sans saisie manuelle."
  actions={<button type="button" className="co-refresh" onClick={()=>setRefresh(v=>v+1)} disabled={checking||!companyId}><RefreshCw size={17}/> Actualiser</button>}>
  <div className="co-page">
   <div className="co-context"><span>Entreprise : <strong>{activeCompany?.legal_name||'—'}</strong></span><span>Site : <strong>{activeScope?siteName(activeScope):'Tous les sites'}</strong></span><span>Les chiffres concernent la période sélectionnée.</span></div>
   <section className="co-metrics" aria-label="Indicateurs des commandes">
    {([
      {key:'total',label:'Total des commandes',note:'Toutes les souscriptions',icon:ShoppingCart},
      {key:'unpaid',label:'Paiement en attente',note:'Commandes non réglées',icon:Clock3},
      {key:'paid',label:'Paiements confirmés',note:'Encaissements enregistrés',icon:CheckCircle2},
      {key:'activation',label:'À activer',note:'Payées, sans activation',icon:Wifi}
    ] as const).map(k=><article className="co-metric" key={k.key}><div className="co-metric-head"><span>{k.label}</span><k.icon size={18}/></div><strong>{stats[k.key].toLocaleString('fr-FR')}</strong><small>{k.note}</small></article>)}
   </section>

   <section className="co-workspace" aria-label="Registre des commandes">
    <header className="co-workspace-header"><div><h2>Répertoire des commandes</h2><p>Chaque ligne correspond à une souscription enregistrée automatiquement.</p></div><span className="co-count">{total.toLocaleString('fr-FR')} résultat{total!==1?'s':''}</span></header>
    <div role="tablist" aria-label="Catégorie des commandes" className="co-tabs">
     <button type="button" role="tab" aria-selected={tab==='all'} onClick={()=>changeTab('all')}><ListFilter size={16}/> Toutes les commandes</button>
     <button type="button" role="tab" aria-selected={tab==='pending'} onClick={()=>changeTab('pending')}><Clock3 size={16}/> À traiter</button>
     <button type="button" role="tab" aria-selected={tab==='history'} onClick={()=>changeTab('history')}><History size={16}/> Historique</button>
    </div>
    <div className="co-filters">
     <form onSubmit={applySearch} role="search" className="co-search"><Search size={17}/><input aria-label="Rechercher une commande" placeholder="Client, référence, téléphone, offre…" value={searchField} onChange={e=>setSearchField(e.target.value)} maxLength={80}/><button type="submit">Rechercher</button></form>
     <label>Statut<select value={status} onChange={e=>changeStatus(e.target.value)}><option value="all">Tous</option><option value="pending_payment">Paiement attendu</option><option value="paid">Payée</option><option value="activation_pending">À activer</option><option value="active">Active</option><option value="failed">Échec</option><option value="cancelled">Annulée</option><option value="expired">Expirée</option></select></label>
     <label>Du<input type="date" value={from} max={to||undefined} onChange={e=>changePeriod('from',e.target.value)}/></label>
     <label>Au<input type="date" value={to} min={from||undefined} onChange={e=>changePeriod('to',e.target.value)}/></label>
     {(search||status!=='all'||from||to)&&<button type="button" className="co-clear" onClick={clearFilters}><X size={15}/> Effacer</button>}
    </div>
    {error&&<div className="co-error" role="alert"><AlertCircle size={17}/>{error}</div>}
    {busy||checking?<div className="co-empty" role="status">Chargement des commandes…</div>:!companyId?<div className="co-empty">Sélectionnez une entreprise accessible.</div>:orders.length===0?<div className="co-empty"><ShoppingCart size={29}/><strong>Aucune commande dans cette sélection.</strong><p>Les nouvelles demandes de souscription apparaîtront ici automatiquement depuis le portail client.</p>{(search||status!=='all'||from||to)&&<button type="button" onClick={clearFilters}>Réinitialiser les filtres</button>}</div>:<>
      <div className="co-table-wrap"><table className="co-table"><thead><tr><th>Commande</th><th>Client</th><th>Offre</th><th>Montant</th><th>État</th><th>Date</th><th>Action</th></tr></thead><tbody>{orders.map(o=><tr key={o.id} className={selectedId===o.id?'co-selected':''}>
       <td><strong>{o.public_reference}</strong><small>{siteName(o.site_id)}</small></td>
       <td><strong>{o.customer_name}</strong><small>{o.customer_phone||o.customer_email}</small></td>
       <td>{o.offer_name}</td><td className="co-money">{money(o.amount,o.currency)}</td>
       <td><span className={'co-status co-'+statusTone(o.status)}>{statuses[o.status]||o.status}</span></td>
       <td>{dateLabel(o.created_at)}</td>
       <td><button type="button" className="co-open" onClick={()=>viewOrder(o)} aria-expanded={selectedId===o.id}>{selectedId===o.id?'Fermer':'Détails'} <ArrowRight size={15}/></button></td>
      </tr>)}</tbody></table></div>
      <div className="co-pagination"><span>Page {page} sur {totalPages} · {orders.length} commande{orders.length!==1?'s':''} affichée{orders.length!==1?'s':''}</span><div><button type="button" disabled={page<=1||checking} onClick={()=>{setPage(v=>v-1);setSelectedId(null);}} aria-label="Page précédente"><ChevronLeft size={17}/></button><button type="button" disabled={page>=totalPages||checking} onClick={()=>{setPage(v=>v+1);setSelectedId(null);}} aria-label="Page suivante"><ChevronRight size={17}/></button></div></div>
    </>}
   </section>

   {selected&&<section className="co-detail" aria-labelledby="co-detail-title">
    <div className="co-detail-header"><div><span className="co-overline">DOSSIER COMMERCIAL · {selected.public_reference}</span><h2 id="co-detail-title">Détails de la commande</h2></div><button type="button" onClick={()=>{setSelectedId(null);setReceipt(null);}} aria-label="Fermer le détail"><X size={19}/></button></div>
    <div className="co-detail-grid"><div className="co-detail-main">
      <div className="co-client"><span className="co-client-avatar"><UserRound size={22}/></span><div><strong>{selected.customer_name}</strong><span>{selected.customer_email}</span>{selected.customer_phone&&<span>{selected.customer_phone}</span>}</div></div>
      <div className="co-detail-data"><div><span>Forfait commandé</span><strong>{selected.offer_name}</strong></div><div><span>Montant figé</span><strong>{money(selected.amount,selected.currency)}</strong></div><div><span>Site</span><strong>{siteName(selected.site_id)}</strong></div><div><span>Référence</span><strong>{selected.public_reference}</strong></div></div>
      <div className="co-detail-actions">
       {selected.status==='pending_payment'&&['owner','admin'].includes(activeCompany?.role||'')&&<button type="button" className="co-cash" disabled={!!recordingId} onClick={()=>void collectCash(selected)}><Wallet size={17}/>{recordingId===selected.id?'Encaissement…':'Encaisser en espèces et créer le reçu'}</button>}
       <Link className="co-secondary" href={'/paiement/'+encodeURIComponent(selected.public_reference)}><CreditCard size={17}/> Suivi du paiement</Link>
       {canReview&&<Link className="co-secondary" href={'/paiements/verification'+context+'&orderRef='+encodeURIComponent(selected.public_reference)}><FileText size={17}/> Vérifier les justificatifs</Link>}
       <Link className="co-secondary" href={'/clients'+context}><UserRound size={17}/> Répertoire Clients</Link>
      </div>
      <p className="co-warning">Une inscription ou un paiement ne signifie pas que l’accès Internet est actif. L’état du réseau est confirmé séparément.</p>
    </div><div className="co-tracking"><h3>Historique des étapes</h3><Timeline order={selected}/>{selected.status==='failed'&&<div className="co-error"><AlertCircle size={16}/> Échec signalé : vérifiez l’état réseau dans le module 10.</div>}</div></div>
   </section>}
   {receipt&&<section className="co-receipt" id="cash-receipt" aria-label="Reçu de paiement en espèces">
    <div className="co-receipt-head"><Receipt size={19}/><strong>Reçu de paiement d’abonnement · Espèces</strong></div>
    <div><strong>ZARAY · Reçu</strong><p>Reçu n° {receipt.receipt_number}</p><p>Commande : {receipt.public_reference}</p><p>Client : {receipt.customer_name}</p><p>Abonnement : {receipt.offer_name}</p><h2>{money(receipt.amount,receipt.currency)}</h2><p>Payé le {dateLabel(receipt.paid_at)}</p><small>Ce reçu confirme le règlement. Il ne constitue pas un ticket Wi-Fi ni une preuve d’activation réseau.</small></div>
    <button className="co-cash co-print-button" type="button" onClick={()=>window.print()}><Receipt size={17}/> Imprimer le reçu</button>
   </section>}
   <div className="co-bottom-links"><Link href={'/offres'+context}>Offres <ArrowRight size={14}/></Link><Link href={'/tickets'+context}>Tickets Wi-Fi <ArrowRight size={14}/></Link><Link href={'/paiements'+context}>Paiements <ArrowRight size={14}/></Link><Link href={'/tableau-de-bord'+context}>Tableau de bord <ArrowRight size={14}/></Link></div>
   <MotionFeedback message={notice} kind="success"/>
  </div>
 </AppShell>;
}
