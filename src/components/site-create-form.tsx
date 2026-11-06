'use client';

import {useRef,useState,type ChangeEvent,type FormEvent} from 'react';
import {ZarayIcon} from '@/components/ui/zaray-icon';
import {optimizeLogo} from '@/lib/logo-optimizer';
import {paletteFromLogo,type LogoPalette} from '@/lib/logo-palette';
import {legibleInk} from '@/lib/ticket-pdf';

type SiteCreated={
 id:string;company_id:string;name:string;status:string;created_at:string;
 address:string;contact_email:string;contact_phone:string;
};
const defaultPalette:LogoPalette={
 primary_color:'#167a46',secondary_color:'#ffffff',accent_color:'#0e9f6e',
 title_color:'#10251a',border_color:'#a5b9ad'
};

export default function SiteCreateForm({companyId,companyName,onCreated}:{
 companyId:string;companyName:string;onCreated:(site:SiteCreated)=>void;
}){
 const [name,setName]=useState('');
 const [address,setAddress]=useState('');
 const [email,setEmail]=useState('');
 const [phone,setPhone]=useState('');
 const [logoDataUri,setLogoDataUri]=useState('');
 const [palette,setPalette]=useState<LogoPalette>(defaultPalette);
 const [cropped,setCropped]=useState(false);
 const [processing,setProcessing]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const requestId=useRef(0);
 const previewName=name.trim()||'Nom du site';
 const previewColor=palette.primary_color;
 const previewBackground=palette.secondary_color;
 const buttonInk=legibleInk('#0b1922',previewColor);

 async function importLogo(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];
  const request=++requestId.current;
  setLogoDataUri('');setCropped(false);setError('');setNotice('');
  if(!file)return;
  if(!['image/png','image/webp'].includes(file.type)||file.size<16||file.size>2_000_000){
   setError('Logo obligatoire : PNG ou WebP avec fond transparent, 2 Mo maximum.');
   event.target.value='';return;
  }
  setProcessing(true);
  try{
   const uri=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(Error('Fichier illisible.'));
    reader.onerror=()=>reject(Error('Impossible de lire le logo.'));
    reader.readAsDataURL(file);
   });
   const optimized=await optimizeLogo(uri);
   const colors=await paletteFromLogo(optimized.dataUri);
   if(requestId.current!==request)return;
   setLogoDataUri(optimized.dataUri);
   setCropped(optimized.cropped);
   setPalette(colors||defaultPalette);
   setNotice(optimized.cropped
    ?'Logo validé : les marges entièrement transparentes ont été rognées.'
    :'Logo transparent validé : aucune marge vide à retirer.');
  }catch(e){
   if(requestId.current===request)setError(e instanceof Error?e.message:'Le logo doit déjà avoir un fond transparent.');
  }finally{if(requestId.current===request)setProcessing(false);}
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!logoDataUri||processing){setError('Importez d’abord un logo PNG ou WebP transparent.');return;}
  setSaving(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/sites',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,name,address,email,phone,logoDataUri,palette})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||'Création impossible.');
   if(!data.site?.id)throw Error('Création du site non confirmée.');
   onCreated(data.site);
   setName('');setAddress('');setEmail('');setPhone('');
   setLogoDataUri('');setCropped(false);setPalette(defaultPalette);
   setNotice('Site créé avec ses coordonnées et son logo. Le ticket et le portail captif utilisent déjà son identité graphique.');
  }catch(e){setError(e instanceof Error?e.message:'Création impossible.');}
  finally{setSaving(false);}
 }
 return <form className="form-stack compact-form" onSubmit={event=>void submit(event)}>
  <span className="muted">Entreprise : {companyName}</span>
  <div className="workspace-grid" style={{gap:12}}>
   <label>Nom du site
    <input value={name} onChange={e=>setName(e.target.value)}
     required minLength={2} maxLength={120} autoComplete="organization"
     placeholder="Ex. M’lay Connexion — Centre"/>
   </label>
   <label>Adresse du site
    <input value={address} onChange={e=>setAddress(e.target.value)}
     required minLength={3} maxLength={160} autoComplete="street-address"
     placeholder="Quartier, rue, ville"/>
   </label>
   <label>E-mail du site
    <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
     required maxLength={254} autoComplete="email" placeholder="contact@exemple.mg"/>
   </label>
   <label>Téléphone du site
    <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}
     required minLength={5} maxLength={32} pattern="[+0-9(). /-]+"
     autoComplete="tel" placeholder="+261 34 00 000 00"/>
   </label>
  </div>
  <section style={{display:'grid',gap:10}}>
   <label htmlFor="site-new-logo">Logo transparent obligatoire (PNG ou WebP)</label>
   <input id="site-new-logo" type="file" accept="image/png,image/webp"
    onChange={e=>void importLogo(e)} disabled={processing||saving} required={!logoDataUri}/>
   <p className="muted">Fournissez un logo déjà détouré. ZARAY retire uniquement les marges transparentes inutiles : aucune couleur ni partie visible du logo ne sera supprimée.</p>
   {processing&&<p role="status">Vérification et rognage des marges transparentes…</p>}
   {logoDataUri&&<div style={{display:'grid',gap:12}}>
    <span className="status-pill">{cropped?'Logo transparent rogné':'Logo transparent prêt'}</span>
    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
     <div style={{flex:'1 1 180px',minWidth:0,background:previewBackground,border:'1px solid #a7b5be',borderRadius:12,padding:12,color:legibleInk(palette.title_color,previewBackground)}}>
      <div style={{fontSize:11,fontWeight:750,marginBottom:7}}>APERÇU TICKET</div>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
       <img src={logoDataUri} alt={'Logo du site '+previewName}
        style={{maxWidth:85,maxHeight:75,width:'auto',height:'auto',objectFit:'contain',flexShrink:0}}/>
       <strong>{previewName}</strong>
      </div>
     </div>
     <div style={{flex:'1 1 180px',minWidth:0,background:'linear-gradient(135deg,#122c38,#071b29)',border:'1px solid '+previewColor,borderRadius:12,padding:12,color:'#f5fafc',textAlign:'center'}}>
      <div style={{fontSize:11,fontWeight:750,marginBottom:7}}>APERÇU PORTAIL CAPTIF</div>
      <img src={logoDataUri} alt="" style={{maxHeight:77,maxWidth:'100%',width:'auto',height:'auto',objectFit:'contain'}}/>
      <div style={{fontWeight:700,marginTop:5}}>{previewName}</div>
      <div style={{background:previewColor,color:buttonInk,borderRadius:7,padding:7,fontSize:12,marginTop:9,fontWeight:700}}>Connexion Wi-Fi</div>
     </div>
    </div>
   </div>}
  </section>
  <button className="primary-link" type="submit" disabled={saving||processing||!logoDataUri||!companyId}>
   <ZarayIcon name="add" size={18}/> {saving?'Création…':'Créer le site'}
  </button>
  {error&&<p className="alert alert-error" role="alert">{error}</p>}
  {notice&&<p className="alert alert-success" role="status">{notice}</p>}
 </form>;
}
