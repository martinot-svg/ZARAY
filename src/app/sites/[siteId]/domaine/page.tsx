'use client';

import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {ZarayIcon} from '@/components/ui/zaray-icon';
import AppShell from '@/components/app-shell';

type PublicLink={alias:string;path:string};
export default function SitePublicLinkSettings(){
 const {siteId}=useParams<{siteId:string}>();
 const [companyId,setCompanyId]=useState('');
 const [value,setValue]=useState('');
 const [link,setLink]=useState<PublicLink|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [origin,setOrigin]=useState('');
 useEffect(()=>{
  const company=new URLSearchParams(window.location.search).get('companyId')||'';
  setCompanyId(company);setOrigin(window.location.origin);
  if(!company){setLoading(false);setError('Sélectionnez d’abord une entreprise.');return;}
  let mounted=true;
  (async()=>{try{
   const query=new URLSearchParams({companyId:company,siteId});
   const response=await fetch('/api/site-links?'+query,{cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Lien public indisponible.');
   if(!mounted)return;
   setLink(data.link||null);setValue(data.link?.alias||'');
  }catch(e){if(mounted)setError(e instanceof Error?e.message:'Impossible de charger le lien.');}
  finally{if(mounted)setLoading(false);}
  })();
  return()=>{mounted=false;};
 },[siteId]);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/site-links',{
    method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,siteId,alias:value})
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Enregistrement impossible.');
   setLink(data.link);setValue(data.link.alias);
   setNotice('Lien public enregistré. Vous pouvez le partager immédiatement avec vos clients.');
  }catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible.');}
  finally{setBusy(false);}
 }
 const publicUrl=link&&origin?origin+link.path:'';
 async function copy(){
  if(!publicUrl)return;
  try{await navigator.clipboard.writeText(publicUrl);setNotice('Lien copié.');}
  catch{setError('Copie automatique indisponible. Sélectionnez et copiez le lien affiché.');}
 }
 return <AppShell activePath="/sites" title="Lien public du site" companyId={companyId} siteId={siteId}>
  <section className="panel" style={{maxWidth:850,margin:'0 auto',display:'grid',gap:16}}>
   <div className="panel-head">
    <div className="panel-title">Adresse de souscription à partager</div>
    <span className={'module-status'+(link?' is-success':'')}>{link?'Configuré':'À créer'}</span>
   </div>
   <p className="muted">Créez un lien personnalisé pour que vos clients ouvrent le portail de votre site et remplissent leur formulaire d’abonnement.</p>
   <form className="form-stack" onSubmit={save}>
    <label>Nom du lien
     <input type="text" placeholder="mlayconnexion.mg" autoComplete="off"
      required maxLength={100} value={value}
      onChange={event=>setValue(event.target.value)} disabled={busy||loading}/>
    </label>
    <p className="muted">Aucun achat de domaine ni réglage DNS n’est nécessaire. Un nom se terminant par .mg reste ici un simple identifiant ZARAY, pas un véritable domaine Internet.</p>
    <button className="primary-link" type="submit" disabled={busy||loading||!companyId}>
     <ZarayIcon name="save" size={18}/>{busy?'Enregistrement…':'Enregistrer le lien'}
    </button>
   </form>
   {link&&<section className="panel" style={{display:'grid',gap:12}}>
    <strong>Lien public de votre site</strong>
    <a href={link.path} target="_blank" rel="noopener noreferrer" style={{overflowWrap:'anywhere'}}>
     {publicUrl||link.path}
    </a>
    <p className="muted">Les clients qui ouvrent ce lien arrivent directement sur le formulaire de souscription du site.</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
     <a className="primary-link" href={link.path} target="_blank" rel="noopener noreferrer">
      <ZarayIcon name="next" size={17}/> Ouvrir le formulaire client
     </a>
     <button type="button" onClick={()=>void copy()} disabled={!publicUrl}>
      <ZarayIcon name="copy" size={17}/> Copier le lien
     </button>
    </div>
   </section>}
   <Link href={'/sites/'+encodeURIComponent(siteId)+'?companyId='+encodeURIComponent(companyId)}>
    <ZarayIcon name="back" size={17}/> Retour au site
   </Link>
   {error&&<p role="alert">{error}</p>}
   {notice&&<p role="status">{notice}</p>}
  </section>
 </AppShell>;
}
