'use client';
import {useEffect,useState} from 'react';
import {AlarmClock,CalendarPlus,RefreshCw,Smartphone} from 'lucide-react';

type Reminder={id:string;daysBefore:number;scheduledAt:string;title:string;message:string};
type Phone={id:string;device_name:string|null;paired_at:string;last_sync_at:string|null;token_expires_at:string};
type PairTicket={pairingCode:string;expiresAt:string;deepLink:string;siteName:string};
type Schedule={
 enabled:boolean;days:number[];hour:number;timeZone:string;
 site:{id:string;name:string;brandName:string};
 subscription:{id:string;expiresAt:string;offerName:string}|null;
 reminders:Reminder[];nativeAlarmInstalled:boolean;note:string;
};
const LABELS:Record<number,string>={7:'7 jours avant',3:'3 jours avant',1:'La veille',0:'Le jour de l’expiration'};
const selectable=[7,3,1,0];
export default function ResidentialAlarmPreferences({siteId}:{siteId:string}){
 const [schedule,setSchedule]=useState<Schedule|null>(null);
 const [days,setDays]=useState<number[]>([7,3,1,0]);
 const [hour,setHour]=useState(8);
 const [enabled,setEnabled]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [phones,setPhones]=useState<Phone[]>([]);
 const [ticket,setTicket]=useState<PairTicket|null>(null);
 const [phoneBusy,setPhoneBusy]=useState(false);
 const endpoint='/api/residential/alarm-schedule?siteId='+encodeURIComponent(siteId);
 const deviceEndpoint='/api/residential/alarm-devices';
 const loadPhones=async()=>{
  const response=await fetch(deviceEndpoint+'?siteId='+encodeURIComponent(siteId),{cache:'no-store'});
  if(response.ok){const data=await response.json();setPhones(data.devices||[]);}
 };
 useEffect(()=>{void loadPhones();},[siteId]);
 const createTicket=async()=>{
  setPhoneBusy(true);setTicket(null);setError('');
  try{
   const response=await fetch(deviceEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({siteId})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Association indisponible.');
   setTicket(data);
  }catch(e){setError(e instanceof Error?e.message:'Association indisponible.');}
  finally{setPhoneBusy(false);}
 };
 const revokePhone=async(deviceId:string)=>{
  if(!window.confirm('Dissocier ce téléphone ? Ses rappels seront supprimés lors de sa prochaine synchronisation.'))return;
  setPhoneBusy(true);setError('');
  try{
   const response=await fetch(deviceEndpoint,{method:'DELETE',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({siteId,deviceId})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Dissociation indisponible.');
   await loadPhones();setNotice('Téléphone dissocié côté fournisseur. Hors connexion, ses anciennes alarmes peuvent encore sonner.');
  }catch(e){setError(e instanceof Error?e.message:'Dissociation indisponible.');}
  finally{setPhoneBusy(false);}
 };
 useEffect(()=>{
  let mounted=true;
  (async()=>{
   try{
    const result=await fetch(endpoint,{cache:'no-store'});
    const data=await result.json();
    if(!result.ok)throw Error(data.error||'Rappels indisponibles.');
    if(mounted){setSchedule(data);setDays(data.days);setHour(data.hour);setEnabled(data.enabled);}
   }catch(e){if(mounted)setError(e instanceof Error?e.message:'Rappels indisponibles.');}
   finally{if(mounted)setLoading(false);}
  })();
  return()=>{mounted=false;};
 },[endpoint]);
 const save=async(nextEnabled=enabled)=>{
  setBusy(true);setNotice('');setError('');
  try{
   const result=await fetch(endpoint,{
    method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({enabled:nextEnabled,days,hour})
   });
   const data=await result.json();
   if(!result.ok)throw Error(data.error||'Enregistrement impossible.');
   setEnabled(data.enabled);setSchedule(data);
   setNotice('Préférences enregistrées pour ce site. Une application mobile autorisée devra les synchroniser pour programmer des alarmes natives.');
  }catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible.');}
  finally{setBusy(false);}
 };
 const toggle=(day:number)=>{
  setDays(old=>old.includes(day)?old.length===1?old:old.filter(d=>d!==day):[...old,day].sort((a,b)=>b-a));
 };
 return <details className="rp-panel" style={{marginTop:14}}>
  <summary style={{cursor:'pointer',fontWeight:750,display:'flex',gap:9,alignItems:'center'}}>
   <AlarmClock size={19}/> Alarmes de mon abonnement
  </summary>
  <div style={{display:'grid',gap:13,marginTop:16}}>
   <p className="rp-network-note">Les rappels sont associés uniquement à {schedule?.site.name||'ce site'}. Ils pourront sonner hors connexion après leur installation sur le téléphone.</p>
   {loading?<p role="status">Chargement des échéances…</p>:<>
    <label style={{display:'flex',alignItems:'center',gap:10}}>
     <input type="checkbox" checked={enabled} disabled={busy}
      onChange={event=>{setEnabled(event.target.checked);setNotice('');}}/>
     Je souhaite synchroniser mes alarmes sur mon téléphone
    </label>
    <fieldset style={{border:'none',padding:0,margin:0,display:'grid',gap:8}}>
     <legend style={{fontWeight:700,marginBottom:8}}>Jours de rappel</legend>
     {selectable.map(day=><label key={day} style={{display:'flex',alignItems:'center',gap:10}}>
      <input type="checkbox" checked={days.includes(day)} disabled={busy||days.length===1&&days.includes(day)}
       onChange={()=>toggle(day)}/>{LABELS[day]}
     </label>)}
    </fieldset>
    <label style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
     Heure des rappels (Madagascar)
     <select value={hour} disabled={busy} onChange={event=>setHour(Number(event.target.value))}
      style={{padding:8,borderRadius:8}}>
      {Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
     </select>
    </label>
    {schedule?.subscription?<p className="rp-network-note">
     Forfait : {schedule.subscription.offerName} · échéance du {new Date(schedule.subscription.expiresAt).toLocaleDateString('fr-FR',{timeZone:'Indian/Antananarivo'})}.
     {schedule.reminders.length?' '+schedule.reminders.length+' rappels futurs prévus.':' Aucune alarme future pour les jours sélectionnés.'}
    </p>:<p className="rp-network-note">Aucun abonnement activé avec une date d’expiration confirmée : aucune alarme ne peut être programmée.</p>}
    <button type="button" disabled={busy} onClick={()=>void save()}>
     <RefreshCw size={16}/> {busy?'Enregistrement…':'Enregistrer mes préférences'}
    </button>
    {schedule?.subscription&&schedule.reminders.length>0&&
     <a href={endpoint+'&format=ics'} download="rappels-abonnement.ics"
      style={{display:'inline-flex',gap:8,alignItems:'center',fontWeight:700}}>
      <CalendarPlus size={17}/> Ajouter les rappels à mon calendrier
     </a>}
    <section style={{borderTop:'1px solid currentColor',paddingTop:12,display:'grid',gap:9}}>
     <h3 style={{margin:0,display:'flex',gap:8,alignItems:'center'}}><Smartphone size={17}/> Mes téléphones Android</h3>
     <button type="button" disabled={busy||phoneBusy||!enabled} onClick={()=>void createTicket()}>
      {phoneBusy?'Chargement…':'Associer un téléphone Android'}
     </button>
     {ticket&&<div className="rp-network-note" role="status">
      <strong>{ticket.siteName}</strong> · Code valable jusqu'au {new Date(ticket.expiresAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}.
      <p><a href={ticket.deepLink}>Ouvrir l'application compagnon</a></p>
      <p>Sur un autre téléphone, saisissez l'identifiant de ce site et ce code à usage unique : <code style={{overflowWrap:'anywhere'}}>{ticket.pairingCode}</code></p>
      <p>Ne transmettez pas ce code à une personne non autorisée.</p>
     </div>}
     {phones.map(phone=><div key={phone.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
      <span>{phone.device_name||'Téléphone Android'}
       <small style={{display:'block'}}>Dernier contact : {phone.last_sync_at?new Date(phone.last_sync_at).toLocaleString('fr-FR'):'jamais'}</small>
      </span>
      <button type="button" className="rp-secondary" disabled={phoneBusy} onClick={()=>void revokePhone(phone.id)}>Dissocier</button>
     </div>)}
     <p className="rp-network-note">La synchronisation nécessite une connexion périodique. Une alarme déjà programmée peut fonctionner hors Internet.</p>
    </section>
    <p className="rp-network-note">Le fichier calendrier nécessite une importation par le client. L’enregistrement ici ne donne pas accès à l’application Horloge : les alarmes natives automatiques nécessitent encore l’installation et l’autorisation de l’application compagnon.</p>
   </>}
   {error&&<p role="alert" className="rp-error">{error}</p>}
   {notice&&<p role="status" className="rp-notice">{notice}</p>}
  </div>
 </details>;
}
