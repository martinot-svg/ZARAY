'use client';

import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Clock3,CreditCard,House,LockKeyhole,Menu,Router,ShieldCheck,Ticket,Wifi,WifiOff,X} from 'lucide-react';
import './public-wifi-portal.css';
import BrandLogo from '@/components/brand-logo';

type Offer={id:string;name:string;description?:string;durationMinutes:number;validityDays?:number;priceAmount:number;currency:string;maxDevices?:number};
type ResidentialSite={id:string;name:string;status:string};
type Method={provider:'orange_money'|'mvola';accountNumber:string;accountName:string;instructions:string};
type Order={reference:string;status:string;amount:number;currency:string;offer_name:string};
type Mode='home'|'ticket'|'subscribe'|'order';
const sampleTicketOffers:Offer[]=[
 {id:'preview-90',name:'Découverte',description:'Navigation occasionnelle',durationMinutes:90,priceAmount:500,currency:'MGA'},
 {id:'preview-180',name:'Confort',description:'Profitez de plus de temps en ligne',durationMinutes:180,priceAmount:1000,currency:'MGA'},
 {id:'preview-360',name:'Journée connectée',description:'Pour vos activités quotidiennes',durationMinutes:360,priceAmount:2000,currency:'MGA'}
];
const sampleSubscriptions:Offer[]=[
 {id:'preview-res-1',name:'Résidentiel Essentiel',description:'Offre de démonstration — 30 jours',durationMinutes:43200,validityDays:30,priceAmount:35000,currency:'MGA'},
 {id:'preview-res-2',name:'Résidentiel Premium',description:'Offre de démonstration — 30 jours',durationMinutes:43200,validityDays:30,priceAmount:50000,currency:'MGA'}
];
function displayPrice(o:Offer){return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(o.priceAmount)+' '+(o.currency==='MGA'?'Ar':o.currency);}
function displayTime(minutes:number){if(minutes<60)return minutes+' min';const h=Math.floor(minutes/60),m=minutes%60;return h+' h'+(m?' '+m+' min':'');}
function requestJson(url:string){return fetch(url,{cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(typeof data.error==='string'?data.error:'Service indisponible.');return data;});}

export default function PublicWifiPortal({slug}: {slug?:string}){
 const demo=!slug;
 const [mode,setMode]=useState<Mode>('home');
 const [companyName,setCompanyName]=useState(demo?'Votre fournisseur':'');
 const [slugEntry,setSlugEntry]=useState('');
 const [loading,setLoading]=useState(!demo);
 const [siteName,setSiteName]=useState('');
 const [ticketOffers,setTicketOffers]=useState<Offer[]>(demo?sampleTicketOffers:[]);
 const [subscriptionOffers,setSubscriptionOffers]=useState<Offer[]>(demo?sampleSubscriptions:[]);
 const [residentialSites,setResidentialSites]=useState<ResidentialSite[]>([]);
 const [selectedSiteId,setSelectedSiteId]=useState('');
 const [paymentMethods,setPaymentMethods]=useState<Method[]>([]);
 const [selectedTicket,setSelectedTicket]=useState<Offer|null>(null);
 const [selectedSubscription,setSelectedSubscription]=useState('');
 const [ticketUser,setTicketUser]=useState('');
 const [ticketPassword,setTicketPassword]=useState('');
 const [ticketMessage,setTicketMessage]=useState('');
 const [customerName,setCustomerName]=useState('');
 const [customerEmail,setCustomerEmail]=useState('');
 const [customerPhone,setCustomerPhone]=useState('');
 const [order,setOrder]=useState<Order|null>(null);
 const [provider,setProvider]=useState('');
 const [senderPhone,setSenderPhone]=useState('');
 const [transactionReference,setTransactionReference]=useState('');
 const [proof,setProof]=useState<File|null>(null);
 const [paymentNote,setPaymentNote]=useState('');
 const [paymentDone,setPaymentDone]=useState(false);
 const [submitting,setSubmitting]=useState(false);
 const [submittingProof,setSubmittingProof]=useState(false);
 const [error,setError]=useState('');
 const [mobileMenu,setMobileMenu]=useState(false);
 const [enterpriseDialog,setEnterpriseDialog]=useState(false);
 const [offersDialog,setOffersDialog]=useState(false);
 const [showPassword,setShowPassword]=useState(false);

 useEffect(()=>{
  if(!slug)return;
  let mounted=true;
  (async()=>{
   setLoading(true);setError('');
   const [catalog,methods]=await Promise.allSettled([
    requestJson('/api/portal/'+encodeURIComponent(slug)),
    requestJson('/api/portal/'+encodeURIComponent(slug)+'/payment-methods')
   ]);
   if(!mounted)return;
   if(catalog.status==='fulfilled'){
    const data=catalog.value;
    setCompanyName(data.companyName||slug);
    const list:Offer[]=(data.offers||[]).map((o:Offer)=>({...o,priceAmount:Number(o.priceAmount)}));
    setSubscriptionOffers(list);
    setSelectedSubscription(list[0]?.id||'');
    const siteList:ResidentialSite[]=data.sites||[];
    setResidentialSites(siteList);
    const linkedSite=new URLSearchParams(window.location.search).get('siteId')||'';
    setSelectedSiteId(siteList.some(s=>s.id===linkedSite)?linkedSite:siteList.length===1?siteList[0].id:'');
   }else{
    setError(catalog.reason instanceof Error?catalog.reason.message:'Catalogue d’abonnements indisponible.');
    setCompanyName(slug);
   }
   if(methods.status==='fulfilled'){
    const list:Method[]=methods.value.methods||[];
    setPaymentMethods(list);setProvider(list[0]?.provider||'');
   }
   const params=new URLSearchParams(window.location.search);
   const siteId=params.get('siteId')||'';
   if(/^[0-9a-f-]{36}$/i.test(siteId)){
    try{
     const data=await requestJson('/api/public/wifi-offers?siteId='+encodeURIComponent(siteId));
     if(!mounted)return;
     if(data.companySlug!==slug)throw new Error('Le site ne correspond pas à cette entreprise.');
     setTicketOffers(data.offers||[]);
     setSiteName(data.siteName||'');
     setCompanyName(data.companyName||slug);
    }catch{
     if(mounted)setTicketOffers([]);
    }
   }
   if(mounted)setLoading(false);
  })();
  return()=>{mounted=false;};
 },[slug]);

 function toMode(next:Mode){setMode(next);setTicketMessage('');setError('');setMobileMenu(false);window.scrollTo?.({top:0,behavior:'smooth'});}
 function openTicket(offer:Offer|null){setSelectedTicket(offer);setTicketUser('');setTicketPassword('');toMode('ticket');}
 function previewTicket(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const user=ticketUser.trim().toUpperCase();
  if(!/^[A-Z0-9]{3,5}$/.test(user)||!/^([0-9]{3,5}|[A-Za-z0-9]{12,32})$/.test(ticketPassword)){
   setTicketMessage('Vérifiez les identifiants : 3 à 5 caractères pour le nom d’utilisateur et un PIN de 3 à 5 chiffres.');return;
  }
  setTicketPassword('');
  setTicketMessage('Formulaire prêt. La vérification réelle du ticket et l’accès Internet restent indisponibles avant la connexion au MikroTik. Aucune donnée n’a été envoyée.');
 }
 async function subscribe(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError('');
  if(demo){setError('Mode démonstration : aucun compte ni paiement n’est créé. Renseignez l’identifiant de votre entreprise pour utiliser la véritable inscription.');return;}
  if(!selectedSubscription){setError('Choisissez un forfait avant de poursuivre.');return;}
  if(residentialSites.length>1&&!selectedSiteId){setError('Choisissez votre site de raccordement avant de poursuivre.');return;}
  setSubmitting(true);
  try{
   const response=await fetch('/api/portal/'+encodeURIComponent(slug||''),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({offerId:selectedSubscription,customerName,customerEmail,customerPhone,siteId:selectedSiteId||null})
   });
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Inscription impossible.');
   setOrder(data.order);setPaymentDone(false);toMode('order');
  }catch(e){setError(e instanceof Error?e.message:'Inscription impossible.');}
  finally{setSubmitting(false);}
 }
 async function sendPayment(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError('');
  if(!order||!provider||!proof){setError('Choisissez un moyen de paiement et ajoutez un justificatif.');return;}
  setSubmittingProof(true);
  try{
   const form=new FormData();
   form.set('reference',order.reference);
   form.set('provider',provider);
   form.set('customerEmail',customerEmail);
   form.set('senderPhone',senderPhone);
   form.set('transactionReference',transactionReference);
   form.set('proof',proof);
   const response=await fetch('/api/manual-payments/submit',{method:'POST',body:form});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Impossible d’envoyer le justificatif.');
   setPaymentNote(data.message||'Justificatif transmis. Paiement en cours de vérification.');
   setPaymentDone(true);setProof(null);
  }catch(e){setError(e instanceof Error?e.message:'Envoi impossible.');}
  finally{setSubmittingProof(false);}
 }
 const validSlug=/^[a-z0-9-]{2,80}$/i.test(slugEntry.trim());
 const selectedOffer=subscriptionOffers.find(o=>o.id===selectedSubscription);
 const destination=validSlug?'/wifi/'+encodeURIComponent(slugEntry.trim().toLowerCase()):'';
 const ticketCount=ticketOffers.length;
 return <div className={mode==='home'?'zw-root zw-landing':'zw-root'}>
  <div className="zw-sky" aria-hidden="true"/><div className="zw-mesh" aria-hidden="true"/>
  <div className="zw-shell">
   <header className="zw-nav">
    <button type="button" className="zw-brand" onClick={()=>toMode('home')} aria-label="Portail ZARAY — accueil">
     <span className="zw-mark"><Wifi size={23}/></span>
     <span>ZARAY <small>WIFI PORTAL</small></span>
    </button>
    <nav className="zw-links" aria-label="Navigation du portail">
     <button type="button" onClick={()=>toMode('home')}>Accueil</button>
     <button type="button" onClick={()=>openTicket(null)}>Mon ticket</button>
     <button type="button" onClick={()=>toMode('subscribe')}>Devenir abonné</button>
    </nav>
    <div className="zw-nav-right">
     <span className="zw-network"><span className="zw-live-dot"/> {demo?'DÉMONSTRATION':'PORTAIL PUBLIC'}</span>
     <button type="button" className="zw-menu" aria-label="Afficher le menu" onClick={()=>setMobileMenu(!mobileMenu)}>{mobileMenu?<X size={21}/>:<Menu size={21}/>}</button>
    </div>
   </header>
   {mobileMenu&&<div className="zw-mobile-nav"><button onClick={()=>toMode('home')}>Accueil</button><button onClick={()=>openTicket(null)}>Mon ticket</button><button onClick={()=>toMode('subscribe')}>Devenir abonné</button></div>}

   <main className="zw-main">
    <div className="zw-topline"><span className="zw-line"/> EXPÉRIENCE INTERNET CONNECTÉE <span className="zw-line"/></div>

    {mode==='home'&&<section className="zw-simple-screen" aria-labelledby="zw-welcome-title">
     <div className="zw-simple-card">
      <div className="zw-simple-brand" aria-label="ZARAY WIFI">
       <span className="zw-simple-emblem"><Wifi size={30} strokeWidth={2.4}/></span>
       <BrandLogo className="zw-simple-logo" surface="dark"/>
      </div>
      <div className="zw-simple-heading">
       <span className="zw-simple-eyebrow">PORTAIL WIFI · {siteName||'CONNEXION'}</span>
       <h1 id="zw-welcome-title">Bienvenue chez <span>{demo?'ZARAY WIFI':companyName}</span></h1>
       <p>Chaque connexion ouvre votre univers.</p>
      </div>
      <form className="zw-simple-login" onSubmit={previewTicket}>
       <label htmlFor="zw-simple-user">Nom d’utilisateur
        <span className="zw-simple-field"><Ticket size={17} aria-hidden="true"/><input id="zw-simple-user" value={ticketUser} onChange={e=>setTicketUser(e.target.value.toUpperCase())} autoComplete="username" autoCapitalize="characters" spellCheck={false} placeholder="Nom d’utilisateur" minLength={3} maxLength={5} required/></span>
       </label>
       <label htmlFor="zw-simple-password">Mot de passe
        <span className="zw-simple-field"><LockKeyhole size={17} aria-hidden="true"/><input id="zw-simple-password" type={showPassword?'text':'password'} value={ticketPassword} onChange={e=>setTicketPassword(e.target.value)} autoComplete="off" placeholder="Mot de passe du ticket" minLength={3} maxLength={32} required/><button type="button" className="zw-simple-eye" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'Masquer le mot de passe':'Afficher le mot de passe'}>{showPassword?'Masquer':'Afficher'}</button></span>
       </label>
       <button type="submit" className="zw-simple-connect"><Wifi size={18}/> Se connecter <ArrowRight size={18}/></button>
      </form>
      {ticketMessage&&<p className="zw-simple-alert" role="status">{ticketMessage}</p>}
      <button type="button" className="zw-simple-subscribe" onClick={()=>toMode('subscribe')}><House size={18}/> Devenir un abonné de {companyName} <ArrowRight size={18}/></button>
      <button type="button" className="zw-simple-offers-link" onClick={()=>setOffersDialog(true)}>Voir les offres Wi-Fi {ticketCount>0?'('+ticketCount+')':''} <ArrowRight size={14}/></button>
      <div className="zw-simple-footer">
       <span>Fournisseur : <strong>{companyName}</strong></span>
       <span>{demo?'Démonstration : aucun accès Internet activé':'Vérification du ticket par MikroTik après installation'}</span>
      </div>
     </div>
     {offersDialog&&<div className="zw-enterprise-shade" role="presentation" onClick={()=>setOffersDialog(false)}>
      <section className="zw-enterprise-dialog zw-simple-offers-dialog" role="dialog" aria-modal="true" aria-labelledby="zw-offers-title" onClick={e=>e.stopPropagation()}>
       <button className="zw-dialog-close" type="button" aria-label="Fermer les offres" onClick={()=>setOffersDialog(false)}><X size={20}/></button>
       <span className="zw-overline">TICKETS WI-FI</span>
       <h2 id="zw-offers-title">Offres disponibles</h2>
       {loading?<p role="status">Chargement des offres…</p>:ticketCount?<div className="zw-simple-offers-list">{ticketOffers.map(o=><button type="button" key={o.id} onClick={()=>{setOffersDialog(false);openTicket(o);}}><span><strong>{o.name}</strong><small>{displayTime(o.durationMinutes)}</small></span><b>{displayPrice(o)}</b><ArrowRight size={16}/></button>)}</div>:<p>Aucun ticket prêt à vendre n’est encore publié pour ce site.</p>}
       <button type="button" className="zw-simple-existing" onClick={()=>{setOffersDialog(false);openTicket(null);}}>J’ai déjà un ticket <ArrowRight size={16}/></button>
      </section>
     </div>}
     {demo&&<div className="zw-simple-demo-entry"><button type="button" onClick={()=>setEnterpriseDialog(true)}>Accéder au portail de mon entreprise <ArrowRight size={14}/></button></div>}
     {enterpriseDialog&&<div className="zw-enterprise-shade" role="presentation" onClick={()=>setEnterpriseDialog(false)}>
      <section className="zw-enterprise-dialog" role="dialog" aria-modal="true" aria-labelledby="zw-enterprise-title" onClick={e=>e.stopPropagation()}>
       <button className="zw-dialog-close" type="button" aria-label="Fermer" onClick={()=>setEnterpriseDialog(false)}><X size={20}/></button>
       <span className="zw-overline">PORTAIL DE VOTRE ENTREPRISE</span>
       <h2 id="zw-enterprise-title">Ouvrir les offres réelles</h2>
       <p>Entrez l’identifiant public de votre entreprise pour accéder à son portail et à l’inscription résidentielle réelle.</p>
       <form onSubmit={e=>{e.preventDefault();if(validSlug)window.location.assign(destination);}} className="zw-form">
        <label htmlFor="zw-enterprise">Identifiant public de l’entreprise<input id="zw-enterprise" value={slugEntry} onChange={e=>setSlugEntry(e.target.value)} placeholder="ex. mon-entreprise" minLength={2} maxLength={80} pattern="[a-zA-Z0-9-]{2,80}" required autoFocus/></label>
        <button className="zw-cta zw-wide" type="submit" disabled={!validSlug}>Ouvrir mon portail <ArrowRight size={16}/></button>
       </form>
      </section>
     </div>}
    </section>}
    {mode==='ticket'&&<section className="zw-flow"><button className="zw-back" type="button" onClick={()=>toMode('home')}><ArrowLeft size={17}/> Retour aux offres</button><div className="zw-form-card"><div className="zw-flow-icon"><Ticket size={26}/></div><span className="zw-overline">ACCÈS OCCASIONNEL</span><h1>Connectez votre ticket</h1><p>Renseignez le nom d’utilisateur et le code présents sur le ticket acheté auprès de votre vendeur.</p>{selectedTicket&&<div className="zw-selection"><div><strong>{selectedTicket.name}</strong><span>{displayTime(selectedTicket.durationMinutes)}</span></div><b>{displayPrice(selectedTicket)}</b></div>}<form onSubmit={previewTicket} className="zw-form"><label htmlFor="zw-user">Nom d’utilisateur du ticket<input id="zw-user" value={ticketUser} onChange={e=>setTicketUser(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" placeholder="Ex. AB123" maxLength={5} minLength={3} required/></label><label htmlFor="zw-code">Mot de passe du ticket<input id="zw-code" value={ticketPassword} onChange={e=>setTicketPassword(e.target.value)} type="password" autoComplete="off" placeholder="Code du ticket" maxLength={32} minLength={3} required/></label><button className="zw-cta zw-wide" type="submit"><LockKeyhole size={18}/> Vérifier le formulaire <ArrowRight size={18}/></button></form>{ticketMessage&&<div role="status" className="zw-notice">{ticketMessage}</div>}<div className="zw-muted-note"><Router size={17}/> Avant la connexion de ZARAY au MikroTik, les identifiants restent sur cet appareil. Ce formulaire n’authentifie pas et n’active pas le ticket.</div></div></section>}
    {mode==='subscribe'&&<section className="zw-flow"><button className="zw-back" type="button" onClick={()=>toMode('home')}><ArrowLeft size={17}/> Retour au portail</button><div className="zw-form-card zw-subscribe-card"><div className="zw-flow-icon"><House size={26}/></div><span className="zw-overline">ABONNEMENT RÉSIDENTIEL</span><h1>Devenir un abonné de {companyName}</h1><p>Remplissez votre demande : votre fiche client sera créée dans ZARAY après enregistrement de votre souscription. Aucun accès réseau ne sera accordé avant paiement et activation.</p>{demo&&<div className="zw-notice"><ShieldCheck size={17}/> Démonstration : aucune donnée saisie ici ne sera enregistrée. Utilisez le portail de votre entreprise pour une véritable inscription.</div>}{loading?<p role="status">Chargement des offres…</p>:subscriptionOffers.length?<form className="zw-form" onSubmit={subscribe}><label htmlFor="zw-sub-offer">Choisir mon abonnement<select id="zw-sub-offer" value={selectedSubscription||subscriptionOffers[0]?.id} onChange={e=>setSelectedSubscription(e.target.value)} required>{subscriptionOffers.map(o=><option value={o.id} key={o.id}>{o.name} — {displayPrice(o)} / {o.validityDays||1} jour(s)</option>)}</select></label>{!demo&&residentialSites.length>1?<label htmlFor="zw-res-site">Votre site de raccordement<select id="zw-res-site" value={selectedSiteId} onChange={e=>setSelectedSiteId(e.target.value)} required><option value="">Sélectionnez un site</option>{residentialSites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></label>:!demo&&residentialSites.length===1?<div className="zw-selection"><strong>Site de raccordement</strong><b>{residentialSites[0].name}</b></div>:!demo&&<div className="zw-notice">Aucun site n’est encore enregistré pour ce fournisseur. Votre dossier pourra être rattaché à un site par son administrateur avant activation.</div>}<label htmlFor="zw-fullname">Nom complet<input id="zw-fullname" value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Votre nom et prénom" minLength={2} maxLength={160} autoComplete="name" required/></label><label htmlFor="zw-email">Adresse e-mail<input id="zw-email" type="email" value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)} placeholder="nom@exemple.com" maxLength={254} autoComplete="email" required/></label><label htmlFor="zw-phone">Téléphone (facultatif)<input id="zw-phone" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} type="tel" placeholder="034 12 345 67" maxLength={32} autoComplete="tel"/></label>{selectedOffer&&<div className="zw-selection"><strong>Abonnement choisi</strong><b>{displayPrice(selectedOffer)}</b></div>}<button type="submit" className="zw-cta zw-wide" disabled={submitting}>{submitting?'Enregistrement…':demo?'Essayer le formulaire':'Enregistrer ma souscription'} <ArrowRight size={18}/></button></form>:<div className="zw-empty"><WifiOff size={25}/> Aucun abonnement actif n’est disponible pour cette entreprise.</div>}{error&&<p className="zw-error" role="alert">{error}</p>}{demo&&<div className="zw-muted-note">Pour les clients réels, le formulaire d’inscription doit être ouvert sur le portail propre à l’entreprise.</div>}</div></section>}
    {mode==='order'&&order&&<section className="zw-flow"><button className="zw-back" type="button" onClick={()=>toMode('home')}><ArrowLeft size={17}/> Retour au portail</button><div className="zw-form-card zw-subscribe-card"><div className="zw-flow-icon"><CheckCircle2 size={27}/></div><span className="zw-overline">SOUSCRIPTION ENREGISTRÉE</span><h1>Votre demande est créée.</h1><p>Votre fiche client a été enregistrée auprès de {companyName}. L’abonnement sera activé seulement après vérification de votre paiement et connexion au réseau.</p><div className="zw-reference"><span>Référence de commande</span><strong>{order.reference}</strong></div><div className="zw-selection"><div><strong>{order.offer_name}</strong><span>En attente de paiement</span></div><b>{new Intl.NumberFormat('fr-FR').format(order.amount)} {order.currency==='MGA'?'Ar':order.currency}</b></div>{paymentDone?<div className="zw-notice" role="status"><CheckCircle2 size={19}/>{paymentNote} <Link href={'/paiement/'+order.reference}>Consulter le statut du paiement</Link></div>:paymentMethods.length?<><h2>Envoyer un justificatif de paiement</h2><form className="zw-form" onSubmit={sendPayment}><label htmlFor="zw-provider">Moyen de paiement<select id="zw-provider" value={provider} onChange={e=>setProvider(e.target.value)} required>{paymentMethods.map(m=><option value={m.provider} key={m.provider}>{m.provider==='mvola'?'MVola':'Orange Money'}</option>)}</select></label>{paymentMethods.filter(m=>m.provider===provider).map(m=><div className="zw-payment-info" key={m.provider}><strong>{m.accountNumber}</strong><span>Bénéficiaire : {m.accountName}</span><span>{m.instructions}</span></div>)}<label htmlFor="zw-sender">Numéro émetteur<input id="zw-sender" value={senderPhone} onChange={e=>setSenderPhone(e.target.value)} pattern="03[0-9]{8}" type="tel" placeholder="0341234567" required/></label><label htmlFor="zw-transaction">Référence de la transaction<input id="zw-transaction" value={transactionReference} onChange={e=>setTransactionReference(e.target.value)} minLength={2} maxLength={120} required/></label><label htmlFor="zw-proof">Justificatif JPG, PNG, WEBP ou PDF (5 Mo max.)<input id="zw-proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setProof(e.target.files?.[0]||null)} required/></label><button className="zw-cta zw-wide" disabled={submittingProof||!proof} type="submit">{submittingProof?'Envoi du justificatif…':'Soumettre mon justificatif'} <ArrowRight size={18}/></button></form></>:<div className="zw-notice">Aucun moyen de paiement n’est configuré pour cette entreprise. N’envoyez pas d’argent sans instructions officielles.</div>}{error&&<p className="zw-error" role="alert">{error}</p>}<Link className="zw-status-link" href={'/paiement/'+order.reference}>Consulter l’état de mon paiement <ArrowRight size={16}/></Link></div></section>}
   </main>
   <footer className="zw-footer"><div><span className="zw-mark zw-small"><Wifi size={17}/></span><strong>ZARAY</strong><span>Connecter les personnes. Simplifier l’accès.</span></div><span><ShieldCheck size={16}/> Portail sécurisé · Propulsé par ZARAY</span></footer>
  </div>
 </div>;
}
