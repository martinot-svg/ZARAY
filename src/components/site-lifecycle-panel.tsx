'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {ZarayIcon} from '@/components/ui/zaray-icon';

type Site={id:string;company_id:string;company_name:string;company_slug:string;name:string;status:string;created_at:string};
type Action='deactivate'|'reactivate';

export default function SiteLifecyclePanel({site,onChanged,onDeleted,onClose}:{
 site:Site;
 onChanged:(next:Site)=>void;
 onDeleted:(siteId:string)=>void;
 onClose:()=>void;
}){
 const [busy,setBusy]=useState(false);
 const [typedName,setTypedName]=useState('');
 const [acknowledged,setAcknowledged]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{setTypedName('');setAcknowledged(false);setError('');setNotice('');},[site.id]);

 async function statusAction(action:Action){
  if(action==='deactivate'&&!window.confirm(
   'Désactiver « '+site.name+' » dans ZARAY ? Les souscriptions sur le portail seront suspendues. Cette action ne coupe pas automatiquement les connexions déjà actives sur MikroTik.'
  ))return;
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/sites/lifecycle',{
    method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId:site.company_id,siteId:site.id,action})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||'Changement de statut impossible.');
   onChanged(data.site as Site);
   setNotice(data.message||'Statut du site mis à jour.');
  }catch(e){setError(e instanceof Error?e.message:'Action indisponible.');}
  finally{setBusy(false);}
 }
 async function removeSite(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!acknowledged||typedName!==site.name)return;
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/sites/lifecycle',{
    method:'DELETE',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     companyId:site.company_id,siteId:site.id,confirmation:typedName,acknowledge:true
    })
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||'Suppression impossible.');
   if(data.deleted!==true)throw Error('La suppression du site n’a pas été confirmée.');
   onDeleted(site.id);
  }catch(e){setError(e instanceof Error?e.message:'Suppression indisponible.');}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-label={'Paramètres de gestion du site '+site.name}
   style={{display:'grid',gap:14,marginTop:16,gridColumn:'1 / -1'}}>
   <div className="panel-head">
    <div><div className="panel-title">Gérer le site : {site.name}</div>
     <p className="muted">{site.company_name} · {site.status==='active'?'Actif':site.status==='suspended'?'Désactivé':site.status==='archived'?'Archivé':'Planifié'}</p>
    </div>
    <button type="button" onClick={onClose} disabled={busy} aria-label="Fermer les paramètres du site">
     <ZarayIcon name="close" size={18}/> Fermer
    </button>
   </div>
   <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
    {['active','planned'].includes(site.status)&&<button type="button" disabled={busy}
     onClick={()=>void statusAction('deactivate')}>
     <ZarayIcon name="pause" size={17}/> Désactiver le site
    </button>}
    {site.status!=='active'&&<button type="button" className="primary-link"
     disabled={busy} onClick={()=>void statusAction('reactivate')}>
     <ZarayIcon name="confirm" size={17}/> Réactiver le site
    </button>}
   </div>
   <p className="muted">La désactivation suspend le site dans ZARAY et bloque les nouveaux accès aux portails publics du site. Elle ne désactive pas automatiquement le routeur MikroTik ni les sessions Wi-Fi déjà ouvertes.</p>
   <details className="workspace-inline-disclosure">
    <summary>Supprimer définitivement ce site</summary>
    <div style={{display:'grid',gap:12,paddingTop:12,maxWidth:650}}>
     <p>Cette action efface définitivement la fiche du site et sa configuration associée. Elle est irréversible. Les autres sites de l’entreprise restent inchangés.</p>
     <p className="muted">Par sécurité, la suppression est refusée si le site possède des clients, des abonnements, des paiements, des tickets, des historiques, des routeurs ou des domaines actifs associés. Dans ce cas, laissez-le désactivé.</p>
     {site.status==='active'
      ?<p role="status">Désactivez ce site avant de pouvoir demander sa suppression.</p>
      :<form onSubmit={event=>void removeSite(event)} className="form-stack">
        <label>Saisissez exactement « {site.name} » pour confirmer
         <input type="text" autoComplete="off" value={typedName}
          onChange={event=>setTypedName(event.target.value)} disabled={busy}/>
        </label>
        <label className="wifi-template-check" style={{display:'flex',gap:8,alignItems:'flex-start'}}>
         <input type="checkbox" checked={acknowledged}
          onChange={event=>setAcknowledged(event.target.checked)} disabled={busy}/>
         Je comprends que cette suppression est définitive et que les données du site ne pourront pas être restaurées automatiquement.
        </label>
        <button type="submit" disabled={busy||!acknowledged||typedName!==site.name}>
         <ZarayIcon name="delete" size={17}/> {busy?'Suppression…':'Confirmer la suppression définitive'}
        </button>
       </form>}
    </div>
   </details>
   {error&&<p className="alert alert-error" role="alert">{error}</p>}
   {notice&&<p className="alert alert-success" role="status">{notice}</p>}
  </section>;
}
