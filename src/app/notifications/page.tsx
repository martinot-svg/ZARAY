'use client';
import {useEffect,useState} from 'react';
import AppShell from '@/components/app-shell';
import NotificationInbox from '@/components/notification-inbox';
import {fetchWorkspaceDirectory} from '@/lib/workspace-directory-request';

type Company={id:string;legal_name:string;role:string};
type Site={id:string;company_id:string;name:string};
export default function NotificationsPage(){
 const [companies,setCompanies]=useState<Company[]>([]);
 const [sites,setSites]=useState<Site[]>([]);
 const [companyId,setCompanyId]=useState('all');
 const [siteId,setSiteId]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;(async()=>{try{
  const r=await fetchWorkspaceDirectory(),d=await r.json();
  if(!r.ok)throw Error(d.error||'Entreprises indisponibles.');
  if(!active)return;
  const permitted:Company[]=(d.companies||[]).filter((c:Company)=>['owner','admin'].includes(c.role));
  setCompanies(permitted);setSites(d.sites||[]);
  const qs=new URLSearchParams(window.location.search);
  const requested=qs.get('companyId')||'';
  setCompanyId(permitted.some(c=>c.id===requested)?requested:'all');
  const s=qs.get('siteId')||'';
  setSiteId((d.sites||[]).some((v:Site)=>v.id===s&&permitted.some(c=>c.id===v.company_id))?s:'');
 }catch(e){if(active)setError(e instanceof Error?e.message:'Contexte indisponible.');}})();
 return()=>{active=false};},[]);
 const matching=sites.filter(s=>s.company_id===companyId);
 return <AppShell activePath="/notifications" title="Notifications" companyId={companyId==="all"?"":companyId} siteId={siteId}>
  <section className="panel" style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end'}}>
   <label>Entreprise<select aria-label="Entreprise des notifications" value={companyId} onChange={e=>{setCompanyId(e.target.value);setSiteId('');}}>
    <option value="all">Toutes mes entreprises</option>{companies.map(c=><option key={c.id} value={c.id}>{c.legal_name}</option>)}
   </select></label>
   <label>Site<select aria-label="Filtrer les notifications par site" value={siteId} disabled={companyId==="all"} onChange={e=>setSiteId(e.target.value)}>
    <option value="">Tous les sites</option>{matching.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
   </select></label>
  </section>
  {error?<p role="alert">{error}</p>:!companyId?<p>Aucune entreprise accessible avec des droits d'administration.</p>:
   <NotificationInbox companyId={companyId} siteId={siteId}/>}
 </AppShell>;
}
