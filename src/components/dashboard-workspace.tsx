'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/app-shell';
import { ZarayIcon, type ZarayIconName } from '@/components/ui/zaray-icon';
import { MotionCount, MotionSkeleton } from '@/components/motion';

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

export default function DashboardWorkspace({ siteId }: { siteId?:string }) {
  const [payload,setPayload]=useState<Payload|null>(null);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    async function load(){
      try{
        const contextResponse=await fetch('/api/sites',{cache:'no-store'});
        const context=await contextResponse.json();
        if(!contextResponse.ok) throw new Error(context.error||'Impossible de charger les entreprises.');
        if(!active)return;
        const companies:Company[]=context.companies??[];
        if(!companies.length){window.location.replace('/entreprises');return;}
        const requested=new URLSearchParams(window.location.search).get('companyId');
        if(!requested && !siteId){window.location.replace('/entreprises');return;}
        const matchingSite=siteId ? (context.sites??[]).find((s:Site)=>s.id===siteId) : null;
        const companyId=requested || matchingSite?.company_id || companies[0].id;
        if(!companies.some(c=>c.id===companyId))throw new Error('Entreprise inaccessible.');
        if(siteId && (!matchingSite || matchingSite.company_id!==companyId))throw new Error('Site inaccessible dans cette entreprise.');
        const params=new URLSearchParams({companyId});
        if(siteId)params.set('siteId',siteId);
        const response=await fetch('/api/dashboard?'+params.toString(),{cache:'no-store'});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||'Impossible de charger le tableau de bord.');
        if(active)setPayload(data as Payload);
      }catch(e){if(active)setError(e instanceof Error?e.message:'Erreur de chargement.');}
      finally{if(active)setBusy(false);}
    }
    void load();
    return()=>{active=false};
  },[siteId]);
  if(busy)return <main className="form-shell"><section className="form-card"><h1>Chargement du tableau de bord</h1><MotionSkeleton rows={4}/></section></main>;
  if(error||!payload)return <main className="form-shell"><section className="form-card"><h1>Contexte inaccessible</h1><p role="alert">{error||'Aucun contexte disponible.'}</p><a href="/tableau-de-bord"><ZarayIcon name="back" size={18} /> Revenir aux entreprises</a></section></main>;
  const {company,site,sites,metrics:values,recentOrders}=payload;
  const companyLink='/tableau-de-bord?companyId='+encodeURIComponent(company.id);
  const params=new URLSearchParams({companyId:company.id});
  if(site)params.set('siteId',site.id);
  const contextual=(path:string)=>path+'?'+params.toString();
  return <AppShell activePath={site?'/sites/'+site.id:'/tableau-de-bord'} companyId={company.id} siteId={site?.id}
    eyebrow={site?'ENTREPRISE / SITE':'ENTREPRISE · VUE GÉNÉRALE'}
    title={site?company.legal_name+' / '+site.name+' — Tableau de bord':company.legal_name+' — Tableau de bord'}
    description={site?company.legal_name+' / '+site.name+' · Données de ce site exclusivement.': 'Vue globale de '+company.legal_name+' · données réelles issues de Supabase.'}
    actions={site?<a className="primary-link" href={companyLink}><ZarayIcon name="back" size={18} /> Retour à la vue générale</a>:<a className="primary-link" href={contextual('/sites')}><ZarayIcon name="site" size={18} /> Gérer les sites</a>}>
    <section className="kpi-grid motion-stagger" aria-label="Indicateurs réels">
      {metrics.map(({key,label})=><article className="kpi" key={key}>
        <div className="kpi-label"><ZarayIcon name={metricIcons[key] ?? "dashboard"} size={18} /> {label.toUpperCase()}</div>
        <div className="kpi-value">{values[key]===null?<span className="muted">Indisponible</span>:<MotionCount value={values[key]!}/>}</div>
        <div className="kpi-note">{site?'Pour '+site.name:'Pour '+company.legal_name}</div>
      </article>)}
    </section>
    {!site && <section className="panel" style={{marginBottom:16}}>
      <div className="panel-head"><div><div className="panel-title">Sites de {company.legal_name}</div><div className="muted">Sélectionnez un site pour afficher ses opérations.</div></div></div>
      {sites.length?<div className="data-list">{sites.map(s=><a className="data-row" key={s.id} href={'/sites/'+encodeURIComponent(s.id)+'?companyId='+encodeURIComponent(company.id)}><ZarayIcon name="site" size={18} /> 
        <strong><ZarayIcon name="site" size={18} /> {s.name}</strong><span className="status-pill">{statuses[s.status]??s.status}</span>
      </a>)}</div>:<div className="empty-state"><strong>Entreprise créée.</strong><p>Vous pouvez maintenant créer votre premier site.</p><a className="primary-link" href={contextual('/sites')}><ZarayIcon name="add" size={18} /> Créer un site</a></div>}
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
          <a className="quick-action" href={contextual('/clients')}><ZarayIcon name="customers" size={20} /> Clients</a>
          <a className="quick-action" href={contextual('/commandes')}><ZarayIcon name="orders" size={20} /> Commandes</a>
          <a className="quick-action" href={contextual('/paiements/verification')}><ZarayIcon name="payment" size={20} /> Paiements</a>
          <a className="quick-action" href={contextual('/tickets')}><ZarayIcon name="wifi" size={20} /> Tickets Wi-Fi</a>
          <a className="quick-action" href={contextual('/caisse')}><ZarayIcon name="cash" size={20} /> Caisse</a>
          <a className="quick-action" href={contextual('/offres')}><ZarayIcon name="wifi" size={20} /> Offres de l’entreprise</a>
        </div>
      </section>
    </div>
    {site && <p className="muted" style={{marginTop:14}}>Le catalogue d’offres appartient à l’entreprise, car le schéma actuel ne possède pas de relation offre–site. Aucune offre n’est présentée comme spécifique à ce site.</p>}
  </AppShell>;
}
