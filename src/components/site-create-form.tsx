'use client';

import {useEffect,useState,type ChangeEvent,type FormEvent} from 'react';
import {ZarayIcon} from '@/components/ui/zaray-icon';
import {paletteFromLogo,type LogoPalette} from '@/lib/logo-palette';
import {optimizeLogo} from '@/lib/logo-optimizer';
import {legibleInk} from '@/lib/ticket-pdf';
import {uploadOriginalSiteLogo,validateLogoFile} from '@/lib/site-logo-upload';

type SiteCreated={
 id:string;company_id:string;name:string;status:string;created_at:string;
 address:string;contact_email:string;contact_phone:string;
};
const defaultPalette:LogoPalette={
 primary_color:'#167a46',secondary_color:'#ffffff',accent_color:'#0e9f6e',
 title_color:'#10251a',border_color:'#a5b9ad'
};
type Files={light:File|null;dark:File|null};
export default function SiteCreateForm({companyId,companyName,onCreated}:{
 companyId:string;companyName:string;onCreated:(site:SiteCreated)=>void;
}){
 const [name,setName]=useState('');
 const [address,setAddress]=useState('');
 const [email,setEmail]=useState('');
 const [phone,setPhone]=useState('');
 const [files,setFiles]=useState<Files>({light:null,dark:null});
 const [palette,setPalette]=useState<LogoPalette>(defaultPalette);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [inputKey,setInputKey]=useState(0);
 const [lightPreview,setLightPreview]=useState('');
 const [darkPreview,setDarkPreview]=useState('');
 // Preview only raster formats. Untrusted SVG is strictly checked server-side.
 useEffect(()=>{
  const a=files.light&&files.light.type!=='image/svg+xml'?URL.createObjectURL(files.light):'';
  const b=files.dark&&files.dark.type!=='image/svg+xml'?URL.createObjectURL(files.dark):'';
  setLightPreview(a||'');setDarkPreview(b||'');
  return()=>{if(a)URL.revokeObjectURL(a);if(b)URL.revokeObjectURL(b);};
 },[files]);
 async function choose(event:ChangeEvent<HTMLInputElement>,variant:'light'|'dark'){
  const file=event.target.files?.[0]??null;
  setError('');setNotice('');
  if(file){
   try{validateLogoFile(file);}
   catch(e){event.target.value='';setError(e instanceof Error?e.message:'Fichier invalide.');return;}
  }
  setFiles(old=>({...old,[variant]:file}));
  if(variant==='light'&&file&&file.type!=='image/svg+xml'&&file.size<=2_000_000){
   // Retain existing palette detection when convenient; it never affects the
   // immutable original sent directly to private Supabase Storage.
   try{
    const uri=await new Promise<string>((resolve,reject)=>{
     const reader=new FileReader();
     reader.onload=()=>resolve(String(reader.result||''));
     reader.onerror=()=>reject(Error('Logo illisible'));
     reader.readAsDataURL(file);
    });
    const optimized=await optimizeLogo(uri);
    const colors=await paletteFromLogo(optimized.dataUri);
    if(colors)setPalette(colors);
   }catch{/* Palette extraction is optional; server owns real validation. */}
  }
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!files.light||!files.dark){setError('Importez les deux versions du logo avant de créer le site.');return;}
  if(files.light===files.dark){setError('Sélectionnez deux versions distinctes.');return;}
  setSaving(true);setError('');setNotice('');
  try{
   setNotice('Transfert sécurisé des deux logos originaux…');
   const [lightLogoPath,darkLogoPath]=await Promise.all([
    uploadOriginalSiteLogo(files.light,companyId,'light'),
    uploadOriginalSiteLogo(files.dark,companyId,'dark')
   ]);
   setNotice('Vérification de la transparence et synchronisation du site…');
   const response=await fetch('/api/sites',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,name,address,email,phone,lightLogoPath,darkLogoPath,palette})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||'Création impossible.');
   if(!data.site?.id)throw Error('Création du site non confirmée.');
   onCreated(data.site);
   setName('');setAddress('');setEmail('');setPhone('');
   setFiles({light:null,dark:null});setInputKey(i=>i+1);setPalette(defaultPalette);
   setNotice('Logo importé et optimisé avec succès. Les deux versions sont associées uniquement à ce site.');
  }catch(e){setNotice('');setError(e instanceof Error?e.message:'Création impossible.');}
  finally{setSaving(false);}
 }
 const previewName=name.trim()||'Nom du site';
 return <form className="form-stack compact-form" onSubmit={event=>void submit(event)}>
  <span className="muted">Entreprise : {companyName}</span>
  <div className="workspace-grid" style={{gap:12}}>
   <label>Nom du site
    <input value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={120}
     autoComplete="organization" placeholder="Ex. M’lay Connexion — Centre"/>
   </label>
   <label>Adresse du site
    <input value={address} onChange={e=>setAddress(e.target.value)} required minLength={3} maxLength={160}
     autoComplete="street-address" placeholder="Quartier, rue, ville"/>
   </label>
   <label>E-mail du site
    <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
     required maxLength={254} autoComplete="email" placeholder="contact@exemple.mg"/>
   </label>
   <label>Téléphone du site
    <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} required minLength={5}
     maxLength={32} pattern="[+0-9(). /-]+" autoComplete="tel" placeholder="+261 34 00 000 00"/>
   </label>
  </div>
  <section style={{display:'grid',gap:11}}>
   <strong>Identité du site · deux logos obligatoires</strong>
   <p className="muted">PNG ou SVG transparent, WebP transparent accepté. PNG/WebP : 15 Mo maximum ; SVG : 2 Mo. Les originaux sont préservés et leurs copies d’affichage sont rognées uniquement dans les marges alpha transparentes.</p>
   <div className="workspace-grid" style={{gap:12}}>
    {(['light','dark'] as const).map(variant=><label key={variant}>
     {variant==='light'?'Logo version claire · sur fond sombre':'Logo version sombre · sur fond clair'}
     <input key={inputKey+'-'+variant} type="file" accept="image/png,image/svg+xml,image/webp"
      onChange={e=>void choose(e,variant)} disabled={saving} required/>
     <div style={{marginTop:8,minHeight:96,display:'grid',placeItems:'center',border:'1px solid #9fb3b6',
      borderRadius:12,background:variant==='light'?'#102334':'#ffffff',
      color:variant==='light'?'#ffffff':'#102334',padding:10}}>
      {files[variant]
       ?(variant==='light'?lightPreview:darkPreview)
        ?<img src={variant==='light'?lightPreview:darkPreview} alt={'Aperçu '+variant+' du logo de '+previewName}
          style={{maxWidth:'100%',maxHeight:76,objectFit:'contain',width:'auto',height:'auto'}}/>
        :<span style={{fontSize:12,textAlign:'center'}}>SVG vectoriel : {files[variant]?.name}<br/>Aperçu après validation</span>
       :<span style={{fontSize:12}}>Choisir un logo</span>}
     </div>
    </label>)}
   </div>
   <p className="muted">Le visuel du ticket conservera une zone réservée au logo. La version affichée sera choisie automatiquement selon la luminosité du fond.</p>
   <div style={{border:'1px solid #a7b5be',borderRadius:12,padding:12,
    color:legibleInk(palette.title_color,palette.secondary_color),
    background:palette.secondary_color,fontSize:12}}>
    Aperçu des couleurs du ticket : {previewName}
   </div>
  </section>
  <button className="primary-link" type="submit"
   disabled={saving||!files.light||!files.dark||!companyId}>
   <ZarayIcon name="add" size={18}/> {saving?'Création et optimisation…':'Créer le site'}
  </button>
  {error&&<p className="alert alert-error" role="alert">{error}</p>}
  {notice&&<p className="alert alert-success" role="status">{notice}</p>}
 </form>;
}
