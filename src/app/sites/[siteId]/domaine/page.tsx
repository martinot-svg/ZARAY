'use client';

import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {ZarayIcon} from '@/components/ui/zaray-icon';
import AppShell from '@/components/app-shell';

type PublicLink={alias:string;path:string;url?:string;publicHostname?:string|null};

export default function SiteLocalPortalAddress(){
 const {siteId}=useParams<{siteId:string}>();
 const [companyId,setCompanyId]=useState('');
 const [value,setValue]=useState('');
 const [link,setLink]=useState<PublicLink|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  const company=new URLSearchParams(window.location.search).get('companyId')||'';
  setCompanyId(company);
  if(!company){setLoading(false);setError('Sélectionnez d’abord une entreprise.');return;}
  let mounted=true;
  (async()=>{try{
   const query=new URLSearchParams({companyId:company,siteId});
   const response=await fetch('/api/site-links?'+query,{cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Adresse locale indisponible.');
   if(!mounted)return;
   setLink(data.link||null);setValue(data.link?.alias||'');
  }catch(e){if(mounted)setError(e instanceof Error?e.message:'Impossible de charger cette adresse.');}
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
   setNotice('Nom enregistré dans ZARAY. Il ne sera accessible aux clients qu’après configuration du DNS et du HotSpot sur le MikroTik.');
  }catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible.');}
  finally{setBusy(false);}
 }
 const localAddress=link?'http://'+link.alias:'';
 const accountAddress=localAddress?localAddress+'/kaotiko/me':'';
 async function copyAccount(){
  if(!accountAddress)return;
  try{await navigator.clipboard.writeText(accountAddress);setNotice('Adresse du compte copiée.');}
  catch{setError('Copie impossible. Sélectionnez et copiez l’adresse affichée.');}
 }
 async function copy(){
  if(!localAddress)return;
  try{await navigator.clipboard.writeText(localAddress);setNotice('Adresse locale copiée.');}
  catch{setError('La copie a échoué. Sélectionnez et copiez l’adresse affichée.');}
 }
 return <AppShell activePath="/sites" title="Adresse locale Wi-Fi" companyId={companyId} siteId={siteId}>
  <section className="panel" style={{maxWidth:850,margin:'0 auto',display:'grid',gap:16}}>
   <div className="panel-head">
    <div className="panel-title">Adresse locale du portail client</div>
    <span className="module-status">{link?'Nom enregistré':'Non configuré'}</span>
   </div>
   <p className="muted">Le nom saisi sera réservé au portail captif sur votre réseau Wi-Fi. Aucun achat de domaine ni adresse ZARAY ou Vercel n’est nécessaire pour afficher une page HTML locale sur le routeur.</p>
   <form className="form-stack" onSubmit={save}>
    <label>Nom local à saisir dans le navigateur
     <input type="text" placeholder="mlayconnexion.mg" autoComplete="off"
      required maxLength={100} value={value}
      onChange={event=>setValue(event.target.value)} disabled={busy||loading}/>
    </label>
    <button className="primary-link" type="submit" disabled={busy||loading||!companyId}>
     <ZarayIcon name="save" size={18}/>{busy?'Enregistrement…':'Enregistrer ce nom'}
    </button>
   </form>
   {link&&<section className="panel" style={{display:'grid',gap:12}}>
    <strong>Portail captif · Adresse locale</strong>
    <code style={{overflowWrap:'anywhere',fontSize:17}}>{localAddress}</code>
    <div><button type="button" onClick={()=>void copy()}>
     <ZarayIcon name="copy" size={17}/> Copier l’adresse
    </button></div>
    <p className="muted">Cette adresse ne fonctionne que pour les appareils connectés au réseau Wi-Fi dont le DNS résout ce nom vers le portail. Elle n’est pas accessible depuis l’Internet public sans domaine enregistré.</p>
    <strong>Espace abonné · Chemin souhaité</strong>
    <code style={{overflowWrap:'anywhere',fontSize:17}}>{accountAddress}</code>
    <div><button type="button" onClick={()=>void copyAccount()}>
     <ZarayIcon name="copy" size={17}/> Copier l’adresse du compte
    </button></div>
    <p className="muted">Le chemin /kaotiko/me ouvre le compte sur un hôte web du site réellement relié à ZARAY. Sur l’adresse locale MikroTik, la page login.html ne fournit pas ce service à elle seule : un serveur HTTPS privé / proxy applicatif et son routage doivent encore être configurés. Ne communiquez pas cette adresse aux abonnés comme active avant sa mise en service.</p>
   </section>}
   {link&&<details className="workspace-inline-disclosure">
    <summary>Accès au compte à distance</summary>
    <div style={{display:'grid',gap:9,paddingTop:12}}>
     <strong>{accountAddress}</strong>
     <p className="muted">Adresse locale privée préparée, non activée. Le chemin /kaotiko/me nécessite un service web local accessible en HTTPS avec un routage vers l’application du site. Une connexion VPN autorisée peut donner accès à ce service depuis l’extérieur, sans publier le nom sur Internet.</p>
     <p className="muted">Après connexion au VPN et accès au serveur, le client pourra s’authentifier avec son e-mail et un code. Aucune administration du routeur ne doit être exposée au VPN client.</p>
     <p className="muted" role="status">VPN, DNS privé, routage /kaotiko/me, serveur et certificat : mise en service non confirmée.</p>
    </div>
   </details>}
   <details className="workspace-inline-disclosure">
    <summary>Installation sur le routeur MikroTik</summary>
    <div style={{display:'grid',gap:10,paddingTop:12}}>
     <p>Dans <strong>IP → Hotspot → Server Profiles</strong>, choisissez le profil du site et indiquez <strong>{link?.alias||'le nom local choisi'}</strong> dans <strong>DNS Name</strong>. Les appareils clients doivent utiliser le DNS du réseau MikroTik.</p>
     <p>Installez votre fichier <code>login.html</code> personnalisé dans le répertoire HotSpot du routeur. Vous pouvez le préparer dans le module Tickets Wi-Fi → Personnalisation.</p>
     <p>Pour disposer de <code>{'/kaotiko/me'}</code> sur le même nom local, prévoyez un serveur ou proxy capable de distinguer ce chemin du HotSpot. L'enregistrement du nom dans ZARAY ne modifie pas le routage du MikroTik.</p>
     <p>Pour l’adresse locale sans certificat TLS reconnu, l’accès peut nécessiter <code>http://</code> ; les navigateurs privilégiant HTTPS peuvent afficher un avertissement ou refuser la navigation.</p>
     <p><strong>Inscription des nouveaux clients :</strong> la page HTML locale seule ne stocke pas de comptes. Le formulaire d’inscription nécessite un service applicatif accessible depuis le réseau ; celui-ci doit être installé/configuré séparément pour fonctionner sans hébergement externe.</p>
     <Link href={'/tickets?companyId='+encodeURIComponent(companyId)+'&siteId='+encodeURIComponent(siteId)+'&tab=customize'}>
      <ZarayIcon name="settings" size={17}/> Personnaliser et exporter le portail HTML
     </Link>
    </div>
   </details>
   <p className="muted" role="status">Enregistrement dans ZARAY : oui. Mise en service sur le routeur : non confirmée.</p>
   <Link href={'/sites/'+encodeURIComponent(siteId)+'?companyId='+encodeURIComponent(companyId)}>
    <ZarayIcon name="back" size={17}/> Retour au site
   </Link>
   {error&&<p role="alert">{error}</p>}
   {notice&&<p role="status">{notice}</p>}
  </section>
 </AppShell>;
}
