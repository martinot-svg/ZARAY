'use client';
import {useEffect,useState} from 'react';
import {AlarmClock,CalendarPlus,RefreshCw} from 'lucide-react';

type Reminder={id:string;daysBefore:number;scheduledAt:string;title:string;message:string};
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
 const endpoint='/api/residential/alarm-schedule?siteId='+encodeURIComponent(siteId);
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
    <p className="rp-network-note">Le fichier calendrier nécessite une importation par le client. L’enregistrement ici ne donne pas accès à l’application Horloge : les alarmes natives automatiques nécessitent encore l’installation et l’autorisation de l’application compagnon.</p>
   </>}
   {error&&<p role="alert" className="rp-error">{error}</p>}
   {notice&&<p role="status" className="rp-notice">{notice}</p>}
  </div>
 </details>;
}
