'use client';
import {useEffect,useState,type ChangeEvent} from 'react';
import {uploadOriginalSiteLogo,validateLogoFile} from '@/lib/site-logo-upload';

type Pair={configured:boolean;lightDataUri:string|null;darkDataUri:string|null;updatedAt:string|null};
type Variant='light'|'dark';
const blank:Pair={configured:false,lightDataUri:null,darkDataUri:null,updatedAt:null};
export default function SiteLogoManager({companyId,siteId,canEdit=true,onUpdated}:{
 companyId:string;siteId:string;canEdit?:boolean;onUpdated?:()=>void;
}){
 const [pair,setPair]=useState<Pair>(blank);
 const [light,setLight]=useState<File|null>(null);
 const [dark,setDark]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [inputReset,setInputReset]=useState(0);
 useEffect(()=>{
  let active=true;
  setPair(blank);setLight(null);setDark(null);setError('');setNotice('');setLoading(true);
  if(!companyId||!siteId){setLoading(false);return;}
  (async()=>{
   try{
    const response=await fetch('/api/site-logos?'+new URLSearchParams({companyId,siteId}),{cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||'Logos indisponibles.');
    if(active)setPair({configured:!!data.configured,lightDataUri:data.lightDataUri||null,
      darkDataUri:data.darkDataUri||null,updatedAt:data.updatedAt||null});
   }catch(e){if(active)setError(e instanceof Error?e.message:'Logos indisponibles.');}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false};
 },[companyId,siteId]);
 function choose(event:ChangeEvent<HTMLInputElement>,variant:Variant){
  const file=event.target.files?.[0]||null;setNotice('');setError('');
  if(file){try{validateLogoFile(file);}catch(e){
   setError(e instanceof Error?e.message:'Format de logo invalide.');event.target.value='';return;
  }}
  if(variant==='light')setLight(file);else setDark(file);
 }
 async function save(){
  if(!companyId||!siteId||!canEdit||busy)return;
  if(!pair.configured&&(!light||!dark)){
   setError('Importez les deux versions pour initialiser les logos de ce site.');return;
  }
  if(!light&&!dark)return;
  setBusy(true);setError('');setNotice('Transfert sécurisé des originaux…');
  try{
   const [lightPath,darkPath]=await Promise.all([
    light?uploadOriginalSiteLogo(light,companyId,'light',siteId):Promise.resolve(''),
    dark?uploadOriginalSiteLogo(dark,companyId,'dark',siteId):Promise.resolve('')
   ]);
   setNotice('Vérification des marges et synchronisation du site…');
   const response=await fetch('/api/site-logos',{
    method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,siteId,lightPath,darkPath})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||'Impossible de synchroniser les logos.');
   setPair({configured:true,lightDataUri:data.lightDataUri,darkDataUri:data.darkDataUri,updatedAt:new Date().toISOString()});
   setLight(null);setDark(null);setInputReset(i=>i+1);
   setNotice(data.optimized?.length
    ?'Logo importé et optimisé avec succès. Les marges transparentes inutiles ont été supprimées.'
    :'Logo importé et optimisé avec succès.');
   window.dispatchEvent(new CustomEvent('zaray-site-logo-updated',{detail:{companyId,siteId}}));
   onUpdated?.();
  }catch(e){setNotice('');setError(e instanceof Error?e.message:'Impossible de traiter ce fichier.');}
  finally{setBusy(false);}
 }
 if(!companyId||!siteId)return null;
 return <details className="workspace-inline-disclosure" style={{marginBlock:10}}>
  <summary>Logos du site · clair et sombre</summary>
  {loading?<p role="status">Chargement des logos…</p>:<>
   <p className="muted">Identité partagée par les tickets et le portail du site. Le logo clair apparaît sur fond sombre ; le logo sombre sur fond clair.</p>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:12}}>
    {(['light','dark'] as const).map(variant=><div key={variant}>
     <label>{variant==='light'?'Version claire · fond sombre':'Version sombre · fond clair'}
      <input key={inputReset+'-'+variant} type="file" accept="image/png,image/svg+xml,image/webp"
       onChange={e=>choose(e,variant)} disabled={busy||!canEdit}/>
     </label>
     <div style={{marginTop:7,minHeight:84,display:'grid',placeItems:'center',padding:10,
      border:'1px solid #8fa7b3',borderRadius:10,background:variant==='light'?'#102334':'#ffffff',
      color:variant==='light'?'white':'#102334'}}>
      {(variant==='light'?pair.lightDataUri:pair.darkDataUri)
       ?<img src={variant==='light'?pair.lightDataUri||'':pair.darkDataUri||''}
         alt={'Logo '+(variant==='light'?'clair':'sombre')+' du site'}
         style={{maxWidth:'100%',maxHeight:76,objectFit:'contain',height:'auto',width:'auto'}}/>
       :<small>Non configuré</small>}
     </div>
    </div>)}
   </div>
   {!pair.configured&&<p className="muted">Ce site utilise encore son logo historique. Pour activer les deux variantes, importez-les ensemble.</p>}
   {canEdit&&<button type="button" disabled={busy||(!light&&!dark)} onClick={()=>void save()}>
    {busy?'Importation…':'Enregistrer les logos du site'}
   </button>}
   {error&&<p className="alert alert-error" role="alert">{error}</p>}
   {notice&&<p className="alert alert-success" role="status">{notice}</p>}
  </>}
 </details>;
}
