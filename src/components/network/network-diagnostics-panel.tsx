'use client';
import {useCallback,useEffect,useState} from 'react';

type Diagnostic={
 id:string;kind:string;target:string;status:string;
 reply:Array<Record<string,string>>;error_message:string|null;
 requested_at:string;completed_at:string|null;
};
type Props={
 companyId:string;routerId:string;observationId:string;
 ipAddress:string|null;canManage:boolean;routerOnline:boolean;
};
/** Real RouterOS diagnostics are queued through the local connector.
 * The button does not claim success until RouterOS reports a result.
 */
export function NetworkDiagnosticsPanel({
 companyId,routerId,observationId,ipAddress,canManage,routerOnline
}:Props){
 const [jobs,setJobs]=useState<Diagnostic[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const hasPending=jobs.some(job=>job.status==='queued'||job.status==='dispatched');
 const reload=useCallback(async()=>{
  const search=new URLSearchParams({companyId,routerId});
  const response=await fetch('/api/network/diagnostics?'+search.toString(),{cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Historique indisponible');
  setJobs(Array.isArray(data.jobs)?data.jobs:[]);
 },[companyId,routerId]);
 useEffect(()=>{
  if(!companyId||!routerId)return;
  let active=true;
  const load=async()=>{try{await reload();}catch(e){
   if(active)setError(e instanceof Error?e.message:'Diagnostics indisponibles');
  }};
  void load();
  const timer=setInterval(()=>void load(),hasPending?15000:60000);
  return()=>{active=false;clearInterval(timer);};
 },[companyId,routerId,reload,hasPending]);
 async function ping(){
  if(!canManage||!routerOnline||!ipAddress||busy)return;
  setBusy(true);setMessage('');setError('');
  try{
   const response=await fetch('/api/network/diagnostics',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,routerId,observationId,kind:'ping'})
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Diagnostic refusé');
   setMessage(data.message||'Diagnostic enregistré.');
   await reload();
  }catch(e){setError(e instanceof Error?e.message:'Ping impossible');}
  finally{setBusy(false);}
 }
 const recent=jobs.filter(job=>job.kind==='ping'&&job.target===ipAddress).slice(0,3);
 return <div className="panel" style={{padding:12,marginTop:12}} aria-label="Diagnostic RouterOS">
  <h4>Diagnostic réseau · Ping RouterOS</h4>
  <p className="muted">Depuis le routeur sélectionné, sur l’adresse IP réellement observée. Trois paquets maximum, sans commande libre.</p>
  <button type="button" disabled={!ipAddress||!canManage||!routerOnline||busy}
   onClick={()=>void ping()}>{busy?'Demande en cours…':'Tester la connectivité (3 pings)'}</button>
  {!canManage&&<p className="muted">Droits administrateur requis.</p>}
  {message&&<p role="status">{message}</p>}
  {error&&<p role="alert">{error}</p>}
  {recent.map(job=><div key={job.id} style={{marginTop:10}}>
   <strong>{job.target}</strong> · {job.status==='queued'?'En attente du connecteur':job.status==='dispatched'?'Exécution sur RouterOS':job.status==='success'?('Ping terminé : '+(job.reply||[]).filter(s=>s.status==='received').length+'/'+(job.reply||[]).length+' réponse(s)'):(job.status==='expired'?'Délai dépassé':'Échec confirmé')}
   <p className="muted">Demandé : {new Date(job.requested_at).toLocaleString('fr-FR')}</p>
   {job.error_message&&<p role="alert">{job.error_message}</p>}
   {job.reply?.length>0&&<div className="table-wrap"><table className="data-table">
    <thead><tr><th>Paquet</th><th>État</th><th>Temps</th><th>TTL</th></tr></thead>
    <tbody>{job.reply.map((sample,i)=><tr key={i}>
     <td>{sample.seq||String(i+1)}</td>
     <td>{sample.status==='received'?'Réponse reçue':sample.status==='timeout'?'Sans réponse':sample.status||'Indéterminé'}</td>
     <td>{sample.time||'—'}</td>
     <td>{sample.ttl||'—'}</td>
    </tr>)}</tbody>
   </table></div>}
  </div>)}
 </div>;
}
