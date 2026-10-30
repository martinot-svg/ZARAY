'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {AlertCircle,ArrowRight,BadgeCheck,CalendarClock,CheckCircle2,ChevronLeft,ChevronRight,Clock3,House,RefreshCw,Search,Wifi,WifiOff,Wallet} from 'lucide-react';
import AppShell from '@/components/app-shell';
import {activeSiteId,scopedQuery,selectedCompany} from '@/lib/workspace-url';
import './residential-subscriptions.css';
type Company={id:string;legal_name:string;role:string};
type Site={id:string;company_id:string;name:string;status:string};
type Sub={id:string;company_id:string;customer_id:string;site_id:string|null;offer_name:string;validity_days:number;paid_cycles:number;activated_cycles:number;last_paid_at:string|null;activated_at:string|null;expires_at:string|null;created_at:string;customers:{full_name:string;email:string|null;phone:string|null}|null};
type Cycle={id:string;order_id:string;paid_at:string;activated_at:string|null;period_start:string|null;period_end:string|null;validity_days:number;offer_name:string;amount:number|string;currency:string};
type Summary={total:number;active:number;expiring:number;expired:number;waiting_payment:number;waiting_activation:number};
type Status='all'|'active'|'expiring'|'expired'|'waiting_payment'|'waiting_activation';
const initial:Summary={total:0,active:0,expiring:0,expired:0,waiting_payment:0,waiting_activation:0};
const perPage=25;
const date=(v:string|null)=>v?new Date(v).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'—';
const money=(v:number|string,c:string)=>Number(v).toLocaleString('fr-FR')+' '+(c==='MGA'?'Ar':c);
function stateOf(s:Sub){
 if(s.paid_cycles===0)return {label:'Paiement attendu',tone:'warning',detail:'Le client est inscrit mais aucun règlement n’est confirmé.'};
 if(!s.expires_at)return {label:'À activer',tone:'warning',detail:'Le paiement est confirmé, mais le début du service réseau reste à confirmer.'};
 const remaining=new Date(s.expires_at).getTime()-Date.now();
 if(remaining<=0)return s.paid_cycles>s.activated_cycles
   ?{label:'Renouvellement à activer',tone:'warning',detail:'Le renouvellement est payé, mais sa nouvelle période réseau n’est pas confirmée.'}
   :{label:'Période expirée',tone:'danger',detail:'La période déclarée est expirée. Vérifiez le routeur avant toute décision.'};
 if(remaining<=7*86400000)return {label:'Échéance proche',tone:'warning',detail:'La période d’abonnement approche de son échéance.'};
 return {label:'Période en cours',tone:'success',detail:'Période enregistrée. Vérifiez séparément la synchronisation effective avec le routeur.'};
}
export default function ResidentialPage(){
 const [companies,setCompanies]=useState<Company[]>([]);
 const [sites,setSites]=useState<Site[]>([]);
 const [companyId,setCompanyId]=useState('');
 const [rows,setRows]=useState<Sub[]>([]);
 const [summary,setSummary]=useState<Summary>(initial);
 const [total,setTotal]=useState(0);
 const [page,setPage]=useState(1);
 const [status,setStatus]=useState<Status>('all');
 const [input,setInput]=useState('');
 const [search,setSearch]=useState('');
 const [selectedId,setSelectedId]=useState('');
 const [detail,setDetail]=useState<Sub|null>(null);
 const [cycles,setCycles]=useState<Cycle[]>([]);
 const [renewalRef,setRenewalRef]=useState('');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [renewing,setRenewing]=useState(false);
 const [assigning,setAssigning]=useState(false);
 const [assignmentSiteId,setAssignmentSiteId]=useState('');
 const [refresh,setRefresh]=useState(0);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{let live=true;(async()=>{try{
  const r=await fetch('/api/sites',{cache:'no-store'});const d=await r.json();
  if(!r.ok)throw Error(d.error||'Entreprise indisponible.');
  if(live){setCompanies(d.companies||[]);setSites(d.sites||[]);setCompanyId(selectedCompany(d.companies||[],d.sites||[]));}
 }catch(e){if(live)setError(e instanceof Error?e.message:'Contexte indisponible.');}
 finally{if(live)setLoading(false);}})();return()=>{live=false};},[]);
 useEffect(()=>{
  if(!companyId){setRows([]);setSummary(initial);return;}
  let live=true;const q=new URLSearchParams(scopedQuery(companyId));
  q.set('state',status);q.set('page',String(page));q.set('pageSize',String(perPage));if(search)q.set('search',search);
  setBusy(true);setError('');
  (async()=>{try{
   const r=await fetch('/api/residential-subscriptions?'+q.toString(),{cache:'no-store'});const d=await r.json();
   if(!r.ok)throw Error(d.error||'Abonnements indisponibles.');
   if(live){setRows(d.subscriptions||[]);setSummary(d.summary||initial);setTotal(d.total||0);}
  }catch(e){if(live){setRows([]);setError(e instanceof Error?e.message:'Chargement impossible.');}}
  finally{if(live)setBusy(false);}})();
  return()=>{live=false};
 },[companyId,status,page,search,refresh]);
 useEffect(()=>{
  if(!companyId||!selectedId){setDetail(null);setCycles([]);return;}
  let live=true;const q=new URLSearchParams(scopedQuery(companyId));q.set('subscriptionId',selectedId);
  (async()=>{try{
   const r=await fetch('/api/residential-subscriptions?'+q.toString(),{cache:'no-store'});const d=await r.json();
   if(!r.ok)throw Error(d.error||'Détail indisponible.');
   if(live){setDetail(d.subscriptions?.[0]||null);setCycles(d.cycles||[]);}
  }catch(e){if(live)setError(e instanceof Error?e.message:'Historique indisponible.');}})();
  return()=>{live=false};
 },[companyId,selectedId,refresh]);
 const company=companies.find(c=>c.id===companyId);
 const siteName=(v:string|null)=>sites.find(s=>s.id===v)?.name||'Non attribué';
 const context=companyId?'?'+scopedQuery(companyId):'';
 const canRenew=['owner','admin','sales','site_manager'].includes(company?.role||'');
 const canAssign=['owner','admin'].includes(company?.role||'');
 const availableSites=sites.filter(site=>site.company_id===companyId&&['planned','active'].includes(site.status));
 const totalPages=Math.max(1,Math.ceil(total/perPage));
 const groups=[
  {key:'all',label:'Tous'},
  {key:'active',label:'En cours'},
  {key:'expiring',label:'Bientôt expirés'},
  {key:'waiting_activation',label:'À activer'},
  {key:'waiting_payment',label:'À payer'},
  {key:'expired',label:'Expirés'}
 ] as const;
 function switchStatus(next:Status){setStatus(next);setPage(1);setSelectedId('');setRenewalRef('');}
 function onSearch(e:FormEvent<HTMLFormElement>){e.preventDefault();setSearch(input.trim());setPage(1);setSelectedId('');}
 function reset(){setInput('');setSearch('');switchStatus('all');}
 async function assignSite(){
  if(!detail||!canAssign||!assignmentSiteId)return;
  if(!window.confirm('Associer cet abonné au site sélectionné ? Cette opération rattache aussi les commandes sans site et ne doit pas modifier un accès déjà provisionné.'))return;
  setAssigning(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/residential-subscriptions',{method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,subscriptionId:detail.id,siteId:assignmentSiteId})});
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'Affectation impossible.');
   setNotice(d.message||'Site associé à l’abonnement.');
   setRefresh(v=>v+1);setAssignmentSiteId('');
  }catch(e){setError(e instanceof Error?e.message:'Impossible d’affecter le site.');}
  finally{setAssigning(false);}
 }
 async function renew(){
  if(!detail||!canRenew)return;
  if(!window.confirm('Préparer une commande de renouvellement pour '+(detail.customers?.full_name||'ce client')+' ? Aucun paiement ni accès Internet ne sera accordé automatiquement.'))return;
  setRenewing(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/residential-subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId,subscriptionId:detail.id})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Renouvellement impossible.');
   setRenewalRef(d.order.reference);
   setNotice(d.order.already_pending?'Une commande non payée existe déjà.':'Commande de renouvellement créée, en attente de paiement.');
   setRefresh(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:'Renouvellement indisponible.');}
  finally{setRenewing(false);}
 }
 return <AppShell activePath="/abonnements" eyebrow="CLIENTS · INTERNET RÉSIDENTIEL" title="Abonnements résidentiels"
  description="Un dossier permanent par abonné, un suivi des échéances et des renouvellements, sans confondre paiement et accès Internet."
  actions={<button type="button" className="rs-refresh" disabled={!companyId||busy} onClick={()=>setRefresh(v=>v+1)}><RefreshCw size={16}/> Actualiser</button>}>
  <div className="rs-page">
   <div className="rs-context"><span>Entreprise : <strong>{company?.legal_name||'—'}</strong></span><span>Site : <strong>{activeSiteId()?siteName(activeSiteId()):'Tous les sites'}</strong></span></div>
   <section className="rs-stats" aria-label="Indicateurs des abonnements">
    {([
     {key:'total',label:'Abonnés enregistrés',note:'Fiches permanentes',icon:House},
     {key:'active',label:'Périodes en cours',note:'Activation renseignée',icon:Wifi},
     {key:'expiring',label:'Échéances proches',note:'Dans les 7 prochains jours',icon:CalendarClock},
     {key:'waiting_activation',label:'À activer',note:'Paiements confirmés',icon:Clock3},
     {key:'expired',label:'Périodes expirées',note:'À renouveler',icon:WifiOff}
    ] as const).map(item=><article className="rs-stat" key={item.key}><div><span>{item.label}</span><item.icon size={17}/></div><strong>{summary[item.key].toLocaleString('fr-FR')}</strong><small>{item.note}</small></article>)}
   </section>
   <section className="rs-panel">
    <div className="rs-panel-head"><div><h2>Répertoire des abonnés</h2><p>Issus des inscriptions et des renouvellements, sans création manuelle.</p></div><span className="rs-count">{total} résultat{total!==1?'s':''}</span></div>
    <div className="rs-toolbar">
     <form className="rs-search" role="search" onSubmit={onSearch}><Search size={17}/><input aria-label="Rechercher un abonné" placeholder="Nom, e-mail, téléphone ou référence…" maxLength={100} value={input} onChange={e=>setInput(e.target.value)}/><button type="submit">Rechercher</button></form>
     <div className="rs-tabs" role="tablist" aria-label="Filtrer les abonnements">{groups.map(g=><button type="button" role="tab" aria-selected={status===g.key} key={g.key} onClick={()=>switchStatus(g.key)}>{g.label}</button>)}</div>
    </div>
    {error&&<p className="rs-error" role="alert"><AlertCircle size={16}/>{error}</p>}
    {loading||busy?<div className="rs-empty" role="status">Chargement des abonnements…</div>:!companyId?<div className="rs-empty">Sélectionnez une entreprise.</div>:!rows.length?<div className="rs-empty"><House size={28}/><strong>Aucun abonné dans cette sélection.</strong><p>Les demandes effectuées depuis le portail client apparaîtront automatiquement ici.</p>{search||status!=='all'?<button type="button" onClick={reset}>Réinitialiser les filtres</button>:<Link href={'/portail'+context}>Ouvrir les portails client <ArrowRight size={15}/></Link>}</div>:
    <div className="rs-table-scroll"><table className="rs-table"><thead><tr><th>Abonné</th><th>Forfait</th><th>Site</th><th>Dernier paiement</th><th>Échéance</th><th>État</th><th></th></tr></thead><tbody>{rows.map(s=>{const tag=stateOf(s);return <tr key={s.id}><td><strong>{s.customers?.full_name||'Client'}</strong><small>{s.customers?.phone||s.customers?.email||'—'}</small></td><td><strong>{s.offer_name}</strong><small>{s.validity_days} jours · {s.paid_cycles} règlement(s)</small></td><td>{siteName(s.site_id)}</td><td>{date(s.last_paid_at)}</td><td>{date(s.expires_at)}</td><td><span className={'rs-status rs-'+tag.tone}>{tag.label}</span></td><td><button type="button" onClick={()=>{setSelectedId(s.id===selectedId?'':s.id);setRenewalRef('');}} aria-expanded={s.id===selectedId} className="rs-open">Détails <ArrowRight size={14}/></button></td></tr>})}</tbody></table></div>}
    <div className="rs-pages"><span>Page {page} / {totalPages}</span><div><button type="button" disabled={page<=1||busy} aria-label="Page précédente" onClick={()=>{setPage(p=>p-1);setSelectedId('');}}><ChevronLeft size={17}/></button><button type="button" disabled={page>=totalPages||busy} aria-label="Page suivante" onClick={()=>{setPage(p=>p+1);setSelectedId('');}}><ChevronRight size={17}/></button></div></div>
   </section>
   {detail&&<section className="rs-detail">
    <div className="rs-panel-head"><div><span className="rs-eyebrow">DOSSIER RÉSIDENTIEL</span><h2>{detail.customers?.full_name||'Abonné'}</h2><p>{detail.customers?.email||'—'} · {detail.customers?.phone||'Téléphone non communiqué'}</p></div><span className={'rs-status rs-'+stateOf(detail).tone}>{stateOf(detail).label}</span></div>
    <div className="rs-detail-grid"><div>
     <div className="rs-info">
      <div><span>Forfait</span><strong>{detail.offer_name}</strong></div><div><span>Durée</span><strong>{detail.validity_days} jours</strong></div>
      <div><span>Première demande</span><strong>{date(detail.created_at)}</strong></div><div><span>Dernier règlement</span><strong>{date(detail.last_paid_at)}</strong></div>
      <div><span>Début de service</span><strong>{date(detail.activated_at)}</strong></div><div><span>Échéance</span><strong>{date(detail.expires_at)}</strong></div>
     </div>
     <p className="rs-note">{stateOf(detail).detail} L'état instantané du routeur est consultable séparément dans Gestion réseau.</p>
     {!detail.site_id&&<div className="rs-site-assign"><strong>Site de raccordement non attribué</strong><p>Le dossier est enregistré, mais aucun compte MikroTik ne peut encore être relié sans site.</p>{canAssign&&availableSites.length>0?<div><select aria-label="Site à attribuer" value={assignmentSiteId} onChange={e=>setAssignmentSiteId(e.target.value)}><option value="">Choisir un site</option>{availableSites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select><button type="button" disabled={!assignmentSiteId||assigning} onClick={()=>void assignSite()}>{assigning?'Affectation…':'Attribuer ce site'}</button></div>:<p className="muted">{canAssign?'Créez d’abord un site dans le module Sites.':'Contactez un responsable pour associer cet abonné à un site.'}</p>}</div>}
     <div className="rs-actions">
      {canRenew&&<button type="button" className="rs-primary" disabled={renewing} onClick={()=>void renew()}><Wallet size={16}/>{renewing?'Renouvellement en cours…':'Préparer un renouvellement'}</button>}
      <Link className="rs-secondary" href={'/commandes'+context}>Commandes <ArrowRight size={15}/></Link>
      <Link className="rs-secondary" href={'/gestion-reseau?companyId='+encodeURIComponent(companyId)}>Gestion réseau <Wifi size={15}/></Link>
     </div>
     {renewalRef&&<div className="rs-success"><BadgeCheck size={16}/> Commande {renewalRef}. <Link href={'/paiement/'+renewalRef}>Suivre le paiement <ArrowRight size={14}/></Link></div>}
     {notice&&<p className="rs-success" role="status">{notice}</p>}
    </div><div className="rs-cycles"><h3>Historique des périodes</h3>{cycles.length?<ol>{cycles.map(c=><li key={c.id}><span className={c.activated_at?'rs-dot rs-dot-ok':'rs-dot'}/><div><strong>{c.offer_name}</strong><small>{date(c.paid_at)} · {money(c.amount,c.currency)}</small><small>{c.period_start?'Du '+date(c.period_start)+' au '+date(c.period_end):'Période réseau à confirmer'}</small><Link href={'/commandes'+context}>Commande {c.order_id.slice(0,8)}</Link></div></li>)}</ol>:<p>Aucune période payée pour le moment.</p>}</div></div>
   </section>}
   <div className="rs-guidance"><CheckCircle2 size={17}/><span>Une demande de renouvellement crée une commande impayée pour le même client. Le paiement confirmé et l'activation réseau restent deux validations distinctes. La suspension et la réactivation automatiques nécessitent le connecteur MikroTik.</span></div>
  </div>
 </AppShell>;
}
