'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import {fetchWorkspaceDirectory} from '@/lib/workspace-directory-request';
import {selectedCompany} from '@/lib/workspace-url';
import {ZarayIcon} from '@/components/ui/zaray-icon';

type Company={id:string;legal_name:string;role:string};
type Site={id:string;company_id:string;name:string;status:string};
type Merchant={id:string;label:string;site_id:string|null;environment:string;enabled:boolean;updated_at:string};
type Routing={site_id:string;mode:'shared'|'dedicated'};
type Settings={merchants:Merchant[];routing:Routing[];encryptionReady:boolean;sandboxEnabled:boolean};
export default function FiveOnePaySettings(){
 const [companies,setCompanies]=useState<Company[]>([]);
 const [sites,setSites]=useState<Site[]>([]);
 const [companyId,setCompanyId]=useState('');
 const [settings,setSettings]=useState<Settings|null>(null);
 const [scope,setScope]=useState<'company'|'site'>('company');
 const [siteId,setSiteId]=useState('');
 const [environment,setEnvironment]=useState<'sandbox'|'production'>('sandbox');
 const [label,setLabel]=useState('Compte FiveOne Pay');
 const [apiKey,setApiKey]=useState('');
 const [webhookSecret,setWebhookSecret]=useState('');
 const [enabled,setEnabled]=useState(false);
 const [kycConfirmed,setKycConfirmed]=useState(false);
 const [busy,setBusy]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  let active=true;
  fetchWorkspaceDirectory().then(r=>r.json()).then(data=>{
   if(!active)return;
   setCompanies(data.companies??[]);
   setSites(data.sites??[]);
   setCompanyId(selectedCompany(data.companies??[],data.sites??[]));
  }).catch(()=>{if(active)setError('Impossible de charger les entreprises.');})
   .finally(()=>{if(active)setBusy(false);});
  return()=>{active=false};
 },[]);
 async function load(){
  if(!companyId)return;
  const response=await fetch('/api/fiveonepay/settings?companyId='+encodeURIComponent(companyId),{cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Paramètres indisponibles.');
  setSettings(data as Settings);
 }
 useEffect(()=>{
  if(!companyId)return;
  let active=true;
  fetch('/api/fiveonepay/settings?companyId='+encodeURIComponent(companyId),{cache:'no-store'})
   .then(r=>r.json().then(data=>({ok:r.ok,data})))
   .then(({ok,data})=>{if(active){if(!ok)throw new Error(data.error||'Paramètres indisponibles.');setSettings(data);}})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Paramètres indisponibles.');});
  return()=>{active=false};
 },[companyId]);
 const companySites=sites.filter(s=>s.company_id===companyId);
 const selectedExisting=settings?.merchants.find(m=>m.site_id===(scope==='site'?siteId:null)&&m.environment===environment);
 const canAdmin=companies.find(c=>c.id===companyId)?.role==='owner'||companies.find(c=>c.id===companyId)?.role==='admin';
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setSaving(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/fiveonepay/settings',{method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,scope,siteId:scope==='site'?siteId:null,environment,label,
     apiKey,webhookSecret,enabled,kycConfirmed})});
   const data=await r.json();if(!r.ok)throw new Error(data.error||'Enregistrement impossible.');
   setApiKey('');setWebhookSecret('');setNotice('Compte marchand enregistré. Les secrets sont protégés.');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible.');}
  finally{setSaving(false);}
 }
 async function routeSite(site:Site,mode:'shared'|'dedicated'){
  setSaving(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/fiveonepay/settings',{method:'PATCH',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,siteId:site.id,mode})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Routage impossible.');
   setNotice('Routage mis à jour pour '+site.name+'.');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Routage indisponible.');}
  finally{setSaving(false);}
 }
 return <AppShell activePath="/parametres-paiement" title="FiveOne Pay · Encaissements hybrides" companyId={companyId}>
  <section className="panel" style={{maxWidth:1000,margin:'0 auto',display:'grid',gap:16}}>
   <div className="panel-head"><div className="panel-title">Comptes marchands et sites</div>
    <span className="module-status">Paiements automatiques · Facultatifs</span></div>
   <p className="muted">Choisissez le compte d’encaissement de chaque site. Les paiements manuels restent disponibles. Ne partagez jamais vos clés secrètes en dehors de ce formulaire sécurisé.</p>
   {busy?<p>Chargement…</p>:<label>Entreprise
    <select value={companyId} onChange={e=>setCompanyId(e.target.value)}>
     {companies.map(c=><option key={c.id} value={c.id}>{c.legal_name}</option>)}
    </select>
   </label>}
   {settings&&!settings.encryptionReady&&<p role="alert">La protection des clés FiveOne Pay n’est pas disponible côté serveur.</p>}
   <div className="panel" style={{display:'grid',gap:10}}>
    <strong>Routage des encaissements par site</strong>
    {companySites.map(site=>{
     const mode=settings?.routing.find(x=>x.site_id===site.id)?.mode||'shared';
     const dedicated=settings?.merchants.some(m=>m.site_id===site.id&&m.enabled);
     return <div key={site.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
      <span>{site.name} <small className="muted">{dedicated?'· Compte dédié enregistré':''}</small></span>
      <select aria-label={'Routage '+site.name} value={mode}
       onChange={e=>void routeSite(site,e.target.value as 'shared'|'dedicated')}
       disabled={!canAdmin||saving}>
       <option value="shared">Compte de l’entreprise</option>
       <option value="dedicated">Compte du site</option>
      </select>
     </div>;
    })}
    {!companySites.length&&<p className="muted">Ajoutez d’abord un site à l’entreprise.</p>}
   </div>
   <details className="workspace-inline-disclosure">
    <summary>Configurer un compte FiveOne Pay</summary>
    <form className="form-stack compact-form" onSubmit={e=>void save(e)}
     style={{paddingTop:12}}>
     <label>Type de compte
      <select value={scope} onChange={e=>{setScope(e.target.value as 'company'|'site');setApiKey('');setWebhookSecret('');}}>
       <option value="company">Principal · Entreprise</option>
       <option value="site">Indépendant · Site</option>
      </select>
     </label>
     {scope==='site'&&<label>Site
      <select value={siteId} onChange={e=>setSiteId(e.target.value)} required>
       <option value="">Choisir un site</option>
       {companySites.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
      </select>
     </label>}
     <label>Environnement
      <select value={environment} onChange={e=>{setEnvironment(e.target.value as 'sandbox'|'production');setApiKey('');setWebhookSecret('');}}>
       <option value="sandbox">Sandbox · Simulation</option>
       <option value="production">Production · Argent réel</option>
      </select>
     </label>
     <label>Nom d’identification du compte
      <input value={label} onChange={e=>setLabel(e.target.value)} required minLength={2} maxLength={80}/>
     </label>
     <label>Clé API secrète FiveOne Pay
      <input type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)}
       placeholder={selectedExisting?'Laisser vide pour conserver la clé':'sk_test_… ou sk_live_…'}
       required={!selectedExisting}/>
     </label>
     <label>Secret de signature webhook
      <input type="password" autoComplete="off" value={webhookSecret} onChange={e=>setWebhookSecret(e.target.value)}
       placeholder={selectedExisting?'Laisser vide pour conserver le secret':'whsec_…'}
       required={!selectedExisting}/>
     </label>
     {selectedExisting&&<small className="muted">Compte existant : {selectedExisting.enabled?'activé':'désactivé'} ; les secrets ne sont jamais réaffichés.</small>}
     {environment==='production'&&<label style={{display:'flex',gap:9,alignItems:'center'}}>
      <input type="checkbox" checked={kycConfirmed} onChange={e=>setKycConfirmed(e.target.checked)}/>
      Je confirme que ce compte marchand a été validé par FiveOne Pay (KYC).
     </label>}
     <label style={{display:'flex',gap:9,alignItems:'center'}}>
      <input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>
      Activer ce compte marchand
     </label>
     <button className="primary-link" disabled={saving||!canAdmin||!settings?.encryptionReady||
       (environment==='production'&&enabled&&!kycConfirmed)} type="submit">
      <ZarayIcon name="save" size={18}/>{saving?'Enregistrement…':'Enregistrer le compte'}
     </button>
    </form>
   </details>
   <div className="panel" style={{display:'grid',gap:8}}>
    <strong>Comptes configurés</strong>
    {(settings?.merchants||[]).map(m=><div key={m.id} style={{display:'grid',gap:3,overflowWrap:'anywhere'}}>
     <span><b>{m.label}</b> · {m.site_id?companySites.find(s=>s.id===m.site_id)?.name||'Site':'Entreprise'} · {m.environment} · {m.enabled?'Activé':'Désactivé'}</span>
     <small className="muted">Webhook : https://zaray.vercel.app/api/fiveonepay/webhook/{m.id}</small>
    </div>)}
    {!settings?.merchants.length&&<p className="muted">Aucun compte FiveOne Pay connecté.</p>}
   </div>
   {error&&<p role="alert">{error}</p>}
   {notice&&<p role="status">{notice}</p>}
   <Link href="/parametres-paiement">Revenir aux paiements manuels</Link>
  </section>
 </AppShell>;
}
