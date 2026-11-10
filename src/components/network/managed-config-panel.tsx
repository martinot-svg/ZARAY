'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import type {ManagedCategory,ManagedOperation} from '@/lib/network-managed-config';

type Observation={
 id:string;observed_kind:string;client_label:string|null;
 safe_properties?:Record<string,string>|null;
};
type Job={
 id:string;category:ManagedCategory;operation:ManagedOperation;
 status:string;reason:string;created_at:string;completed_at:string|null;
 outcome:string|null;
};
type Props={
 companyId:string;routerId:string;canManage:boolean;
 routerOnline:boolean;selectedObservation:Observation|null;
};
const operations=[
 {id:'create',label:'Créer'},
 {id:'update',label:'Modifier'},
 {id:'enable',label:'Activer'},
 {id:'disable',label:'Désactiver'},
 {id:'delete',label:'Supprimer'}
] as const;
const statusLabel:Record<string,string>={
 queued:'En attente du connecteur',
 dispatched:'Transmise au MikroTik, vérification en cours',
 success:'Confirmée par RouterOS',
 failed:'Échec ou modification restaurée',
 manual_review:'Vérification manuelle requise'
};
/** Browser workbench: never transmits raw RouterOS commands, IP credentials,
 * configuration exports, or arbitrary menu paths. All writes are queued.
 */
export function ManagedConfigPanel({
 companyId,routerId,canManage,routerOnline,selectedObservation
}:Props){
 const selectedKind=selectedObservation?.observed_kind;
 const supported=selectedKind==='vlan'||selectedKind==='dns-static';
 const [category,setCategory]=useState<ManagedCategory>('dns-static');
 const [operation,setOperation]=useState<ManagedOperation>('create');
 const [name,setName]=useState('');
 const [address,setAddress]=useState('');
 const [parent,setParent]=useState('');
 const [vlanId,setVlanId]=useState('100');
 const [reason,setReason]=useState('');
 const [confirmation,setConfirmation]=useState('');
 const [jobs,setJobs]=useState<Job[]>([]);
 const [loading,setLoading]=useState(false);
 const [feedback,setFeedback]=useState('');
 const [error,setError]=useState('');
 const hasActive=useMemo(
  ()=>jobs.some(j=>j.status==='queued'||j.status==='dispatched'),
  [jobs]
 );
 const blocked=jobs.some(j=>j.status==='manual_review');
 const reload=useCallback(async()=>{
  const params=new URLSearchParams({companyId,routerId});
  const response=await fetch('/api/network/config?'+params.toString(),{cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Historique de configuration indisponible.');
  setJobs(Array.isArray(data.jobs)?data.jobs:[]);
 },[companyId,routerId]);
 useEffect(()=>{
  if(!companyId||!routerId)return;
  let live=true;
  const refresh=async()=>{
   try{await reload();}catch(e){
    if(live)setError(e instanceof Error?e.message:'Journal indisponible.');
   }
  };
  void refresh();
  const timer=setInterval(()=>void refresh(),hasActive?15000:60000);
  return()=>{live=false;clearInterval(timer);};
 },[companyId,routerId,reload,hasActive]);
 useEffect(()=>{
  if(!supported||!selectedObservation)return;
  const properties=selectedObservation.safe_properties||{};
  setCategory(selectedObservation.observed_kind as ManagedCategory);
  setOperation('update');
  setName(properties.name||selectedObservation.client_label||'');
  setAddress(properties.address||'');
  setParent(properties.interface||'');
  setVlanId(properties['vlan-id']||'100');
  setConfirmation('');
 },[selectedObservation?.id,supported,selectedObservation]);
 const editing=operation==='create'||operation==='update';
 const available=canManage&&routerOnline&&!blocked&&!loading;
 const options=operations.filter(o=>o.id!=='delete'||category==='dns-static');
 async function submit(){
  if(!available||operation!=='create'&&!selectedObservation)return;
  setLoading(true);setFeedback('');setError('');
  try{
   const values=editing?(category==='dns-static'
    ?{name,address}:{name,interface:parent,'vlan-id':vlanId}):{};
   const response=await fetch('/api/network/config',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     companyId,routerId,category,operation,values,
     observationId:operation==='create'?null:selectedObservation?.id,
     reason,confirmation
    })
   });
   const body=await response.json();
   if(!response.ok)throw Error(body.error||'Configuration refusée.');
   setFeedback(body.message||'Demande mise en file.');
   setConfirmation('');setReason('');
   await reload();
  }catch(e){
   setError(e instanceof Error?e.message:'Commande RouterOS indisponible.');
  }finally{setLoading(false);}
 }
 return <section className="panel" aria-label="Configuration RouterOS vérifiée" style={{padding:14,marginTop:14}}>
  <h4>Configuration RouterOS — DNS et VLAN</h4>
  <p className="muted">Création et modification des ressources gérées par ZARAY. Chaque action est vérifiée sur le routeur avant confirmation. Les objets créés hors de ZARAY restent protégés.</p>
  {blocked&&<p role="alert">Une modification précédente nécessite une vérification manuelle sur ce routeur. Les nouvelles écritures sont bloquées.</p>}
  {!routerOnline&&<p className="muted">Connecteur local inactif ou contrôle désactivé : configuration indisponible.</p>}
  <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end'}}>
   <label>Module
    <select value={category} onChange={e=>{setCategory(e.target.value as ManagedCategory);setOperation('create');setConfirmation('');}}>
     <option value="dns-static">DNS statique</option><option value="vlan">VLAN</option>
    </select>
   </label>
   <label>Opération
    <select value={operation} onChange={e=>{setOperation(e.target.value as ManagedOperation);setConfirmation('');}}>
     {options.map(option=><option key={option.id} value={option.id}
      disabled={option.id!=='create'&&(!supported||selectedKind!==category)}>{option.label}</option>)}
    </select>
   </label>
  </div>
  {editing&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginTop:12}}>
   <label>Nom RouterOS
    <input value={name} onChange={e=>setName(e.target.value.slice(0,63))} maxLength={63} autoComplete="off"/>
   </label>
   {category==='dns-static'?<label>Adresse IPv4
    <input value={address} onChange={e=>setAddress(e.target.value.slice(0,15))}
     inputMode="decimal" placeholder="192.0.2.20" autoComplete="off"/>
   </label>:<>
    <label>Interface parent
     <input value={parent} onChange={e=>setParent(e.target.value.slice(0,63))}
      placeholder="ether1" autoComplete="off"/>
    </label>
    <label>ID VLAN (1–4094)
     <input value={vlanId} onChange={e=>setVlanId(e.target.value.slice(0,4))}
      inputMode="numeric" autoComplete="off"/>
    </label>
   </>}
  </div>}
  {operation!=='create'&&<p className="muted">
   Cible : {supported&&selectedKind===category?selectedObservation?.client_label||selectedObservation?.id:
    'Sélectionnez un élément DNS/VLAN depuis la liste et ouvrez ses propriétés.'}
  </p>}
  <label style={{display:'block',marginTop:12}}>Motif de la modification
   <input value={reason} onChange={e=>setReason(e.target.value.slice(0,220))}
    placeholder="Motif administratif (5 caractères minimum)" autoComplete="off"/>
  </label>
  <label style={{display:'block',marginTop:12}}>Confirmer en écrivant {operation==='delete'?'SUPPRIMER':'CONFIRMER'}
   <input value={confirmation} onChange={e=>setConfirmation(e.target.value.slice(0,12))}
    autoComplete="off"/>
  </label>
  <button type="button" style={{marginTop:12}}
   disabled={!available||operation!=='create'&&(!supported||selectedKind!==category)||
    reason.trim().length<5||confirmation!==(operation==='delete'?'SUPPRIMER':'CONFIRMER')}
   onClick={()=>void submit()}>{loading?'Enregistrement…':'Demander la configuration RouterOS'}</button>
  {feedback&&<p role="status">{feedback}</p>}
  {error&&<p role="alert">{error}</p>}
  <h4 style={{marginTop:18}}>Historique d’administration</h4>
  {jobs.length?<div className="table-wrap"><table className="data-table">
   <thead><tr><th>Heure</th><th>Module</th><th>Opération</th><th>État vérifié</th><th>Détail</th></tr></thead>
   <tbody>{jobs.slice(0,12).map(job=><tr key={job.id}>
    <td>{new Date(job.created_at).toLocaleString('fr-FR')}</td>
    <td>{job.category}</td><td>{job.operation}</td>
    <td>{statusLabel[job.status]||job.status}</td>
    <td>{job.outcome||'Vérification RouterOS en attente'}</td>
   </tr>)}</tbody>
  </table></div>:<p className="muted">Aucune configuration demandée pour ce routeur.</p>}
 </section>;
}
