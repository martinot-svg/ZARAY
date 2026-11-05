'use client';
import {useEffect,useState} from 'react';

export default function ResidentialNotificationPreferences({siteId}:{siteId:string}){
 const [emailEnabled,setEmailEnabled]=useState(false);
 const [available,setAvailable]=useState(false);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  let mounted=true;
  (async()=>{
   try{
    const r=await fetch('/api/residential/notification-preferences?siteId='+encodeURIComponent(siteId),
     {cache:'no-store'});
    const data=await r.json();
    if(!r.ok)throw Error(data.error||'Préférences indisponibles.');
    if(mounted){setEmailEnabled(data.emailEnabled===true);setAvailable(data.emailAvailable===true);}
   }catch(e){if(mounted)setError(e instanceof Error?e.message:'Préférences indisponibles.');}
   finally{if(mounted)setLoading(false);}
  })();
  return()=>{mounted=false};
 },[siteId]);
 async function change(enabled:boolean){
  setSaving(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/residential/notification-preferences',{
    method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({siteId,emailEnabled:enabled})
   });
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Modification impossible.');
   setEmailEnabled(data.emailEnabled===true);
   setNotice(enabled?'Alertes par e-mail activées.':'Alertes par e-mail désactivées.');
  }catch(e){setError(e instanceof Error?e.message:'Modification impossible.');}
  finally{setSaving(false);}
 }
 return <details className="rp-panel">
  <summary style={{cursor:'pointer',fontWeight:700}}>Préférences de notifications</summary>
  {loading?<p role="status">Chargement…</p>:<>
   <label style={{display:'flex',alignItems:'center',gap:10,marginTop:14}}>
    <input type="checkbox" checked={emailEnabled} disabled={saving||(!available&&!emailEnabled)}
     onChange={event=>void change(event.target.checked)}/>
    Recevoir mes alertes d’abonnement par e-mail
   </label>
   {!available&&<p className="rp-network-note">Les alertes par e-mail ne sont pas encore disponibles chez votre fournisseur. Les notifications restent accessibles ici.</p>}
  </>}
  {notice&&<p className="rp-notice" role="status">{notice}</p>}
  {error&&<p className="rp-error" role="alert">{error}</p>}
 </details>;
}
