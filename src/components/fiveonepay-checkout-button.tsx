'use client';
import {useEffect,useState} from 'react';
import {CreditCard,ExternalLink} from 'lucide-react';

export default function FiveOneCheckoutButton({siteId,reference,customerEmail}:{
 siteId:string;reference:string;customerEmail:string;
}){
 const [ready,setReady]=useState(false);
 const [sandbox,setSandbox]=useState(false);
 const [working,setWorking]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  fetch('/api/fiveonepay/availability?siteId='+encodeURIComponent(siteId),{cache:'no-store'})
   .then(r=>r.json()).then(d=>{if(alive){setReady(d.available===true);setSandbox(d.environment==='sandbox');}})
   .catch(()=>{if(alive)setReady(false);});
  return()=>{alive=false};
 },[siteId]);
 if(!ready||!reference||!customerEmail)return null;
 async function pay(){
  setWorking(true);setError('');
  try{
   const response=await fetch('/api/fiveonepay/checkout',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({reference,customerEmail})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Paiement indisponible.');
   const paymentUrl=String(data.paymentUrl||'');
   const parsed=new URL(paymentUrl);
   if(parsed.protocol!=='https:'||parsed.hostname!=='pay.fiveonepay.com')
    throw Error('Adresse de paiement non reconnue.');
   window.location.assign(paymentUrl);
  }catch(e){setError(e instanceof Error?e.message:'Impossible d’ouvrir le paiement.');setWorking(false);}
 }
 return <div style={{display:'grid',gap:7,margin:'10px 0'}}>
  <button type="button" disabled={working} onClick={()=>void pay()}
   style={{display:'inline-flex',gap:9,alignItems:'center',justifyContent:'center',
    background:'#17874c',color:'#fff',border:0,borderRadius:12,padding:'12px 18px',fontWeight:700,cursor:'pointer'}}>
   <CreditCard size={18}/>{working?'Ouverture du paiement…':sandbox?'Simuler le paiement Mobile Money':'Payer par Mobile Money'} <ExternalLink size={16}/>
  </button>
  <small style={{opacity:.72}}>Paiement sécurisé FiveOne Pay · MVola, Orange Money, Airtel Money{sandbox?' · Simulation, aucun débit réel':''}</small>
  {error&&<small role="alert" style={{color:'#e05f56'}}>{error}</small>}
 </div>;
}
