'use client';
import {useCallback,useEffect,useMemo,useState,type CSSProperties,type FormEvent} from 'react';
import {ArrowLeft,CheckCircle2,RefreshCw,ShieldCheck} from 'lucide-react';
import type {ResidentialSiteIdentity} from '@/lib/residential-site-identity';
import './residential-account-portal.css';

type PaymentStatus={
 reference:string;companySlug:string;offerName:string;amount:number|string;currency:string;
 orderStatus:string;paid:boolean;
 submission:null|{provider:'orange_money'|'mvola';status:string;createdAt:string;reviewedAt:string|null};
};
type PaymentMethod={provider:'orange_money'|'mvola';accountNumber:string;accountName:string;instructions:string};
const providers:Record<string,string>={orange_money:'Orange Money',mvola:'MVola'};
const paymentStatus:Record<string,string>={
 submitted:'Justificatif en vérification',approved:'Paiement validé',
 rejected:'Justificatif rejeté',not_submitted:'Justificatif non transmis'
};
function ink(hex:string){
 const v=hex.replace('#','');
 if(v.length!==6)return '#f6fff8';
 const c=[0,2,4].map(i=>parseInt(v.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
 return c[0]*.2126+c[1]*.7152+c[2]*.0722>.22?'#12281c':'#f6fff8';
}
export default function ResidentialPaymentStatus({site,reference}:{
 site:ResidentialSiteIdentity;reference:string;
}){
 const [status,setStatus]=useState<PaymentStatus|null>(null);
 const [methods,setMethods]=useState<PaymentMethod[]>([]);
 const [provider,setProvider]=useState('');
 const [email,setEmail]=useState('');
 const [sender,setSender]=useState('');
 const [transaction,setTransaction]=useState('');
 const [proof,setProof]=useState<File|null>(null);
 const [loading,setLoading]=useState(true);
 const [sending,setSending]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const style=useMemo(()=>({
  '--rp-primary':site.primaryColor,
  '--rp-accent':site.accentColor,
  '--rp-page':site.secondaryColor,
  '--rp-ink':ink(site.secondaryColor),
  '--rp-primary-ink':ink(site.primaryColor),
  '--rp-card':ink(site.secondaryColor)==='#12281c'?'#ffffff':'#13271f',
  '--rp-card-ink':ink(site.secondaryColor)==='#12281c'?'#15271e':'#f6fff8'
 } as CSSProperties),[site]);
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const q=new URLSearchParams({reference,siteId:site.siteId});
   const r=await fetch('/api/manual-payments/status?'+q,{cache:'no-store'});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Paiement indisponible.');
   setStatus(data);
   if(data.companySlug===site.companySlug&&data.orderStatus==='pending_payment'){
    const m=await fetch('/api/portal/'+encodeURIComponent(site.companySlug)+'/payment-methods',{cache:'no-store'});
    if(m.ok){
     const list=((await m.json()).methods||[]) as PaymentMethod[];
     setMethods(list);setProvider(old=>old||list[0]?.provider||'');
    }else setMethods([]);
   }else setMethods([]);
  }catch(e){setStatus(null);setError(e instanceof Error?e.message:'Paiement indisponible.');}
  finally{setLoading(false);}
 },[reference,site.companySlug,site.siteId]);
 useEffect(()=>{void refresh();},[refresh]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!status||!proof||!provider)return;
  setSending(true);setError('');setNotice('');
  try{
   const form=new FormData();
   form.set('reference',status.reference);
   form.set('provider',provider);
   form.set('customerEmail',email);
   form.set('senderPhone',sender);
   form.set('transactionReference',transaction);
   form.set('proof',proof);
   const r=await fetch('/api/manual-payments/submit',{method:'POST',body:form});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Justificatif refusé.');
   setNotice(data.message||'Justificatif transmis pour vérification.');
   setProof(null);
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Envoi impossible.');}
  finally{setSending(false);}
 }
 const current=methods.find(m=>m.provider===provider);
 const canSubmit=status?.orderStatus==='pending_payment'&&!status.paid
  &&status.submission?.status!=='submitted'&&methods.length>0;
 return <div className="rp-root resident-portal" style={style}>
  <div className="rp-frame">
   <header className="rp-header">
    <div className="rp-identity">
     {site.logoDataUri?<img className="rp-logo" src={site.logoDataUri} alt={'Logo '+site.brandName}/>:
      <span className="rp-monogram" aria-hidden="true">{site.brandName.slice(0,1).toUpperCase()}</span>}
     <div><strong>{site.brandName}</strong><small>{site.siteName}</small></div>
    </div>
    <a href="/" className="rp-signout"><ArrowLeft size={16}/> Mon Internet</a>
   </header>
   <main className="rp-main">
    <section className="rp-panel">
     <div className="rp-section-heading"><h1>Suivi du paiement</h1></div>
     <p>Référence : <strong>{reference}</strong></p>
     {loading&&<p role="status">Vérification du paiement…</p>}
     {status&&<div className="rp-list">
      <div className="rp-list-row"><div><strong>Forfait</strong></div><strong>{status.offerName}</strong></div>
      <div className="rp-list-row"><div><strong>Montant</strong></div><strong>{Number(status.amount).toLocaleString('fr-FR')} {status.currency}</strong></div>
      <div className="rp-list-row"><div><strong>État</strong></div><strong>{status.paid?'Paiement confirmé':paymentStatus[status.submission?.status||'not_submitted']||'En attente'}</strong></div>
      {status.submission&&<div className="rp-list-row"><div><strong>Justificatif</strong></div><span>{providers[status.submission.provider]} · {new Date(status.submission.createdAt).toLocaleDateString('fr-FR')}</span></div>}
     </div>}
     <button type="button" className="rp-secondary" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={16}/> Actualiser</button>
     <p className="rp-network-note"><ShieldCheck size={16}/> L’accès Internet dépend de la validation du paiement et de l’activation réseau.</p>
    </section>
    {canSubmit&&status&&<section className="rp-panel rp-auth">
     <h2>Transmettre mon justificatif</h2>
     <form onSubmit={submit}>
      <label>Moyen de paiement<select value={provider} onChange={e=>setProvider(e.target.value)} required>
       {methods.map(m=><option key={m.provider} value={m.provider}>{providers[m.provider]}</option>)}
      </select></label>
      {current&&<p><strong>{providers[current.provider]} : {current.accountNumber}</strong> — {current.accountName}. {current.instructions}</p>}
      <label>E-mail de la commande<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Numéro émetteur<input type="tel" pattern="03[0-9]{8}" required value={sender} onChange={e=>setSender(e.target.value)}/></label>
      <label>Référence de transaction<input required minLength={2} maxLength={120} value={transaction} onChange={e=>setTransaction(e.target.value)}/></label>
      <label>Justificatif (JPG, PNG, WEBP ou PDF, 5 Mo maximum)<input type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setProof(e.target.files?.[0]||null)}/></label>
      <button type="submit" disabled={sending||!proof}>{sending?'Envoi…':'Soumettre le justificatif'} <CheckCircle2 size={17}/></button>
     </form>
    </section>}
    {notice&&<p role="status" className="rp-notice">{notice}</p>}
    {error&&<p role="alert" className="rp-error">{error}</p>}
   </main>
   <footer className="rp-footer"><span>{site.brandName}</span><span>Connexion sécurisée</span></footer>
  </div>
 </div>;
}
