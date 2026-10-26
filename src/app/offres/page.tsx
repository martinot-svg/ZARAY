'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppShell from '@/components/app-shell';
import { activeSiteId, scopedQuery, selectedCompany, switchCompany } from '@/lib/workspace-url';
import { MotionFeedback } from '@/components/motion';

type Company={id:string;legal_name:string;role:string};
type Offer={id:string;company_id:string;name:string;description:string;duration_minutes:number;validity_days:number;price_amount:number|string;currency:string;max_devices:number;status:string;created_at:string;updated_at:string};
const statusLabels:Record<string,string>={draft:'Brouillon',active:'Actif',archived:'Archivé'};
const money=(amount:number|string,currency:string)=>Number(amount).toLocaleString('fr-FR')+' '+currency;
const blank={name:'',description:'',durationMinutes:'60',validityDays:'1',priceAmount:'1000',currency:'MGA',maxDevices:'1',status:'draft'};

export default function OffresPage(){
 const [companies,setCompanies]=useState<Company[]>([]),[offers,setOffers]=useState<Offer[]>([]),[companyId,setCompanyId]=useState('');
 const [search,setSearch]=useState(''),[statusFilter,setStatusFilter]=useState('all'),[editing,setEditing]=useState<string|null>(null),[form,setForm]=useState(blank);
 const [busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 async function load(id:string){if(!id)return;setBusy(true);setError('');try{const r=await fetch('/api/offers?'+scopedQuery(id),{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Impossible de charger les offres.');setOffers(d.offers??[]);}catch(e){setError(e instanceof Error?e.message:'Erreur de chargement.');}finally{setBusy(false);}}
 useEffect(()=>{let active=true;(async()=>{try{const r=await fetch('/api/sites',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Impossible de charger les entreprises.');if(active){setCompanies(d.companies??[]);if(d.companies?.[0])setCompanyId(selectedCompany(d.companies??[],d.sites??[]));}}catch(e){if(active)setError(e instanceof Error?e.message:'Erreur de chargement.');}finally{if(active)setBusy(false);}})();return()=>{active=false};},[]);
 useEffect(()=>{if(companyId)void load(companyId);},[companyId]);
 const filtered=useMemo(()=>offers.filter(o=>(statusFilter==='all'||o.status===statusFilter)&&o.name.toLowerCase().includes(search.toLowerCase().trim())),[offers,search,statusFilter]);
 function startEdit(o:Offer){setEditing(o.id);setForm({name:o.name,description:o.description,durationMinutes:String(o.duration_minutes),validityDays:String(o.validity_days),priceAmount:String(o.price_amount),currency:o.currency,maxDevices:String(o.max_devices),status:o.status});setNotice('');setError('');}
 function reset(){setEditing(null);setForm(blank);}
 async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();setSaving(true);setError('');setNotice('');try{const body={companyId,offerId:editing,name:form.name,description:form.description,durationMinutes:Number(form.durationMinutes),validityDays:Number(form.validityDays),priceAmount:Number(form.priceAmount),currency:form.currency,maxDevices:Number(form.maxDevices),status:form.status};const r=await fetch('/api/offers',{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Enregistrement impossible.');if(editing)setOffers(old=>old.map(o=>o.id===editing?d.offer:o));else setOffers(old=>[d.offer,...old]);setNotice(editing?'Offre mise à jour.':'Offre créée.');reset();}catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible.');}finally{setSaving(false);}}
 return <AppShell activePath="/offres" eyebrow="ACTIVITÉ · PRODUITS" title="Offres Internet" description="Construisez votre catalogue de forfaits et contrôlez précisément ce qui est publié sur les portails captifs." actions={<a className="primary-link" href="#offer-form">+ Nouvelle offre</a>}>
  <p className="muted" role="note">Les offres sont actuellement partagées au niveau de l'entreprise : aucun rattachement à un site n'existe dans le schéma Supabase.</p>
  <section className="toolbar panel"><div className="toolbar-main"><label className="toolbar-field">Entreprise<select value={companyId} onChange={e=>switchCompany('/offres',e.target.value)}>{companies.map(c=><option key={c.id} value={c.id}>{c.legal_name}</option>)}</select></label><label className="toolbar-field toolbar-grow">Rechercher<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom de l’offre…"/></label><label className="toolbar-field">Statut<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Tous</option><option value="active">Actives</option><option value="draft">Brouillons</option><option value="archived">Archivées</option></select></label></div><div className="toolbar-meta">{filtered.length} offre{filtered.length!==1?'s':''}</div></section>
  <div className="workspace-grid">
   <section id="offer-form" className="panel sticky-panel"><div className="panel-head"><div><div className="panel-title">{editing?'Modifier l’offre':'Nouvelle offre'}</div><div className="muted">Une offre active peut être proposée sur le portail.</div></div>{editing&&<button type="button" onClick={reset}>Annuler</button>}</div>
    <form className="form-stack compact-form" onSubmit={save}>
     <label>Nom<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} minLength={2} maxLength={120} required placeholder="Ex. Pass 1 heure"/></label>
     <label>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} maxLength={1000} rows={3}/></label>
     <div className="field-grid"><label>Durée (minutes)<input type="number" min={1} max={525600} value={form.durationMinutes} onChange={e=>setForm({...form,durationMinutes:e.target.value})} required/></label><label>Validité (jours)<input type="number" min={1} max={3650} value={form.validityDays} onChange={e=>setForm({...form,validityDays:e.target.value})} required/></label></div>
     <div className="field-grid"><label>Prix<input type="number" min={0} step="0.01" value={form.priceAmount} onChange={e=>setForm({...form,priceAmount:e.target.value})} required/></label><label>Devise<select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option value="MGA">MGA — Ariary</option><option value="EUR">EUR — Euro</option><option value="USD">USD — Dollar</option></select></label></div>
     <div className="field-grid"><label>Appareils max.<input type="number" min={1} max={100} value={form.maxDevices} onChange={e=>setForm({...form,maxDevices:e.target.value})} required/></label><label>Statut<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Brouillon</option><option value="active">Actif</option><option value="archived">Archivé</option></select></label></div>
     <button className="primary-link" type="submit" disabled={saving||!companyId}>{saving?'Enregistrement…':editing?'Enregistrer les modifications':'Créer l’offre'}</button>
    </form>
   </section>
   <section className="panel"><div className="panel-head"><div><div className="panel-title">Catalogue</div><div className="muted">{offers.filter(o=>o.status==='active').length} offre(s) actuellement actives.</div></div></div>
    {busy?<div className="skeleton-list"><span/><span/><span/></div>:filtered.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Offre</th><th>Prix</th><th>Paramètres</th><th>Statut</th><th></th></tr></thead><tbody>{filtered.map(o=><tr key={o.id}><td><strong>{o.name}</strong><small>{o.description||'Sans description'}</small></td><td><strong>{money(o.price_amount,o.currency)}</strong></td><td>{o.duration_minutes} min · {o.validity_days} j · {o.max_devices} appareil(s)</td><td><span className="status-pill">{statusLabels[o.status]??o.status}</span></td><td><button type="button" onClick={()=>startEdit(o)}>Modifier</button></td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>{offers.length?'Aucun résultat':'Catalogue vide'}</strong><p>{offers.length?'Ajustez vos filtres.':'Créez votre premier forfait Internet.'}</p><a className="primary-link" href="#offer-form">Créer une offre</a></div>}
   </section>
  </div>
  <MotionFeedback message={error || notice} kind={error ? 'error' : 'success'}/>
 </AppShell>;
}
