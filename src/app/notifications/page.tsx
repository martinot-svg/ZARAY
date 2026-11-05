'use client';
import {useEffect,useState} from 'react';
import AppShell from '@/components/app-shell';
import NotificationInbox from '@/components/notification-inbox';
import {fetchWorkspaceDirectory} from '@/lib/workspace-directory-request';
type Company={id:string;legal_name:string;role:string};
type Site={id:string;company_id:string;name:string};
export default function SiteNotifications(){
 const [companies,setCompanies]=useState<Company[]>([]);
 const [sites,setSites]=useState<Site[]>([]);
 const [companyId,setCompanyId]=useState('');
 const [siteId,setSiteId]=useState('');
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;(async()=>{
  try{
   const r=await fetchWorkspaceDirectory();const data=await r.json();
   if(!r.ok)throw Error(data.error||'Périmètre indisponible.');
   if(!active)return;
   const authorized:Company[]=(data.companies||[]).filter((c:Company)=>['owner','admin'].includes(c.role));
   setCompanies(authorized);setSites(data.sites||[]);
   const q=new URLSearchParams(window.location.search);
   const wantedCompany=q.get('companyId')||'';
   const selected=authorized.some(c=>c.id===wantedCompany)?wantedCompany:'';
   setCompanyId(selected);
   const wantedSite=q.get('siteId')||'';
   setSiteId(selected&&(data.sites||[]).some((s:Site)=>s.id===wantedSite&&s.company_id===selected)?wantedSite:'');
  }catch(e){if(active)setError(e instanceof Error?e.message:'Service indisponible.');}
  finally{if(active)setBusy(false);}
 })();return()=>{active=false};},[]);
 return <AppShell activePath="/notifications" companyId={companyId||undefined} siteId={siteId||undefined} title="Notifications">
  <section className="panel" style={{maxWidth:1050,margin:'0 auto'}}>
   <div className="toolbar-main" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:18}}>
    <label>Entreprise<select value={companyId} onChange={e=>{setCompanyId(e.target.value);setSiteId('')}}>
     <option value="">Toutes mes entreprises</option>{companies.map(c=><option value={c.id} key={c.id}>{c.legal_name}</option>)}
    </select></label>
    {companyId&&<label>Site<select value={siteId} onChange={e=>setSiteId(e.target.value)}>
     <option value="">Tous les sites</option>{sites.filter(s=>s.company_id===companyId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
    </select></label>}
   </div>
   {busy?<p role="status">Chargement des notifications…</p>:error?<p role="alert">{error}</p>:<NotificationInbox kind="staff" companyId={companyId} siteId={siteId}/>}
  </section>
 </AppShell>;
}
