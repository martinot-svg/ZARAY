'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import AppShell from '@/components/app-shell';
import {ZarayIcon} from '@/components/ui/zaray-icon';

type Member={user_id:string;email:string;role:string;status:string};
type Assignment={user_id:string;assigned_at:string};
export default function SiteNotificationsAccessPage(){
 const {siteId}=useParams<{siteId:string}>();
 const [companyId,setCompanyId]=useState('');
 const [members,setMembers]=useState<Member[]>([]);
 const [assigned,setAssigned]=useState<string[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  const company=new URLSearchParams(window.location.search).get('companyId')||'';
  setCompanyId(company);
  if(!company){setError('Entreprise non sélectionnée.');setLoading(false);return;}
  let alive=true;
  (async()=>{try{
   const q=new URLSearchParams({companyId:company,siteId});
   const [mr,ar]=await Promise.all([
    fetch('/api/company-members?companyId='+encodeURIComponent(company),{cache:'no-store'}),
    fetch('/api/site-notification-assignments?'+q,{cache:'no-store'})
   ]);
   const [m,a]=await Promise.all([mr.json(),ar.json()]);
   if(!mr.ok||!ar.ok)throw Error(a.error||m.error||'Accès indisponibles.');
   if(!alive)return;
   setMembers((m.members||[]).filter((x:Member)=>x.role==='site_manager'&&x.status==='active'));
   setAssigned((a.assignments||[]).map((x:Assignment)=>x.user_id));
  }catch(e){if(alive)setError(e instanceof Error?e.message:'Chargement impossible.');}
  finally{if(alive)setLoading(false);}
  })();
  return()=>{alive=false};
 },[siteId]);
 async function change(userId:string,enabled:boolean){
  setSaving(userId);setError('');setNotice('');
  try{
   const r=await fetch('/api/site-notification-assignments',{method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,siteId,userId,enabled})});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Modification impossible.');
   setAssigned(current=>enabled?[...new Set([...current,userId])]:current.filter(id=>id!==userId));
   setNotice(enabled?'Responsable autorisé pour ce site.':'Accès aux notifications révoqué.');
  }catch(e){setError(e instanceof Error?e.message:'Modification impossible.');}
  finally{setSaving('');}
 }
 return <AppShell activePath="/sites" title="Accès aux notifications" companyId={companyId} siteId={siteId}>
  <section className="panel" style={{maxWidth:850,margin:'0 auto',display:'grid',gap:14}}>
   <div className="panel-head"><div className="panel-title">Responsables autorisés pour ce site</div></div>
   {loading?<p role="status">Chargement…</p>:!members.length&&!error?
    <p>Aucun responsable de site actif dans cette entreprise. Invitez-en un depuis le module Membres.</p>:
    <div className="table-wrap"><table className="data-table">
     <thead><tr><th>Responsable</th><th>Notifications de ce site</th></tr></thead>
     <tbody>{members.map(m=><tr key={m.user_id}>
      <td><strong>{m.email}</strong></td>
      <td><label style={{display:'inline-flex',gap:9,alignItems:'center'}}>
       <input type="checkbox" checked={assigned.includes(m.user_id)}
        disabled={Boolean(saving)} onChange={e=>void change(m.user_id,e.target.checked)}/>
       {assigned.includes(m.user_id)?'Autorisé':'Non autorisé'}
      </label></td>
     </tr>)}</tbody>
    </table></div>}
   <p className="muted">Chaque responsable ne reçoit que les notifications des sites qui lui sont explicitement attribués. L’administration conserve la vue générale.</p>
   <div style={{display:'flex',flexWrap:'wrap',gap:14}}>
    <Link href={'/membres?companyId='+encodeURIComponent(companyId)}>
     <ZarayIcon name="members" size={17}/> Gérer les membres
    </Link>
    <Link href={'/sites/'+encodeURIComponent(siteId)+'?companyId='+encodeURIComponent(companyId)}>
     <ZarayIcon name="back" size={17}/> Retour au site
    </Link>
   </div>
   {notice&&<p role="status">{notice}</p>}
   {error&&<p role="alert">{error}</p>}
  </section>
 </AppShell>;
}
