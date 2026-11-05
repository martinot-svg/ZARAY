'use client';
import { fetchWorkspaceDirectory } from '@/lib/workspace-directory-request';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import { useEffect, useState } from 'react';
import AppShell from '@/components/app-shell';
import {selectedCompany} from '@/lib/workspace-url';
type Company={id:string;legal_name:string;slug:string;role:string};
type Site={id:string;company_id:string;name:string;status:string};
export default function PortailAdminPage(){
 const [companies,setCompanies]=useState<Company[]>([]),[sites,setSites]=useState<Site[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;(async()=>{try{const r=await fetchWorkspaceDirectory();const d=await r.json();if(!r.ok)throw new Error(d.error||'Impossible de charger les entreprises.');if(active){const chosen=selectedCompany(d.companies??[],d.sites??[]);setCompanies((d.companies??[]).filter((c:Company)=>c.id===chosen));setSites((d.sites??[]).filter((s:Site)=>s.company_id===chosen&&s.status==='active'));}}catch(e){if(active)setError(e instanceof Error?e.message:'Erreur de chargement.');}finally{if(active)setBusy(false);}})();return()=>{active=false};},[]);
 return <AppShell activePath="/portail" title="Portail captif de l’entreprise">
  <p><a className="primary-link" href="/wifi" target="_blank" rel="noopener noreferrer"><ZarayIcon name="next" size={18}/> Ouvrir la démonstration publique Wi-Fi</a></p>
  {busy?null:companies.length?<div className="module-grid">{companies.map(c=><article className="panel" key={c.id}><div className="panel-head"><div><span className="status-pill">{c.role}</span><div className="panel-title" style={{marginTop:8}}>{c.legal_name}</div><div className="muted">Identifiant public : {c.slug}</div></div></div><div className="data-list"><div className="data-row"><span>Portail client unifié</span><a className="header-link" href={'/wifi/'+encodeURIComponent(c.slug)} target="_blank" rel="noopener noreferrer"><ZarayIcon name="next" size={18} /> Ouvrir</a></div><div className="data-row"><span>Lien à partager</span><code>https://zaray.vercel.app/wifi/{c.slug}</code></div><details className="workspace-inline-disclosure"><summary>Liens supplémentaires et sites</summary><div className="data-row"><span>Formulaire résidentiel historique</span><a className="header-link" href={'/portail/'+encodeURIComponent(c.slug)} target="_blank" rel="noopener noreferrer">Consulter</a></div>{sites.filter(s=>s.company_id===c.id).map(s=><div className="data-row" key={s.id}><span>Tickets du site : {s.name}</span><a className="header-link" href={'/wifi/'+encodeURIComponent(c.slug)+'?siteId='+encodeURIComponent(s.id)} target="_blank" rel="noopener noreferrer">Ouvrir le portail du site</a></div>)}</details></div></article>)}</div>:<div className="empty-state"><strong>Aucun portail disponible</strong><p>Créez d’abord une entreprise pour obtenir un identifiant public.</p><a className="primary-link" href="/entreprises/nouvelle"><ZarayIcon name="add" size={18} /> Créer une entreprise</a></div>}
  {error&&<div className="alert alert-error" role="alert">{error}</div>}
 </AppShell>;
}
