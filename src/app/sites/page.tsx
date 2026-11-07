'use client';
import { fetchWorkspaceDirectory,invalidateWorkspaceDirectory } from '@/lib/workspace-directory-request';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/app-shell';
import SiteLifecyclePanel from '@/components/site-lifecycle-panel';
import SiteLogoManager from '@/components/site-logo-manager';
import SiteCreateForm from '@/components/site-create-form';
import { MotionFeedback } from '@/components/motion';
import { activeSiteId,selectedCompany } from '@/lib/workspace-url';
import ModuleDataState from '@/components/module-data-state';

type Site={id:string;company_id:string;company_name:string;company_slug:string;name:string;status:string;created_at:string};
type CompanyOption={id:string;legal_name:string;slug:string;status?:string;role?:string};
const statusLabels:Record<string,string>={planned:'Planifié',active:'Actif',suspended:'Suspendu',archived:'Archivé'};
const statusOptions=[{value:'planned',label:'Planifié'},{value:'active',label:'Actif'},{value:'suspended',label:'Suspendu'},{value:'archived',label:'Archivé'}];

export default function SitesPage(){
 const [sites,setSites]=useState<Site[]>([]),[companies,setCompanies]=useState<CompanyOption[]>([]),[companyId,setCompanyId]=useState(''),[search,setSearch]=useState(''),[statusFilter,setStatusFilter]=useState('all');
 const [busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [managedSiteId,setManagedSiteId]=useState('');
 async function load(show=true){
  if(show)setBusy(true);
  setError('');
  try{
   const response=await fetchWorkspaceDirectory();
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Impossible de charger les sites.');
   const accessible:CompanyOption[]=data.companies??[];
   const available:Site[]=data.sites??[];
   const chosen=selectedCompany(accessible,available);
   setCompanies(accessible);
   setSites(available);
   setCompanyId(chosen);
  }catch(e){setError(e instanceof Error?e.message:'Erreur de chargement.');}
  finally{if(show)setBusy(false);}
 }
 useEffect(()=>{void load();},[]);
 async function save(site:Site,nextName:string){setSaving(true);setError('');setNotice('');try{const r=await fetch('/api/sites',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({siteId:site.id,name:nextName})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Modification impossible.');invalidateWorkspaceDirectory();setSites(old=>old.map(s=>s.id===site.id?{...s,...d.site}:s));setNotice('Site mis à jour.');}catch(e){setError(e instanceof Error?e.message:'Modification impossible.');}finally{setSaving(false);}}
 function rename(site:Site){const next=window.prompt('Nouveau nom du site',site.name)?.trim();if(next&&next!==site.name)void save(site,next);}
 const filtered=useMemo(()=>sites.filter(s=>s.company_id===companyId&&(!activeSiteId()||s.id===activeSiteId())&& (statusFilter==='all'||s.status===statusFilter) && (s.name+' '+s.company_name).toLowerCase().includes(search.toLowerCase().trim())),[sites,companyId,statusFilter,search]);
 const managedSite=sites.find(s=>s.id===managedSiteId&&s.company_id===companyId&&['owner','admin'].includes(companies.find(c=>c.id===s.company_id)?.role||''));
 const currentCompany=companies.find(c=>c.id===companyId);
 const canCreate=['owner','admin'].includes(currentCompany?.role||'')&&['trial','active'].includes(currentCompany?.status||'');
 return <AppShell activePath="/sites" title="Sites" actions={canCreate?<a className="primary-link" href="#site-form" onClick={()=>{const el=document.getElementById('site-form') as HTMLDetailsElement|null;if(el)el.open=true;}}><ZarayIcon name="add" size={18} /> + Nouveau site</a>:undefined}>
  <section className="toolbar panel"><div className="toolbar-main"><span className="muted">Entreprise active : {currentCompany?.legal_name??(busy?'…':'Aucune entreprise')}</span><label className="toolbar-field toolbar-grow">Rechercher<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom du site ou entreprise…"/></label><label className="toolbar-field">Statut<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Tous</option>{statusOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label></div><div className="toolbar-meta">{busy?'…':filtered.length} site{filtered.length!==1?'s':''}</div></section>
  <div className="workspace-grid">
   {canCreate&&<details className="workspace-disclosure workspace-form-disclosure" id="site-form"><summary>Créer un site</summary><section className="panel sticky-panel"><div className="panel-head"><div><div className="panel-title">Nouveau site</div></div></div><SiteCreateForm companyId={companyId} companyName={currentCompany?.legal_name||''} onCreated={site=>{invalidateWorkspaceDirectory();setSites(old=>[...old,{...site,company_name:currentCompany?.legal_name||'',company_slug:currentCompany?.slug||''}]);setNotice('Site créé avec ses coordonnées et son logo.');}}/></section></details>}
   <section className="panel"><div className="panel-head"><div><div className="panel-title">Répertoire des sites</div></div></div>{busy?<ModuleDataState label="Préparation du répertoire des sites…"/>:filtered.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Site</th><th>Entreprise</th><th>Statut</th><th>Créé</th><th></th></tr></thead><tbody>{filtered.map(s=><tr key={s.id}><td><strong>{s.name}</strong><small>{s.company_slug}</small></td><td>{s.company_name}</td><td><span className="status-pill" aria-label={'Statut de '+s.name}>{statusLabels[s.status]||s.status}</span></td><td>{new Date(s.created_at).toLocaleDateString('fr-FR')}</td><td><Link className="header-link" href={'/sites/'+encodeURIComponent(s.id)+'?companyId='+encodeURIComponent(s.company_id)}><ZarayIcon name="edit" size={18} /> Ouvrir le dashboard</Link> {['owner','admin'].includes(companies.find(c=>c.id===s.company_id)?.role||'')&&<><Link className="header-link" href={'/sites/'+encodeURIComponent(s.id)+'/domaine?companyId='+encodeURIComponent(s.company_id)}><ZarayIcon name="network" size={17} /> Adresse locale</Link> <Link className="header-link" title="Accès aux notifications du site" aria-label={'Accès aux notifications de '+s.name} href={'/sites/'+encodeURIComponent(s.id)+'/notifications?companyId='+encodeURIComponent(s.company_id)}><ZarayIcon name="notifications" size={18}/></Link></>} <button type="button" onClick={()=>rename(s)} disabled={saving}><ZarayIcon name="edit" size={18} /> Renommer</button> {['owner','admin'].includes(companies.find(c=>c.id===s.company_id)?.role||'')&&<button type="button" aria-pressed={managedSiteId===s.id} onClick={()=>{setManagedSiteId(previous=>previous===s.id?'':s.id);setError('');setNotice('');}}><ZarayIcon name="settings" size={17} /> Paramètres</button>}</td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>{sites.length?'Aucun résultat':'Aucun site'}</strong><p>{sites.length?'Ajustez vos filtres.':'Créez le premier site de votre entreprise.'}</p>{canCreate&&<a className="primary-link" href="#site-form" onClick={()=>{const el=document.getElementById('site-form') as HTMLDetailsElement|null;if(el)el.open=true;}}><ZarayIcon name="add" size={18} /> Créer un site</a>}</div>}</section>
   {managedSite&&<section className="panel" style={{padding:16}}>
    <strong>Identité visuelle du site · {managedSite.name}</strong>
    <SiteLogoManager companyId={managedSite.company_id} siteId={managedSite.id}/>
   </section>}
   {managedSite&&<SiteLifecyclePanel key={managedSite.id} site={managedSite}
    onChanged={updated=>setSites(previous=>previous.map(site=>site.id===updated.id?{...site,...updated}:site))}
    onDeleted={id=>{invalidateWorkspaceDirectory();setSites(previous=>previous.filter(site=>site.id!==id));setManagedSiteId('');setNotice('Site supprimé définitivement.');}}
    onClose={()=>setManagedSiteId('')}/>}
  </div>
  <MotionFeedback message={error || notice} kind={error ? 'error' : 'success'}/>
 </AppShell>;
}
