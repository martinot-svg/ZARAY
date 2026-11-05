'use client';
import {useCallback,useEffect,useState} from 'react';
import {Bell,Check,RefreshCw} from 'lucide-react';
import './notification-inbox.css';

type Item={id:string;kind:string;title:string;details:string;created_at:string;read:boolean;site_id?:string};
export default function NotificationInbox({siteId,companyId,compact=false}:{
 siteId?:string;companyId?:string;compact?:boolean;
}){
 const [items,setItems]=useState<Item[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState('');
 const isResident=!companyId;
 const enabled=!!(companyId||siteId);
 const endpoint=isResident?'/api/residential/notifications':'/api/notifications';
 const query=new URLSearchParams();
 if(companyId)query.set('companyId',companyId);
 if(siteId)query.set('siteId',siteId);
 const url=endpoint+'?'+query.toString();
 const refresh=useCallback(async()=>{
  if(!enabled){setItems([]);setLoading(false);return;}
  try{
   const res=await fetch(url,{cache:'no-store'});
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(data.error||'Notifications indisponibles.');
   setItems(data.notifications||[]);setError('');
  }catch(e){setItems([]);setError(e instanceof Error?e.message:'Service indisponible.');}
  finally{setLoading(false);}
 },[enabled,url]);
 useEffect(()=>{setLoading(true);void refresh();},[refresh]);
 async function acknowledge(id:string){
  setSaving(id);
  try{
   const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,siteId,notificationId:id})});
   if(!res.ok)throw Error('Lecture non enregistrée.');
   setItems(prev=>prev.map(x=>x.id===id?{...x,read:true}:x));
  }catch(e){setError(e instanceof Error?e.message:'Action impossible.');}
  finally{setSaving('');}
 }
 const unread=items.filter(x=>!x.read).length;
 return <section className={'ni-inbox'+(compact?' ni-compact':'')} aria-label="Centre de notifications">
  <header className="ni-heading">
   <span className="ni-heading-name"><Bell size={18} aria-hidden="true"/> Notifications
    {unread>0&&<strong className="ni-count" aria-label={unread+' notifications non lues'}>{unread}</strong>}
   </span>
   <button type="button" className="ni-refresh" onClick={()=>void refresh()} aria-label="Actualiser les notifications" title="Actualiser"><RefreshCw size={17}/></button>
  </header>
  {loading?<p className="ni-muted">Chargement…</p>:
   error?<p className="ni-error" role="alert">{error}</p>:
   !enabled?<p className="ni-muted">Choisissez un site ou une entreprise.</p>:
   !items.length?<p className="ni-muted">Aucune notification.</p>:
   <div className="ni-list">{items.map(item=><article key={item.id} className={'ni-entry'+(!item.read?' ni-unread':'')}>
    <div className="ni-entry-main"><strong>{item.title}</strong><p>{item.details}</p>
     <small>{new Date(item.created_at).toLocaleString('fr-FR')}</small></div>
    {!item.read&&<button type="button" className="ni-read" onClick={()=>void acknowledge(item.id)}
       disabled={saving===item.id} aria-label={'Marquer comme lue : '+item.title}>
      <Check size={16}/> Lu
    </button>}
   </article>)}</div>}
 </section>;
}
