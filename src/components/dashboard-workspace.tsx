'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { ZarayIcon, type ZarayIconName } from '@/components/ui/zaray-icon';


type Company = { id:string; legal_name:string; slug:string; role:string };
type Site = { id:string; company_id:string; name:string; status:string };
type Order = { id:string; public_reference:string; customer_name:string; offer_name:string; status:string; created_at:string };
type Metric = number|null;
type Metrics = { sites:Metric;customers:Metric;offers:Metric;subscription_orders:Metric;payments:Metric;wifi_tickets:Metric;walkin_sales:Metric };
type Payload = { company:Company; site:Site|null; metrics:Metrics; sites:Site[];recentOrders:Order[] };
const metricIcons: Partial<Record<keyof Metrics, ZarayIconName>> = { sites:'site', customers:'customers', subscription_orders:'orders', payments:'payment', wifi_tickets:'wifi', walkin_sales:'cash' };
const metrics: {key:keyof Metrics;label:string}[]=[
  {key:'sites',label:'Sites'}, {key:'customers',label:'Clients'},
  {key:'subscription_orders',label:'Commandes'}, {key:'payments',label:'Paiements'},
  {key:'wifi_tickets',label:'Tickets Wi-Fi'}, {key:'walkin_sales',label:'Ventes occasionnelles'},
];
const statuses: Record<string,string> = { active:'Actif', planned:'Planifié',suspended:'Suspendu',archived:'Archivé',paid:'Payée',pending_payment:'En attente',cancelled:'Annulée' };

export default function DashboardWorkspace({ companyId, siteId }: { companyId:string; siteId?:string }) {
  const [payload,setPayload]=useState<Payload|null>(null);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    let live=true;
    // The route already checked the tenant. Fetch its dashboard directly rather than
    // blocking all content behind a second /api/sites -> /api/dashboard waterfall.
    setBusy(true);setError('');setPayload(null);
    const query=new URLSearchParams({companyId});
    if(siteId)query.set('siteId',siteId);
    void (async()=>{
      try{
        const response=await fetch('/api/dashboard?'+query.toString(),{cache:'no-store'});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||'Impossible de charger le tableau de bord.');
        if(live)setPayload(data as Payload);
      }catch(e){if(live)setError(e instanceof Error?e.message:'Données momentanément indisponibles.');}
      finally{if(live)setBusy(false);}
    })();
    return()=>{live=false};
  },[companyId,siteId]);

  // Never return null while fetching: keep navigation, background and the active
  // enterprise scope on screen even on slow connections or failed requests.
  if(busy||error||!payload)return <AppShell activePath={siteId?'/sites/'+siteId:'/tableau-de-bord'}
      companyId={companyId} siteId={siteId} eyebrow={siteId?'ENTREPRISE / SITE':'ENTREPRISE · VUE GÉNÉRALE'}
      title="Tableau de bord" description="Espace de gestion de l’entreprise sélectionnée.">
      <section className="panel dashboard-availability" aria-busy={busy} aria-live="polite">
        {error ? <><h2>Les données ne sont pas disponibles</h2><p role="alert">{error}</p>
          <Link className="header-link" href="/entreprises"><ZarayIcon name="back" size={18}/> Revenir à mes entreprises</Link></>
          : <><h2>Tableau de bord de votre entreprise</h2>
          <p>Le contexte entreprise est conservé. Les données autorisées apparaîtront dès qu’elles seront disponibles.</p></>}
      </section>
    </AppShell>;
  const {company,site,sites,metrics:values,recentOrders}=payload;
  const companyLink='/tableau-de-bord?companyId='+encodeURIComponent(company.id);
  const params=new URLSearchParams({companyId:company.id});
  if(site)params.set('siteId',site.id);
  const contextual=(path:string)=>path+'?'+params.toString();
  return <AppShell activePath={site?'/sites/'+site.id:'/tableau-de-bord'} companyId={company.id} siteId={site?.id}
    eyebrow={site?'ENTREPRISE / SITE':'ENTREPRISE · VUE GÉNÉRALE'}
    title={site?company.legal_name+' / '+site.name+' — Tableau de bord':company.legal_name+' — Tableau de bord'}
    description={site?company.legal_name+' / '+site.name+' · Données de ce site exclusivement.': 'Vue globale de '+company.legal_name+' · données réelles issues de Supabase.'}
    actions={site?<Link className="primary-link" href={companyLink}><ZarayIcon name="back" size={18} /> Retour à la vue générale</Link>:<Link className="primary-link" href={contextual('/sites')}><ZarayIcon name="site" size={18} /> Gérer les sites</Link>}>
    <section className="kpi-grid" aria-label="Indicateurs réels">
      {metrics.map(({key,label})=><article className="kpi" key={key}>
        <div className="kpi-label"><ZarayIcon name={metricIcons[key] ?? "dashboard"} size={18} /> {label.toUpperCase()}</div>
        <div className="kpi-value">{values[key]===null?<span className="muted">Indisponible</span>:values[key]!.toLocaleString('fr-FR')}</div>
        <div className="kpi-note">{site?'Pour '+site.name:'Pour '+company.legal_name}</div>
      </article>)}
    </section>
    {!site && <section className="panel" style={{marginBottom:16}}>
      <div className="panel-head"><div><div className="panel-title">Sites de {company.legal_name}</div><div className="muted">Sélectionnez un site pour afficher ses opérations.</div></div></div>
      {sites.length?<div className="data-list">{sites.map(s=><Link className="data-row" key={s.id} href={'/sites/'+encodeURIComponent(s.id)+'?companyId='+encodeURIComponent(company.id)}><ZarayIcon name="site" size={18} /> 
        <strong><ZarayIcon name="site" size={18} /> {s.name}</strong><span className="status-pill">{statuses[s.status]??s.status}</span>
      </Link>)}</div>:<div className="empty-state"><strong>Entreprise créée.</strong><p>Vous pouvez maintenant créer votre premier site.</p><a className="primary-link" href={contextual('/sites')}><ZarayIcon name="add" size={18} /> Créer un site</Link></div>}
    </section>}
    <div className="module-grid">
      <section className="panel"><div className="panel-head"><div className="panel-title">Activité récente</div></div>
        {recentOrders.length?<div className="data-list">{recentOrders.map(o=><div className="data-row" key={o.id}>
          <div><strong>{o.offer_name}</strong><div className="muted">{o.customer_name} · {o.public_reference}</div></div>
          <span className="status-pill">{statuses[o.status]??o.status}</span>
        </div>)}</div>:<div className="empty-state"><strong>Aucune commande enregistrée{site?' pour ce site':''}.</strong></div>}
      </section>
      <section className="panel"><div className="panel-head"><div className="panel-title">Opérations</div></div>
        <div className="quick-grid">
          <Link className="quick-action" href={contextual('/clients')}><ZarayIcon name="customers" size={20} /> Clients</Link>
          <a className="quick-action" href={contextual('/commandes')}><ZarayIcon name="orders" size={20} /> Commandes</Link>
          <a className="quick-action" href={contextual('/paiements/verification')}><ZarayIcon name="payment" size={20} /> Paiements</Link>
          <a className="quick-action" href={contextual('/tickets')}><ZarayIcon name="wifi" size={20} /> Tickets Wi-Fi</Link>
          <a className="quick-action" href={contextual('/caisse')}><ZarayIcon name="cash" size={20} /> Caisse</Link>
          <a className="quick-action" href={contextual('/offres')}><ZarayIcon name="wifi" size={20} /> Offres de l’entreprise</Link>
        </div>
      </section>
    </div>
    {site && <p className="muted" style={{marginTop:14}}>Le catalogue d’offres appartient à l’entreprise, car le schéma actuel ne possède pas de relation offre–site. Aucune offre n’est présentée comme spécifique à ce site.</p>}
  </AppShell>;
}
