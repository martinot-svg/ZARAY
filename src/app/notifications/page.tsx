'use client';
import {useEffect,useState} from 'react';
import AppShell from '@/components/app-shell';
import ModuleDataState from '@/components/module-data-state';
import NotificationInbox from '@/components/notification-inbox';
import {fetchWorkspaceDirectory} from '@/lib/workspace-directory-request';

type Company={id:string;legal_name:string;role:string};
type Site={id:string;company_id:string;name:string};
type Assignment={company_id:string;site_id:string};
const admin=(role:string)=>['owner','admin'].includes(role);
export default function NotificationsPage(){
 const [companies,setCompanies]=useState<Company[]>([]);
 const [sites,setSites]=useState<Site[]>([]);
 const [assigned,setAssigned]=useState<Assignment[]>([]);
 const [companyId,setCompanyId]=useState('');
 const [siteId,setSiteId]=useState('');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;(async()=>{try{
  const [dr,sr]=await Promise.all([
   fetchWorkspaceDirectory(),
   fetch('/api/my-notification-sites',{cache:'no-store'})
  ]);
  const [d,scope]=await Promise.all([dr.json(),sr.json()]);
  if(!dr.ok)throw Error(d.error||'Entreprises indisponibles.');
  if(!sr.ok)throw Error(scope.error||'Autorisations indisponibles.');
  if(!active)return;
  const allowed:Assignment[]=scope.sites||[];
  const permitted:Company[]=(d.companies||[]).filter((c:Company)=>
   admin(c.role)||(c.role==='site_manager'&&allowed.some(s=>s.company_id===c.id)));
  const allSites:Site[]=d.sites||[];
  const qs=new URLSearchParams(window.location.search);
  const requestedCompany=qs.get('companyId')||'';
  const requestedSite=qs.get('siteId')||'';
  const canSeeGlobal=permitted.some(c=>admin(c.role));
  const company=permitted.find(c=>c.id===requestedCompany);
  const chosen=company?.id||(canSeeGlobal?'all':permitted[0]?.id||'');
  const chosenRole=permitted.find(c=>c.id===chosen)?.role||'';
  const visible=allSites.filter(s=>s.company_id===chosen&&
   (admin(chosenRole)||allowed.some(v=>v.company_id===chosen&&v.site_id===s.id)));
  const site=visible.find(s=>s.id===requestedSite)?.id||(!admin(chosenRole)?visible[0]?.id||'':'');
  setCompanies(permitted);setSites(allSites);setAssigned(allowed);
  setCompanyId(chosen);setSiteId(site);
 }catch(e){if(active)setError(e instanceof Error?e.message:'Contexte indisponible.');}
 finally{if(active)setLoading(false);}
 })();return()=>{active=false};},[]);
 function chooseCompany(id:string){
  setCompanyId(id);
  const role=companies.find(c=>c.id===id)?.role||'';
  setSiteId(admin(role)?'':assigned.find(v=>v.company_id===id)?.site_id||'');
 }
 const role=companies.find(c=>c.id===companyId)?.role||'';
 const canSeeGlobal=companies.some(c=>admin(c.role));
 const matching=sites.filter(s=>s.company_id===companyId&&
  (admin(role)||assigned.some(a=>a.company_id===companyId&&a.site_id===s.id)));
 const canOpen=companyId==='all'?canSeeGlobal:
  admin(role)||role==='site_manager'&&matching.some(s=>s.id===siteId);
 return <AppShell activePath="/notifications" title="Notifications"
  companyId={companyId==='all'?'':companyId} siteId={siteId}>
  {!loading&&companies.length>0&&<section className="panel" style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end'}}>
   <label>Entreprise<select aria-label="Entreprise des notifications" value={companyId} onChange={e=>chooseCompany(e.target.value)}>
    {canSeeGlobal&&<option value="all">Toutes mes entreprises</option>}
    {companies.map(c=><option key={c.id} value={c.id}>{c.legal_name}</option>)}
   </select></label>
   <label>Site<select aria-label="Filtrer les notifications par site" value={siteId}
    disabled={companyId==='all'} onChange={e=>setSiteId(e.target.value)}>
    {admin(role)&&<option value="">Tous les sites</option>}
    {matching.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
   </select></label>
  </section>}
  {loading?<ModuleDataState label="Préparation des notifications…"/>:
   error?<p role="alert">{error}</p>:
   !canOpen?<p>Aucun site ne vous a été attribué pour les notifications.</p>:
   <NotificationInbox companyId={companyId} siteId={siteId}/>}
 </AppShell>;
}
