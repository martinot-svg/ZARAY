'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppShell from '@/components/app-shell';
import { activeSiteId, scopedQuery, selectedCompany, switchCompany } from '@/lib/workspace-url';
import { MotionFeedback } from '@/components/motion';

type Company={id:string;legal_name:string;role:string};
type Site={id:string;company_id:string;name:string};
type Customer={id:string;company_id:string;site_id:string|null;full_name:string;email:string|null;phone:string|null;notes:string;status:string;created_at:string};

const statusLabels:Record<string,string>={active:'Actif',inactive:'Inactif',archived:'Archivé'};

export default function ClientsPage(){
 const [companies,setCompanies]=useState<Company[]>([]),[sites,setSites]=useState<Site[]>([]),[customers,setCustomers]=useState<Customer[]>([]);
 const [companyId,setCompanyId]=useState(''),[search,setSearch]=useState(''),[statusFilter,setStatusFilter]=useState('all');
 const [editing,setEditing]=useState<string|null>(null),[form,setForm]=useState({fullName:'',email:'',phone:'',siteId:'',notes:'',status:'active'});
 const [busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');

 async function loadCustomers(id:string){if(!id)return;setBusy(true);setError('');try{const r=await fetch('/api/customers?'+scopedQuery(id),{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Impossible de charger les clients.');setCustomers(d.customers??[]);}catch(e){setError(e instanceof Error?e.message:'Erreur de chargement.');}finally{setBusy(false);}}
 useEffect(()=>{let active=true;(async()=>{try{const r=await fetch('/api/sites',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Impossible de charger les entreprises.');if(active){setCompanies(d.companies??[]);setSites(d.sites??[]);if(d.companies?.[0])setCompanyId(selectedCompany(d.companies??[],d.sites??[]));}}catch(e){if(active)setError(e instanceof Error?e.message:'Erreur de chargement.');}finally{if(active)setBusy(false);}})();return()=>{active=false};},[]);
 useEffect(()=>{if(companyId)void loadCustomers(companyId);},[companyId]);
 useEffect(()=>{if(activeSiteId())setForm(old=>({...old,siteId:activeSiteId()||''}));},[companyId]);
 const availableSites=sites.filter(s=>s.company_id===companyId&&(!activeSiteId()||s.id===activeSiteId()));
 const filtered=useMemo(()=>customers.filter(c=>(statusFilter==='all'||c.status===statusFilter)&&((c.full_name+' '+(c.email??'')+' '+(c.phone??'')).toLowerCase().includes(search.toLowerCase().trim()))),[customers,search,statusFilter]);
 function startEdit(c:Customer){setEditing(c.id);setForm({fullName:c.full_name,email:c.email??'',phone:c.phone??'',siteId:c.site_id??'',notes:c.notes??'',status:c.status});setNotice('');setError('');}
 function reset(){setEditing(null);setForm({fullName:'',email:'',phone:'',siteId:'',notes:'',status:'active'});}
 async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();setSaving(true);setError('');setNotice('');try{const payload={companyId,customerId:editing,fullName:form.fullName,email:form.email,phone:form.phone,siteId:activeSiteId()||form.siteId,notes:form.notes,status:form.status};const r=await fetch('/api/customers',{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Enregistrement impossible.');if(editing)setCustomers(old=>old.map(c=>c.id===editing?d.customer:c));else setCustomers(old=>[d.customer,...old]);setNotice(editing?'Client mis à jour.':'Client créé.');reset();}catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible.');}finally{setSaving(false);}}
 const formTitle=editing?'Modifier le client':'Nouveau client';
 return <AppShell activePath="/clients" eyebrow="ACTIVITÉ · CRM" title="Clients" description="Centralisez vos clients, leurs coordonnées, leur site et leur statut dans un espace de travail multi-entreprises." actions={<a className="primary-link" href="#client-form">+ Nouveau client</a>}>
   <section className="toolbar panel"><div className="toolbar-main"><label className="toolbar-field">Entreprise<select value={companyId} onChange={e=>switchCompany('/clients',e.target.value)}>{companies.map(c=><option key={c.id} value={c.id}>{c.legal_name}</option>)}</select></label><label className="toolbar-field toolbar-grow">Rechercher<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, e-mail ou téléphone…"/></label><label className="toolbar-field">Statut<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Tous</option><option value="active">Actifs</option><option value="inactive">Inactifs</option><option value="archived">Archivés</option></select></label></div><div className="toolbar-meta">{filtered.length} client{filtered.length!==1?'s':''}</div></section>
   <div className="workspace-grid">
    <section id="client-form" className="panel sticky-panel"><div className="panel-head"><div><div className="panel-title">{formTitle}</div><div className="muted">Les modifications sont contrôlées côté serveur.</div></div>{editing&&<button type="button" onClick={reset}>Annuler</button>}</div>
      <form className="form-stack compact-form" onSubmit={save}>
       <label>Nom complet<input value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} minLength={2} maxLength={160} required/></label>
       <label>E-mail<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} maxLength={254}/></label>
       <label>Téléphone<input type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} maxLength={32}/></label>
       <label>Site<select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}><option value="">Aucun site</option>{availableSites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
       <label>Statut<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">Actif</option><option value="inactive">Inactif</option><option value="archived">Archivé</option></select></label>
       <label>Notes internes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} maxLength={2000} rows={4}/></label>
       <button className="primary-link" type="submit" disabled={saving||!companyId}>{saving?'Enregistrement…':editing?'Enregistrer les modifications':'Créer le client'}</button>
      </form>
    </section>
    <section className="panel"><div className="panel-head"><div><div className="panel-title">Répertoire clients</div><div className="muted">Sélectionnez une fiche pour la modifier.</div></div><span className="status-pill">{customers.length} total</span></div>
      {busy?<div className="skeleton-list" aria-label="Chargement"><span/><span/><span/></div>:filtered.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Client</th><th>Site</th><th>Statut</th><th>Créé</th><th></th></tr></thead><tbody>{filtered.map(c=><tr key={c.id}><td><strong>{c.full_name}</strong><small>{c.email||'Sans e-mail'}{c.phone?' · '+c.phone:''}</small></td><td>{availableSites.find(s=>s.id===c.site_id)?.name||'—'}</td><td><span className="status-pill">{statusLabels[c.status]??c.status}</span></td><td>{new Date(c.created_at).toLocaleDateString('fr-FR')}</td><td><button type="button" onClick={()=>startEdit(c)}>Modifier</button></td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>{customers.length?'Aucun résultat':'Aucun client'}</strong><p>{customers.length?'Modifiez vos filtres ou votre recherche.':'Créez votre première fiche client avec le formulaire.'}</p><a className="primary-link" href="#client-form">Créer un client</a></div>}
    </section>
   </div>
   <MotionFeedback message={error || notice} kind={error ? 'error' : 'success'}/>
 </AppShell>;
}
