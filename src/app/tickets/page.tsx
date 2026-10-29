'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/app-shell';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import WifiTicketGenerator from '@/components/wifi-ticket-generator';
import WifiTicketHistory from '@/components/wifi-ticket-history';
import WifiTicketCustomization from '@/components/wifi-ticket-customization';
import WifiVoucherSales from '@/components/wifi-voucher-sales';

type Tab = 'generate' | 'sell' | 'history' | 'customize';
type Company = { id:string; legal_name:string; role:string };
type Site = { id:string; company_id:string };
const isManager = (role:string) => ['owner','admin','site_manager'].includes(role);
const parseTab = (value:string|null):Tab =>
  value === 'sell' ? 'sell' : value === 'history' ? 'history' : value === 'customize' ? 'customize' : 'generate';

export default function WifiTicketsPage() {
  const [company,setCompany] = useState<Company|null>(null);
  const [siteId,setSiteId] = useState('');
  const [tab,setTab] = useState<Tab>('generate');
  const [visited,setVisited] = useState<Tab[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');

  useEffect(()=>{
    let live=true;
    (async()=>{
      try {
        const qs=new URLSearchParams(window.location.search);
        const companyId=qs.get('companyId')??'';
        if(!companyId){window.location.replace('/entreprises');return;}
        const response=await fetch('/api/sites',{cache:'no-store'});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||'Contexte entreprise indisponible.');
        const selected=(data.companies??[]).find((c:Company)=>c.id===companyId) as Company|undefined;
        if(!selected)throw new Error('Entreprise inaccessible.');
        const requestedSite=qs.get('siteId')??'';
        if(requestedSite&&!(data.sites??[]).some((s:Site)=>s.id===requestedSite&&s.company_id===companyId)){
          throw new Error('Ce site est inaccessible dans cette entreprise.');
        }
        const initial=parseTab(qs.get('tab'));
        const allowed:Tab=isManager(selected.role)?initial:selected.role==='sales'?(initial==='sell'?'sell':'history'):'history';
        if(live){
          setCompany(selected);setSiteId(requestedSite);
          setTab(allowed);setVisited([allowed]);
        }
      } catch(e) {
        if(live)setError(e instanceof Error?e.message:'Impossible de charger le module.');
      } finally {if(live)setLoading(false);}
    })();
    return()=>{live=false};
  },[]);

  function switchTab(next:Tab){
    if(next==='customize'&&!isManager(company?.role??''))return;
    if(next==='generate'&&!isManager(company?.role??''))return;
    if(next==='sell'&&!isManager(company?.role??'')&&company?.role!=='sales')return;
    setTab(next);
    setVisited(previous=>previous.includes(next)?previous:[...previous,next]);
    const nextUrl=new URL(window.location.href);
    nextUrl.searchParams.set('tab',next);
    window.history.pushState({},'',nextUrl.pathname+nextUrl.search+nextUrl.hash);
  }
  useEffect(()=>{
    const listener=()=>{
      if(!company)return;
      const selected=parseTab(new URLSearchParams(window.location.search).get('tab'));
      const allowed=isManager(company.role)?selected:company.role==='sales'?(selected==='sell'?'sell':'history'):'history';
      setTab(allowed);setVisited(previous=>previous.includes(allowed)?previous:[...previous,allowed]);
    };
    window.addEventListener('popstate',listener);
    return()=>window.removeEventListener('popstate',listener);
  },[company]);

  if(loading)return <main className="form-shell"><p role="status">Chargement des tickets Wi-Fi…</p></main>;
  if(error||!company)return <main className="form-shell"><section className="form-card">
    <h1>Tickets Wi-Fi indisponibles</h1><p role="alert">{error||'Entreprise inaccessible.'}</p>
    <a href="/entreprises">Revenir à mes entreprises</a>
  </section></main>;

  const manager=isManager(company.role);
  return <AppShell activePath="/tickets" companyId={company.id} siteId={siteId||undefined}
    eyebrow="ACTIVITÉ · WI-FI" title="Tickets Wi-Fi"
    description="Préparez et imprimez les tickets avant vente. La première connexion Hotspot réussie déclenche leur comptabilisation automatique.">
    <nav className="panel" aria-label="Onglets du module Tickets Wi-Fi"
      style={{padding:10,display:'flex',gap:8,flexWrap:'wrap',marginBottom:18}}>
      {([['generate','Générer','ticket'],['sell','Stock & activations','payment'],['history','Historique','clipboard-list'],['customize','Personnalisation','settings']] as const)
        .filter(([key])=>key==='history'||manager||(key==='sell'&&company.role==='sales'))
        .map(([key,label,icon])=>
          <button type="button" key={key} aria-current={tab===key?'page':undefined}
            className={tab===key?'primary-link':'header-link'}
            style={{display:'inline-flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:8}}
            onClick={()=>switchTab(key)}>
            <ZarayIcon name={icon==='clipboard-list'?'orders':icon} size={17}/>{label}
          </button>)}
    </nav>
    {visited.includes('generate')&&manager&&<section aria-label="Génération des tickets" hidden={tab!=='generate'}>
      <h2>Génération et impression</h2>
      <p className="muted">Préparation MikroTik avant vente. Export PDF, JPEG ou impression directe de tickets prêts. A4 (3 colonnes × 11 lignes) reste dans ce module.</p>
      <WifiTicketGenerator />
    </section>}
    {visited.includes('sell')&&(manager||company.role==='sales')&&<section aria-label="Stock et activations MikroTik" hidden={tab!=='sell'}>
      <WifiVoucherSales companyId={company.id}/>
    </section>}
    {visited.includes('history')&&<section aria-label="Historique des tickets" hidden={tab!=='history'}>
      <WifiTicketHistory />
    </section>}
    {visited.includes('customize')&&manager&&<section aria-label="Personnalisation des tickets" hidden={tab!=='customize'}>
      <WifiTicketCustomization />
    </section>}
  </AppShell>;
}
