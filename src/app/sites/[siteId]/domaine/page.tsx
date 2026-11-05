'use client';

import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {ZarayIcon} from '@/components/ui/zaray-icon';
import AppShell from '@/components/app-shell';

type Domain={hostname:string;status:'pending'|'active';verified_at:string|null;last_checked_at:string|null};
type Challenge={type:string;domain:string;value:string};
export default function SiteDomainSettings(){
 const {siteId}=useParams<{siteId:string}>();
 const [companyId,setCompanyId]=useState('');
 const [value,setValue]=useState('');
 const [domain,setDomain]=useState<Domain|null>(null);
 const [challenge,setChallenge]=useState<Challenge[]>([]);
 const [integration,setIntegration]=useState(false);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  const company=new URLSearchParams(window.location.search).get('companyId')||'';
  setCompanyId(company);
  if(!company){setLoading(false);setError('Sélectionnez d’abord une entreprise.');return;}
  let mounted=true;
  (async()=>{try{
   const q=new URLSearchParams({companyId:company,siteId});
   const response=await fetch('/api/site-domains?'+q,{cache:'no-store'});
   const body=await response.json();
   if(!response.ok)throw Error(body.error||'Domaine indisponible.');
   if(!mounted)return;
   setDomain(body.domain||null);
   setValue(body.domain?.hostname||'');
   setIntegration(Boolean(body.automaticVerification));
  }catch(e){if(mounted)setError(e instanceof Error?e.message:'Impossible de charger le domaine.');}
  finally{if(mounted)setLoading(false);}
  })();
  return()=>{mounted=false};
 },[siteId]);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/site-domains',{method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,siteId,hostname:value})});
   const body=await response.json();
   if(!response.ok)throw Error(body.error||'Enregistrement impossible.');
   setDomain(body.domain);
   setValue(body.domain.hostname);
   setChallenge(body.verification?.challenge||[]);
   setIntegration(Boolean(body.automaticVerification));
   setNotice(body.warning||'Domaine enregistré. Vérifiez maintenant sa propriété et la configuration DNS dans Vercel.');
  }catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible.');}
  finally{setBusy(false);}
 }
 async function verify(){
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/site-domains',{method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,siteId})});
   const body=await response.json();
   if(!response.ok)throw Error(body.error||'Vérification indisponible.');
   setDomain(body.domain);
   setChallenge(body.verification?.challenge||[]);
   setNotice(body.domain.status==='active'
    ?'Vérification Vercel et DNS confirmée : le domaine est actif.'
    :body.warning||'Vérification en attente. Configurez les enregistrements indiqués par Vercel.');
  }catch(e){setError(e instanceof Error?e.message:'Vérification impossible.');}
  finally{setBusy(false);}
 }
 const ready=domain?.status==='active';
 return <AppShell activePath="/sites" title="Domaine du site" companyId={companyId} siteId={siteId}>
  <section className="panel" style={{maxWidth:850,margin:'0 auto',display:'grid',gap:16}}>
   <div className="panel-head"><div className="panel-title">Adresse publique du site</div>
    <span className={'module-status'+(ready?' is-success':'')}>{ready?'Actif':domain?'En attente':'Non configuré'}</span>
   </div>
   <form className="form-stack" onSubmit={save}>
    <label>Domaine personnalisé
     <input type="text" placeholder="nomdusite.mg" autoComplete="off" required maxLength={253}
      value={value} onChange={event=>setValue(event.target.value)} disabled={busy||loading}/>
    </label>
    <button className="primary-link" type="submit" disabled={busy||loading||!companyId}>
     <ZarayIcon name="save" size={18}/>{busy?'Enregistrement…':'Enregistrer le domaine'}
    </button>
   </form>
   {domain&&<section className="panel" style={{display:'grid',gap:12}}>
    <strong>{domain.hostname}</strong>
    <p className="muted">{ready
     ?'Ce domaine a été vérifié par Vercel et associé à votre site.'
     :'Le domaine reste inactif jusqu’à la vérification de propriété et à la configuration DNS sur Vercel.'}</p>
    {ready?<a className="primary-link" href={'https://'+domain.hostname} target="_blank" rel="noopener noreferrer">
     <ZarayIcon name="next" size={17}/> Ouvrir mon site
    </a>:<>
     <p className="muted">Ajoutez le domaine au projet ZARAY dans Vercel, puis suivez les instructions DNS que Vercel fournit pour ce domaine.</p>
     <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer">Ouvrir la configuration Vercel</a>
     {challenge.map((item,i)=><div key={i} className="panel" style={{overflowWrap:'anywhere',fontSize:13}}>
      <strong>{item.type} · {item.domain}</strong><p>{item.value}</p>
     </div>)}
     {integration?<button type="button" className="primary-link" onClick={()=>void verify()} disabled={busy}>
      <ZarayIcon name="refresh" size={17}/> Vérifier maintenant
     </button>:<p className="muted" role="status">L’automatisation Vercel n’est pas encore configurée sur le serveur. Le domaine reste en attente.</p>}
    </>}
   </section>}
   <p className="muted">Aucun client n’est envoyé vers un domaine non vérifié. Son espace privé reste accessible par le portail existant.</p>
   <Link href={'/sites/'+encodeURIComponent(siteId)+'?companyId='+encodeURIComponent(companyId)}>
    <ZarayIcon name="back" size={17}/> Retour au site
   </Link>
   {error&&<p role="alert">{error}</p>}
   {notice&&<p role="status">{notice}</p>}
  </section>
 </AppShell>;
}
