'use client';

import {useCallback,useEffect,useMemo,useState,type CSSProperties,type FormEvent} from 'react';
import {Bell,CalendarClock,CheckCircle2,ChevronRight,Clock3,LogOut,Mail,ShieldCheck,Wifi,WifiOff} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import NotificationInbox from '@/components/notification-inbox';
import './residential-account-portal.css';

type Identity={
 siteId:string;siteName:string;companySlug:string;brandName:string;
 logoDataUri:string|null;primaryColor:string;secondaryColor:string;
 accentColor:string;titleColor:string;welcomeMessage:string;
};
type Subscription={id:string;offer_name:string;validity_days:number;paid_cycles:number;activated_cycles:number;activated_at:string|null;expires_at:string|null;created_at:string};
type Order={id:string;public_reference:string;offer_name:string;status:string;amount:number|string;currency:string;paid_at:string|null;created_at:string};
type Cycle={order_id:string;offer_name:string;amount:number|string;currency:string;paid_at:string;activated_at:string|null;period_start:string|null;period_end:string|null};
type Account={customer:{name:string};site:Identity;subscriptions:Subscription[];orders:Order[];cycles:Cycle[];status:string;usage:{available:boolean;downloadBytes:number|null;uploadBytes:number|null;rateDownBps:number|null;rateUpBps:number|null;message:string}};
type Phase='loading'|'login'|'otp'|'account'|'denied';
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'—';
const money=(value:number|string,currency:string)=>Number(value).toLocaleString('fr-FR')+' '+(currency==='MGA'?'Ar':currency);
function readableInk(color:string){
 const hex=color.replace('#','');
 if(hex.length!==6)return '#fafffb';
 const colors=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const brightness=colors[0]*.2126+colors[1]*.7152+colors[2]*.0722;
 return brightness>.22?'#102319':'#f8fff9';
}
function SubscriberMark({site}:{site:Identity}){
 return site.logoDataUri?<img className="rp-logo" src={site.logoDataUri} alt={'Logo '+site.brandName}/>:
 <span className="rp-monogram" aria-hidden="true">{site.brandName.slice(0,1).toUpperCase()}</span>;
}
export default function ResidentialAccountPortal({siteId}:{siteId:string}){
 const [site,setSite]=useState<Identity|null>(null);
 const [account,setAccount]=useState<Account|null>(null);
 const [phase,setPhase]=useState<Phase>('loading');
 const [email,setEmail]=useState('');
 const [code,setCode]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const loadAccount=useCallback(async()=>{
  const response=await fetch('/api/residential/account?siteId='+encodeURIComponent(siteId),{cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){setPhase('login');setAccount(null);return;}
  if(response.status===403){setPhase('denied');setAccount(null);return;}
  if(!response.ok)throw Error(data.error||'Compte temporairement indisponible.');
  setAccount(data as Account);
  setPhase('account');
 },[siteId]);
 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const response=await fetch('/api/public/residential-site?siteId='+encodeURIComponent(siteId),{cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Site indisponible.');
    if(!active)return;
    setSite(data.site as Identity);
    await loadAccount();
   }catch(e){if(active){setError(e instanceof Error?e.message:'Service indisponible.');setPhase('login');}}
  })();
  return()=>{active=false};
 },[siteId,loadAccount]);
 const style=useMemo(()=>!site?undefined:{
  '--rp-primary':site.primaryColor,
  '--rp-accent':site.accentColor,
  '--rp-page':site.secondaryColor,
  '--rp-ink':readableInk(site.secondaryColor),
  '--rp-primary-ink':readableInk(site.primaryColor),
  '--rp-card':readableInk(site.secondaryColor)==='#102319'?'#ffffff':'#13271f',
  '--rp-card-ink':readableInk(site.secondaryColor)==='#102319'?'#15271e':'#f6fff8',
 } as CSSProperties,[site]);
 async function requestCode(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/residential/otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,siteId})});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Envoi impossible.');
   setNotice(data.message||'Vérifiez votre boîte e-mail.');
   setPhase('otp');
  }catch(e){setError(e instanceof Error?e.message:'Envoi impossible.');}
  finally{setBusy(false);}
 }
 async function verifyCode(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');
  try{
   const auth=createClient();
   const result=await auth.auth.verifyOtp({email:email.trim().toLowerCase(),token:code.trim(),type:'email'});
   if(result.error)throw Error('Code invalide ou expiré.');
   await loadAccount();
  }catch(e){setError(e instanceof Error?e.message:'Connexion impossible.');}
  finally{setBusy(false);}
 }
 async function signOut(){
  await createClient().auth.signOut();
  setAccount(null);setPhase('login');setCode('');setError('');
 }
 const current=account?.subscriptions[0];
 const from=site?.companySlug;
 return <div className="rp-root resident-portal" style={style}>
  <div className="rp-frame">
   <header className="rp-header">
    <div className="rp-identity">
     {site?<SubscriberMark site={site}/>:<span className="rp-monogram"><Wifi size={22}/></span>}
     <div><strong>{site?.brandName||'Mon Internet'}</strong><small>{site?.siteName||'Espace abonné'}</small></div>
    </div>
    {account?<button className="rp-signout" type="button" onClick={()=>void signOut()}><LogOut size={17}/> Déconnexion</button>:<span className="rp-header-caption">Espace résidentiel</span>}
   </header>
   <main className="rp-main">
    {phase==='loading'&&<p role="status">Ouverture de votre espace…</p>}
    {phase==='login'&&<section className="rp-panel rp-auth">
     <span className="rp-overline"><ShieldCheck size={15}/> Accès privé</span>
     <h1>Mon Internet</h1>
     <p>Connectez-vous avec l'adresse e-mail de votre abonnement.</p>
     <form onSubmit={requestCode}>
      <label>Adresse e-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required maxLength={254} placeholder="vous@exemple.mg"/></label>
      <button type="submit" disabled={busy||!site}>{busy?'Envoi…':'Recevoir mon code'} <ChevronRight size={18}/></button>
     </form>
    </section>}
    {phase==='otp'&&<section className="rp-panel rp-auth">
     <span className="rp-overline"><Mail size={15}/> Vérification</span>
     <h1>Vérifier mon e-mail</h1>
     <p>Si votre adresse est enregistrée sur ce site, vous recevrez les instructions de connexion.</p>
     {notice&&<p className="rp-notice" role="status">{notice}</p>}
     <form onSubmit={verifyCode}>
      <label>Code reçu par e-mail<input type="text" inputMode="numeric" pattern="[0-9]{6,8}" maxLength={8} autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,''))} required placeholder="000000"/></label>
      <button type="submit" disabled={busy||code.length<6}>{busy?'Vérification…':'Accéder à mon compte'} <ChevronRight size={18}/></button>
      <button type="button" className="rp-secondary" onClick={()=>{setPhase('login');setNotice('');setCode('');}}>Changer d'adresse</button>
     </form>
    </section>}
    {phase==='denied'&&<section className="rp-panel rp-auth">
     <h1>Compte non associé</h1><p>Cette adresse ne possède pas de dossier résidentiel actif sur ce site.</p>
     <button type="button" onClick={()=>void signOut()}>Utiliser une autre adresse</button>
    </section>}
    {phase==='account'&&account&&<>
     <div className="rp-welcome">
      <div><span className="rp-overline"><Wifi size={16}/> Mon abonnement</span>
       <h1>Bonjour, {account.customer.name}</h1><p>{site?.welcomeMessage||'Consultez les informations de votre connexion Internet.'}</p>
      </div>
      <span className="rp-status"><span className="rp-dot"/>{account.status}</span>
     </div>
     <div className="rp-grid">
      <article className="rp-card"><span className="rp-label"><Wifi size={16}/> Mon forfait</span><strong>{current?.offer_name||'Aucun forfait'}</strong><small>{current?current.validity_days+' jours de validité':'Aucun abonnement enregistré'}</small></article>
      <article className="rp-card"><span className="rp-label"><CalendarClock size={16}/> Échéance</span><strong>{current?.expires_at?date(current.expires_at):'À confirmer'}</strong><small>{current?.activated_at?'Activation : '+date(current.activated_at):'Activation réseau non confirmée'}</small></article>
      <article className="rp-card"><span className="rp-label"><Clock3 size={16}/> Consommation</span><strong>Indisponible</strong><small>Mesures non transmises par le routeur</small></article>
      <article className="rp-card"><span className="rp-label"><WifiOff size={16}/> Débit mesuré</span><strong>Indisponible</strong><small>En attente de données réseau vérifiées</small></article>
     </div>
     <NotificationInbox siteId={siteId} compact />
     <section className="rp-panel">
      <div className="rp-section-heading"><h2>Paiements et renouvellements</h2>{from&&<a href={'/wifi/'+encodeURIComponent(from)+'?siteId='+encodeURIComponent(siteId)}>Voir les offres <ChevronRight size={15}/></a>}</div>
      {account.orders.length?<div className="rp-list">{account.orders.map(order=><div className="rp-list-row" key={order.id}><div><strong>{order.offer_name}</strong><small>{order.public_reference} · {date(order.created_at)}</small></div><div className="rp-list-value"><strong>{money(order.amount,order.currency)}</strong><small>{order.status==='paid'?'Payé':order.status==='pending_payment'?'Paiement attendu':order.status}</small></div></div>)}</div>:<p>Aucune opération enregistrée pour ce site.</p>}
     </section>
     <p className="rp-network-note"><ShieldCheck size={16}/> Votre accès Internet n'est confirmé qu'après activation par votre fournisseur. Les mesures réseau ne sont pas simulées.</p>
    </>}
    {error&&<p className="rp-error" role="alert">{error}</p>}
   </main>
   <footer className="rp-footer"><span>{site?.brandName||'Votre fournisseur Internet'}</span><span>Connexion sécurisée</span></footer>
  </div>
 </div>;
}
