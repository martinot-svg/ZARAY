'use client';

import type { DashboardPayload } from '@/lib/dashboard-types';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import SitePerformanceOverview from '@/components/site-performance-overview';
import { ZarayIcon, type ZarayIconName } from '@/components/ui/zaray-icon';

type Metrics = DashboardPayload['metrics'];
const metricIcons: Partial<Record<keyof Metrics, ZarayIconName>> = {
  sites:'site', customers:'customers', subscription_orders:'orders',
  payments:'payment', wifi_tickets:'wifi', walkin_sales:'cash'
};
const metrics: {key:keyof Metrics;label:string}[]=[
  {key:'sites',label:'Sites'}, {key:'customers',label:'Clients'},
  {key:'subscription_orders',label:'Commandes'}, {key:'payments',label:'Paiements'},
  {key:'wifi_tickets',label:'Tickets Wi-Fi'}, {key:'walkin_sales',label:'Ventes occasionnelles'},
];
const statuses: Record<string,string> = {
  active:'Actif', planned:'Planifié', suspended:'Suspendu', archived:'Archivé',
  paid:'Payée',pending_payment:'En attente',cancelled:'Annulée'
};

/** Presentation-only refinement. All metrics, tenant context and destination routes
 * are inherited from the existing secured dashboard payload.
 */
export default function DashboardWorkspace({ siteId, payload }: {
  companyId:string; siteId?:string; payload:DashboardPayload
}) {
  const {company,site,sites,metrics:values,recentOrders}=payload;
  const companyLink='/tableau-de-bord?companyId='+encodeURIComponent(company.id);
  const params=new URLSearchParams({companyId:company.id});
  if(site)params.set('siteId',site.id);
  const contextual=(path:string)=>path+'?'+params.toString();

  return <AppShell activePath={site?'/sites/'+site.id:'/tableau-de-bord'} companyId={company.id} siteId={site?.id}
    title="Tableau de bord"
    actions={site?<Link className="primary-link" href={companyLink}><ZarayIcon name="back" size={18} /> Retour à la vue générale</Link>:<Link className="primary-link" href={contextual('/sites')}><ZarayIcon name="site" size={18} /> Gérer les sites</Link>}>
    <div className="dashboard-surface" data-zaray-dashboard>
      <div className="dashboard-context" aria-label="Périmètre du tableau de bord">
        <div className="dashboard-context-copy">
          <span className="dashboard-context-label">{site?'Site sélectionné':'Entreprise sélectionnée'}</span>
          <strong className="dashboard-context-name">{site?site.name:company.legal_name}</strong>
          {site&&<span className="dashboard-context-parent">{company.legal_name}</span>}
        </div>
        <span className="dashboard-context-accent" aria-hidden="true"><ZarayIcon name={site?'site':'dashboard'} size={23}/></span>
      </div>

      <section className="kpi-grid dashboard-metrics-grid" aria-label="Indicateurs réels">
        {metrics.map(({key,label})=><article className="kpi dashboard-metric" key={key}>
          <div className="kpi-label"><ZarayIcon name={metricIcons[key] ?? 'dashboard'} size={18} /> {label}</div>
          <div className="kpi-value">{values[key]===null?<span className="muted">Indisponible</span>:values[key]!.toLocaleString('fr-FR')}</div>
        </article>)}
      </section>

      {site&&<SitePerformanceOverview companyId={company.id} siteId={site.id}/>}

      {!site&&<section className="panel dashboard-sites" aria-label="Sites de l'entreprise">
        <div className="panel-head"><h2 className="panel-title">Sites <span className="dashboard-heading-count">{sites.length}</span></h2></div>
        {sites.length?<div className="data-list">{sites.map(s=>
          <Link className="data-row dashboard-site-link" key={s.id}
            href={'/sites/'+encodeURIComponent(s.id)+'?companyId='+encodeURIComponent(company.id)}>
            <ZarayIcon name="site" size={19} />
            <strong>{s.name}</strong>
            <span className="status-pill">{statuses[s.status]??s.status}</span>
            <ZarayIcon name="next" size={17} />
          </Link>
        )}</div>:<div className="empty-state">
          <strong>Aucun site enregistré.</strong>
          <Link className="primary-link" href={contextual('/sites')}><ZarayIcon name="add" size={18} /> Créer un site</Link>
        </div>}
      </section>}

      <div className="module-grid dashboard-operations-grid">
        <section className="panel dashboard-activity" aria-label="Commandes récentes">
          <div className="panel-head">
            <h2 className="panel-title">Activité récente</h2>
            <Link className="dashboard-panel-link" href={contextual('/commandes')}>Toutes les commandes <ZarayIcon name="next" size={15}/></Link>
          </div>
          {recentOrders.length?<div className="data-list">{recentOrders.map(o=>
            <div className="data-row dashboard-order-row" key={o.id}>
              <div className="dashboard-order-details">
                <strong>{o.offer_name}</strong>
                <div className="muted">{o.customer_name} · {o.public_reference}</div>
              </div>
              <span className="status-pill">{statuses[o.status]??o.status}</span>
            </div>
          )}</div>:<div className="empty-state"><strong>Aucune commande enregistrée{site?' pour ce site':''}.</strong></div>}
        </section>

        <section className="panel dashboard-operations" aria-label="Opérations rapides">
          <div className="panel-head"><h2 className="panel-title">Opérations</h2></div>
          <nav className="quick-grid dashboard-quick-links" aria-label="Accès rapide aux opérations">
            <Link className="quick-action" href={contextual('/clients')}><ZarayIcon name="customers" size={20} /> Clients</Link>
            <Link className="quick-action" href={contextual('/commandes')}><ZarayIcon name="orders" size={20} /> Commandes</Link>
            <Link className="quick-action" href={contextual('/paiements/verification')}><ZarayIcon name="payment" size={20} /> Paiements</Link>
            <Link className="quick-action" href={contextual('/tickets')}><ZarayIcon name="wifi" size={20} /> Tickets Wi-Fi</Link>
            <Link className="quick-action" href={contextual('/caisse')}><ZarayIcon name="cash" size={20} /> Caisse</Link>
            <Link className="quick-action" href={contextual('/offres')}><ZarayIcon name="wifi" size={20} /> Offres de l’entreprise</Link>
          </nav>
        </section>
      </div>
    </div>
  </AppShell>;
}
