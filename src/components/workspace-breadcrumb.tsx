'use client';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import {useEffect,useState} from 'react';
import {activeSiteId} from '@/lib/workspace-url';

type Workspace={company:string;site:string|null;companyId:string;siteId:string|null};
export default function WorkspaceBreadcrumb({companyId}:{companyId:string}){
 const [context,setContext]=useState<Workspace|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!companyId)return;
  let mounted=true;
  (async()=>{
   try{
    const r=await fetch('/api/sites',{cache:'no-store'});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Contexte inaccessible.');
    const company=(d.companies??[]).find((c:{id:string})=>c.id===companyId);
    const requestedSite=activeSiteId();
    const site=requestedSite?(d.sites??[]).find((s:{id:string;company_id:string})=>s.id===requestedSite&&s.company_id===companyId):null;
    if(!company||(requestedSite&&!site))throw new Error('Entreprise ou site inaccessible.');
    if(mounted)setContext({company:company.legal_name,site:site?.name??null,companyId,siteId:site?.id??null});
   }catch(e){if(mounted)setError(e instanceof Error?e.message:'Contexte inaccessible.');}
  })();
  return()=>{mounted=false};
 },[companyId]);
 if(error)return <p className="alert alert-error" role="alert">{error}</p>;
 if(!context)return null;
 return <nav aria-label="Contexte entreprise et site" className="workspace-breadcrumb">
  <span>Compte ZARAY / </span>
  <a href={'/tableau-de-bord?companyId='+encodeURIComponent(companyId)}><ZarayIcon name="site" size={18} /> {context.company} · Vue générale</a>
  {context.site&&<><span> / </span><a href={'/sites/'+encodeURIComponent(context.siteId||'')+'?companyId='+encodeURIComponent(companyId)}><ZarayIcon name="site" size={18} /> {context.site} · Tableau de bord du site</a></>}
 </nav>;
}
