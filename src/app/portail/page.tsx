'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/app-shell';
import {selectedCompany} from '@/lib/workspace-url';
type Company={id:string;legal_name:string;slug:string;role:string};
export default function PortailAdminPage(){
 const [companies,setCompanies]=useState<Company[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;(async()=>{try{const r=await fetch('/api/sites',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Impossible de charger les entreprises.');if(active){const chosen=selectedCompany(d.companies??[],d.sites??[]);setCompanies((d.companies??[]).filter((c:Company)=>c.id===chosen));}}catch(e){if(active)setError(e instanceof Error?e.message:'Erreur de chargement.');}finally{if(active)setBusy(false);}})();return()=>{active=false};},[]);
 return <AppShell activePath="/portail" eyebrow="FINANCE & RÉSEAU · PORTAIL" title="Portail captif de l’entreprise" description="Retrouvez les adresses publiques de vos portails et vérifiez rapidement leur catalogue visible par les clients.">
  <p className="muted">Ce portail est configuré au niveau de l'entreprise ; aucun portail propre à un site n'est défini dans le schéma actuel.</p>
  {busy?<div className="panel"><div className="skeleton-list"><span/><span/><span/></div></div>:companies.length?<div className="module-grid">{companies.map(c=><article className="panel" key={c.id}><div className="panel-head"><div><span className="status-pill">{c.role}</span><div className="panel-title" style={{marginTop:8}}>{c.legal_name}</div><div className="muted">Identifiant public : {c.slug}</div></div></div><div className="data-list"><div className="data-row"><span>Adresse du portail</span><a className="header-link" href={'/portail/'+encodeURIComponent(c.slug)}>Ouvrir ↗</a></div><div className="data-row"><span>URL relative</span><code>/portail/{c.slug}</code></div></div><p className="muted" style={{marginTop:14}}>Les clients peuvent y choisir une offre, créer une commande et transmettre leur justificatif de paiement.</p></article>)}</div>:<div className="empty-state"><strong>Aucun portail disponible</strong><p>Créez d’abord une entreprise pour obtenir un identifiant public.</p><a className="primary-link" href="/entreprises/nouvelle">Créer une entreprise</a></div>}
  {error&&<div className="alert alert-error" role="alert">{error}</div>}
 </AppShell>;
}
