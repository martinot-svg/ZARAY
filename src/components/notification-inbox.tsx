'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Bell,BellRing,Check,RefreshCw} from 'lucide-react';
import './notification-inbox.css';

type Item={id:string;company_id?:string;site_id?:string;event_type:string;priority:string;title:string;message:string;created_at:string;read:boolean};
type Props={kind:'client'|'staff';companyId?:string;siteId?:string};
export default function NotificationInbox({kind,companyId='',siteId=''}:Props){
 const [items,setItems]=useState<Item[]>([]);
 const [unread,setUnread]=useState(0);
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState('');
 const [marking,setMarking]=useState('');
 const url=useMemo(()=>{
  if(kind==='client')return '/api/residential/notifications?siteId='+encodeURIComponent(siteId);
  const q=new URLSearchParams();
  if(companyId)q.set('companyId',companyId);
  if(siteId)q.set('siteId',siteId);
  return '/api/notifications'+(q.toString()?'?'+q.toString():'');
 },[kind,companyId,siteId]);
 const load=useCallback(async(silent=false)=>{
  if(kind==='client'&&!siteId)return;
  if(!silent)setBusy(true);
  try{
   const r=await fetch(url,{cache:'no-store'});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(data.error||'Notifications indisponibles.');
   setItems(data.notifications||[]);
   setUnread(data.unread||0);
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Notifications indisponibles.');}
  finally{if(!silent)setBusy(false);}
 },[url,kind,siteId]);
 useEffect(()=>{void load();const id=setInterval(()=>void load(true),60000);return()=>clearInterval(id);},[load]);
 async function mark(item:Item){
  if(item.read||marking)return;
  setMarking(item.id);
  try{
   const r=await fetch(kind==='client'?'/api/residential/notifications':'/api/notifications',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({notificationId:item.id,...(kind==='client'?{siteId}:{})})
   });
   if(!r.ok)throw Error('Lecture non enregistrée.');
   setItems(previous=>previous.map(x=>x.id===item.id?{...x,read:true}:x));
   setUnread(previous=>Math.max(0,previous-1));
  }catch(e){setError(e instanceof Error?e.message:'Lecture impossible.');}
  finally{setMarking('');}
 }
 return <div className="zaray-notification-inbox">
  <div className="zni-heading">
   <div><h2><Bell size={19}/> Notifications</h2><span>{unread} non lue{unread!==1?'s':''}</span></div>
   <button type="button" onClick={()=>void load()} disabled={busy} aria-label="Actualiser les notifications"><RefreshCw size={17}/></button>
  </div>
  {busy?<p role="status" className="zni-empty">Chargement…</p>:items.length?
   <div className="zni-list">{items.map(item=><article key={item.id} className={'zni-item'+(item.read?' is-read':' is-unread')}>
    <span className={'zni-dot'+(item.priority==='important'?' is-important':item.priority==='critical'?' is-critical':'')} aria-hidden="true"/>
    <div className="zni-text"><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'})}</small></div>
    {!item.read&&<button type="button" className="zni-mark" disabled={marking===item.id} onClick={()=>void mark(item)}><Check size={16}/> Lu</button>}
   </article>)}</div>
   :<p className="zni-empty">Aucune notification pour le moment.</p>}
  {error&&<p role="alert" className="zni-error">{error}</p>}
 </div>;
}
