'use client';

import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {ZarayIcon} from '@/components/ui/zaray-icon';

type Company={
 id:string;legal_name:string;slug:string;role:string;status:string;
 lifecycle_previous_status:string|null;
};
const statusLabel:Record<string,string>={
 trial:'Période d’essai',active:'Active',grace:'Période de grâce',
 suspended:'Suspendue',closed:'Fermée'
};
export default function CompanyLifecyclePanel({company}:{company:Company}){
 const router=useRouter();
 const [opened,setOpened]=useState(false);
 const [busy,setBusy]=useState(false);
 const [confirmation,setConfirmation]=useState('');
 const [ack,setAck]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const owner=company.role==='owner';
 const voluntarySuspension=company.status==='suspended'&&company.lifecycle_previous_status!==null;
 const canPause=['trial','active','grace'].includes(company.status);
 const canReactivate=voluntarySuspension;
 const canDelete=owner&&voluntarySuspension;
 async function change(action:'deactivate'|'reactivate'|'delete'){
  if(action==='deactivate'&&!window.confirm(
   'Désactiver '+company.legal_name+' et suspendre les nouveaux services de tous ses sites dans ZARAY ? Les connexions MikroTik existantes ne seront pas coupées automatiquement.'
  ))return;
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/companies/lifecycle',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     companyId:company.id,action,
     ...(action==='delete'?{confirmation,acknowledge:ack}:{})
    })
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||'Opération indisponible.');
   if(action==='delete'&&data.deleted!==true)throw Error('Suppression non confirmée.');
   if(action==='delete'){router.replace('/entreprises');router.refresh();return;}
   setNotice(action==='deactivate'
    ?'Entreprise suspendue dans ZARAY. Aucune connexion Wi-Fi déjà établie n’a été coupée automatiquement.'
    :'Entreprise réactivée. Les sites précédemment suspendus restent suspendus individuellement.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Opération impossible.');}
  finally{setBusy(false);}
 }
 function destroy(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!ack||confirmation!==company.legal_name)return;
  void change('delete');
 }
 return <div style={{marginTop:12}}>
  <button type="button" onClick={()=>setOpened(!opened)}
   aria-expanded={opened} aria-label={'Paramètres de l’entreprise '+company.legal_name}>
   <ZarayIcon name="settings" size={17}/> Paramètres de l’entreprise
  </button>
  {opened&&<section className="panel" style={{marginTop:12,display:'grid',gap:12}}>
   <strong>{company.legal_name} · {statusLabel[company.status]||company.status}</strong>
   <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
    {canPause&&<button disabled={busy} type="button" onClick={()=>void change('deactivate')}>
     <ZarayIcon name="pause" size={17}/> Désactiver l’entreprise
    </button>}
    {canReactivate&&<button className="primary-link" disabled={busy} type="button"
     onClick={()=>void change('reactivate')}>
     <ZarayIcon name="confirm" size={17}/> Réactiver l’entreprise
    </button>}
   </div>
   {company.status==='suspended'&&!voluntarySuspension&&
    <p className="muted">Suspension administrative ou de facturation : cette interface ne peut pas la lever.</p>}
   <p className="muted">La désactivation bloque les nouveaux services de l’entreprise et de ses sites, tout en conservant leurs données. Les connexions déjà actives sur MikroTik ne sont pas automatiquement coupées.</p>
   {owner&&<details className="workspace-inline-disclosure">
    <summary>Supprimer définitivement l’entreprise</summary>
    <div style={{display:'grid',gap:10,paddingTop:12}}>
     <p className="muted">Suppression irréversible, réservée au propriétaire. Elle est refusée si des sites, des clients, des paiements, des tickets, des invitations ou d’autres dossiers sont encore liés à l’entreprise. Supprimez d’abord les sites vides. Les données métier sont protégées.</p>
     {!canDelete?<p role="status">L’entreprise doit d’abord être désactivée volontairement pour accéder à cette action.</p>:
      <form className="form-stack" onSubmit={destroy}>
       <label>Saisissez exactement « {company.legal_name} »
        <input type="text" value={confirmation} autoComplete="off"
         onChange={event=>setConfirmation(event.target.value)} disabled={busy}/>
       </label>
       <label style={{display:'flex',alignItems:'start',gap:8}}>
        <input type="checkbox" checked={ack} onChange={event=>setAck(event.target.checked)}
         disabled={busy}/>
        Je confirme la suppression définitive de cette entreprise et de sa configuration.
       </label>
       <button type="submit" disabled={busy||!ack||confirmation!==company.legal_name}>
        <ZarayIcon name="delete" size={17}/> Supprimer définitivement
       </button>
      </form>}
    </div>
   </details>}
   {error&&<p className="alert alert-error" role="alert">{error}</p>}
   {notice&&<p className="alert alert-success" role="status">{notice}</p>}
  </section>}
 </div>;
}
