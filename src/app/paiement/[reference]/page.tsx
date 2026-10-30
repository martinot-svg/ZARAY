'use client';
import {ZarayIcon} from '@/components/ui/zaray-icon';
import BrandLogo from '@/components/brand-logo';
import {useEffect,useState,type FormEvent} from 'react';
import {useParams} from 'next/navigation';

type PaymentStatus={
 reference:string;companySlug:string;companyName:string;offerName:string;amount:number|string;currency:string;
 orderStatus:string;paid:boolean;
 submission:null|{provider:'orange_money'|'mvola';status:'submitted'|'approved'|'rejected';createdAt:string;reviewedAt:string|null};
};
type Method={provider:'orange_money'|'mvola';accountNumber:string;accountName:string;instructions:string};
const providerLabel:Record<string,string>={orange_money:'Orange Money',mvola:'MVola'};
const statusLabel:Record<string,string>={
 submitted:'Justificatif reçu — en attente de vérification',approved:'Paiement validé',
 rejected:'Justificatif rejeté',not_submitted:'Aucun justificatif transmis'
};
export default function PaymentStatusPage(){
 const reference=useParams<{reference:string}>().reference;
 const [status,setStatus]=useState<PaymentStatus|null>(null);
 const [methods,setMethods]=useState<Method[]>([]);
 const [provider,setProvider]=useState('');
 const [email,setEmail]=useState('');
 const [sender,setSender]=useState('');
 const [transaction,setTransaction]=useState('');
 const [proof,setProof]=useState<File|null>(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(true);
 const [sending,setSending]=useState(false);
 async function refresh(){
  setBusy(true);
  try{
   const response=await fetch('/api/manual-payments/status?reference='+encodeURIComponent(reference),{cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Statut indisponible.');
   setStatus(data);setError('');
   if(data.companySlug&&data.orderStatus==='pending_payment'){
    const m=await fetch('/api/portal/'+encodeURIComponent(data.companySlug)+'/payment-methods',{cache:'no-store'});
    if(m.ok){
     const content=await m.json();
     const list=(content.methods||[]) as Method[];
     setMethods(list);setProvider(old=>old||list[0]?.provider||'');
    }else setMethods([]);
   }else setMethods([]);
  }catch(e){setError(e instanceof Error?e.message:'Statut indisponible.');}
  finally{setBusy(false);}
 }
 useEffect(()=>{void refresh();},[reference]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError('');setNotice('');
  if(!status||!proof||!provider)return;
  setSending(true);
  try{
   const form=new FormData();
   form.set('reference',status.reference);
   form.set('provider',provider);
   form.set('customerEmail',email);
   form.set('senderPhone',sender);
   form.set('transactionReference',transaction);
   form.set('proof',proof);
   const response=await fetch('/api/manual-payments/submit',{method:'POST',body:form});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Justificatif refusé.');
   setNotice(data.message||'Justificatif transmis. Paiement à vérifier.');
   setProof(null);
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Envoi impossible.');}
  finally{setSending(false);}
 }
 const selected=methods.find(m=>m.provider===provider);
 const canSubmit=status?.orderStatus==='pending_payment'&&!status.paid&&status.submission?.status!=='submitted'&&methods.length>0;
 return <main className="form-shell"><section className="form-card" style={{width:'min(100%,720px)'}}>
  <div className="workspace-brand"><a href="/" aria-label="ZARAY · Accueil"><BrandLogo/></a></div>
  <p className="eyebrow">ZARAY · PAIEMENT MANUEL</p><h1>Suivi du paiement</h1>
  <p>Référence de commande : <strong>{reference}</strong></p>
  {busy&&<p role="status">Vérification du statut…</p>}
  {status&&<section className="module" style={{minHeight:0,marginTop:20}}>
   <span className="module-number">{status.paid?'PAYÉ':'EN ATTENTE'}</span>
   <h2>{status.offerName}</h2><p>Fournisseur : <strong>{status.companyName}</strong></p>
   <p>Montant : <strong>{Number(status.amount).toLocaleString('fr-FR')} {status.currency}</strong></p>
   <p>État : <strong>{status.paid?'Paiement confirmé':statusLabel[status.submission?.status??'not_submitted']}</strong></p>
   {status.submission&&<><p>Moyen : {providerLabel[status.submission.provider]}</p>
    <p>Justificatif transmis le {new Date(status.submission.createdAt).toLocaleString('fr-FR')}</p>
    {status.submission.reviewedAt&&<p>Décision le {new Date(status.submission.reviewedAt).toLocaleString('fr-FR')}</p>}
   </>}
   <button type="button" className="primary-link" disabled={busy} onClick={()=>void refresh()}><ZarayIcon name="refresh" size={17}/> Actualiser le statut</button>
   <p className="muted" style={{marginTop:14}}>Aucun accès Internet n'est activé par la simple transmission d'un justificatif. Un responsable habilité doit vérifier le paiement.</p>
  </section>}
  {canSubmit&&status&&<section className="module" style={{marginTop:18,minHeight:0}}>
   <p className="eyebrow">ORANGE MONEY · MVOLA</p>
   <h2>Transmettre mon justificatif</h2>
   <p>Envoyez le montant exact au compte affiché par votre fournisseur, puis transmettez votre preuve. N'envoyez pas d'argent si les informations du bénéficiaire sont incorrectes.</p>
   <form onSubmit={submit} className="field-grid">
    <label>Mode de paiement<select value={provider} onChange={e=>setProvider(e.target.value)} required>
     {methods.map(m=><option value={m.provider} key={m.provider}>{providerLabel[m.provider]}</option>)}
    </select></label>
    {selected&&<div className="panel" style={{padding:15}}>
     <p><strong>{providerLabel[selected.provider]} : {selected.accountNumber}</strong></p>
     <p>Bénéficiaire : {selected.accountName}</p>
     <p className="muted">{selected.instructions}</p>
    </div>}
    <label>Adresse e-mail utilisée pour la commande<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="client@exemple.com" required/></label>
    <label>Numéro ayant envoyé le paiement<input type="tel" inputMode="numeric" pattern="03[0-9]{8}" value={sender} onChange={e=>setSender(e.target.value)} placeholder="0341234567" required/></label>
    <label>Référence de transaction<input value={transaction} onChange={e=>setTransaction(e.target.value)} minLength={2} maxLength={120} required/></label>
    <label>Photo ou PDF du justificatif (5 Mo max.)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setProof(e.target.files?.[0]||null)} required/></label>
    <button type="submit" className="primary-link" disabled={sending||!proof}>{sending?'Envoi en cours…':'Soumettre le justificatif'}</button>
   </form>
  </section>}
  {status?.orderStatus==='pending_payment'&&!methods.length&&!busy&&status.submission?.status!=='submitted'&&
    <p className="muted">Aucun moyen Orange Money ou MVola actif pour ce fournisseur. Contactez son responsable pour un paiement en espèces ou des instructions officielles.</p>}
  {notice&&<p className="alert alert-success" role="status">{notice}</p>}
  {error&&<p className="alert alert-error" role="alert">{error}</p>}
  <p style={{marginTop:22}}><a href="/"><ZarayIcon name="back" size={17}/> Retour à ZARAY</a></p>
 </section></main>;
}
