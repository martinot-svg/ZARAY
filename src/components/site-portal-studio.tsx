'use client';
import {useCallback,useEffect,useRef,useState,type CSSProperties,type ChangeEvent} from 'react';
import Link from 'next/link';
import {Check,ChevronRight,Copy,Eye,History,Image as Picture,Monitor,RotateCcw,Save,Smartphone,UploadCloud,Wifi} from 'lucide-react';
import AppShell from '@/components/app-shell';
import {DEFAULT_PORTAL_CONFIG,PORTAL_TEMPLATES,portalFieldPalette,type PortalConfig} from '@/lib/site-portal-config';
import {downloadMikrotikCaptiveApi} from '@/lib/mikrotik-captive-api-download';
import {optimizeLogo} from '@/lib/logo-optimizer';
import './site-portal-studio.css';

type Site={id:string;company_id:string;name:string;company_slug:string;status:string};
type Company={id:string;legal_name:string;slug:string;role:string};
type Version={version:number;published_at:string};
type PortalRouter={id:string;site_id:string;name:string;last_seen_at:string|null};
type SiteLogoState={key:string;uri:string|null;loading:boolean;error:boolean};
type RouterSnapshot={companyId:string;routers:PortalRouter[];error:boolean};
type PortalState={draft:PortalConfig;revision:number;published:PortalConfig|null;
 publishedVersion:number;publishedAt:string|null;versions:Version[]};
const initial:PortalState={draft:DEFAULT_PORTAL_CONFIG,revision:-1,published:null,
 publishedVersion:0,publishedAt:null,versions:[]};
const colors: {key:keyof PortalConfig;label:string}[]=[
 {key:'primaryColor',label:'Couleur principale'},{key:'accentColor',label:'Accent'},
 {key:'backgroundColor',label:'Arrière-plan'},{key:'panelColor',label:'Carte'},
 {key:'textColor',label:'Texte principal'}
];
const options: {key:keyof PortalConfig;label:string;detail:string}[]=[
 {key:'showOffers',label:'Catalogue des offres',detail:'Accès à la liste des forfaits Wi-Fi'},
 {key:'showSubscribe',label:'Devenir abonné',detail:'Inscription résidentielle'},
 {key:'showAccount',label:'Mon compte',detail:'Accès au compte du site'},
 {key:'showContact',label:'Coordonnées',detail:'Contact du fournisseur'}
];
async function request(url:string,init?:RequestInit){
 const r=await fetch(url,{...init,cache:'no-store'});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.error||'Service indisponible.');
 return data;
}
function previewCss(config:PortalConfig):CSSProperties{
 const fields=portalFieldPalette(config);
 return {'--ps-primary':config.primaryColor,'--ps-accent':config.accentColor,
  '--ps-background':config.backgroundColor,'--ps-panel':config.panelColor,
  '--ps-text':config.textColor,'--ps-radius':config.cornerRadius+'px',
  '--ps-input-bg':fields.background,'--ps-input-border':fields.border,
  '--ps-input-focus':fields.focus,'--ps-input-text':fields.text,
  '--ps-input-guide':fields.placeholder} as CSSProperties;
}
async function coverData(file:File):Promise<string>{
 if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>3_000_000)
  throw Error('Image PNG, JPEG ou WebP de 3 Mo maximum.');
 const blobUrl=URL.createObjectURL(file);
 try{
  const image=new Image();
  await new Promise<void>((resolve,reject)=>{
   image.onload=()=>resolve();image.onerror=()=>reject(Error('Image illisible.'));
   image.src=blobUrl;
  });
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>24_000_000)
   throw Error('Dimensions de couverture non prises en charge.');
  const factor=Math.min(1,1400/image.naturalWidth,900/image.naturalHeight);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*factor));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*factor));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Optimisation de l’image indisponible.');
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  for(const quality of [0.79,0.68,0.53,0.39]){
   const uri=canvas.toDataURL('image/webp',quality);
   if(uri.startsWith('data:image/webp;base64,')&&uri.length<=145000)return uri;
  }
  throw Error('Couverture trop détaillée. Choisissez une image plus simple.');
 }finally{URL.revokeObjectURL(blobUrl);}
}

export default function SitePortalStudio(){
 const [companies,setCompanies]=useState<Company[]>([]);
 const [sites,setSites]=useState<Site[]>([]);
 const [companyId,setCompanyId]=useState('');
 const [siteId,setSiteId]=useState('');
 const [state,setState]=useState<PortalState>(initial);
 const [form,setForm]=useState<PortalConfig>(DEFAULT_PORTAL_CONFIG);
 const [busy,setBusy]=useState(true),[working,setWorking]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [device,setDevice]=useState<'mobile'|'desktop'>('mobile');
 const [sourceId,setSourceId]=useState('');
 const [history,setHistory]=useState('');
 const [originalCoverName,setOriginalCoverName]=useState('');
 const [loadedSite,setLoadedSite]=useState('');
 const [routerSnapshot,setRouterSnapshot]=useState<RouterSnapshot|null>(null);
 const [siteLogo,setSiteLogo]=useState<SiteLogoState|null>(null);
 const requestVersion=useRef(0);
 const logoVersion=useRef(0);
 const logoSiteRef=useRef('');
 const company=companies.find(c=>c.id===companyId);
 const site=sites.find(s=>s.id===siteId);
 const peers=sites.filter(s=>s.company_id===companyId&&s.id!==siteId&&s.status==='active');
 const canEdit=!!company&&['owner','admin'].includes(company.role);
 const dirty=JSON.stringify(form)!==JSON.stringify(state.draft);
 const publishedLink=company&&site?
  '/wifi/'+encodeURIComponent(company.slug)+'?siteId='+encodeURIComponent(site.id):'';
 const ready=loadedSite===companyId+':'+siteId;
 const brandKey=companyId+':'+siteId;
 logoSiteRef.current=brandKey;
 const currentLogo=siteLogo?.key===brandKey?siteLogo:null;
 const linkedRouters=routerSnapshot?.companyId===companyId
  ?routerSnapshot.routers.filter(router=>router.site_id===siteId):[];
 const routerOnline=(lastSeen:string|null)=>!!lastSeen
  &&Date.now()-new Date(lastSeen).getTime()<150000;

 useEffect(()=>{
  let live=true;
  (async()=>{
   try{
    const data=await request('/api/sites');
    if(!live)return;
    const cs:Company[]=data.companies||[],ss:Site[]=data.sites||[];
    const input=new URLSearchParams(window.location.search);
    const requestedCompany=input.get('companyId')||'';
    const selectedCompany=cs.find(c=>c.id===requestedCompany)||cs[0];
    const available=ss.filter(s=>s.company_id===selectedCompany?.id);
    const requestedSite=input.get('siteId')||'';
    setCompanies(cs);setSites(ss);
    setCompanyId(selectedCompany?.id||'');
    setSiteId(available.find(s=>s.id===requestedSite)?.id||available[0]?.id||'');
   }catch(e){if(live)setError(e instanceof Error?e.message:'Chargement impossible.');}
   finally{if(live)setBusy(false);}
  })();
  return()=>{live=false};
 },[]);

 useEffect(()=>{
  let live=true;
  setRouterSnapshot(null);
  if(!companyId)return;
  (async()=>{
   try{
    const data=await request('/api/network?companyId='+encodeURIComponent(companyId));
    if(live)setRouterSnapshot({companyId,routers:Array.isArray(data.routers)?data.routers:[],error:false});
   }catch{
    if(live)setRouterSnapshot({companyId,routers:[],error:true});
   }
  })();
  return()=>{live=false;};
 },[companyId]);

 useEffect(()=>{
  let active=true;
  const token=++logoVersion.current;
  const key=companyId+':'+siteId;
  setSiteLogo(null);
  if(!companyId||!siteId)return;
  setSiteLogo({key,uri:null,loading:true,error:false});
  (async()=>{
   try{
    // The same site-only branding used for web and native MikroTik exports.
    const data=await request('/api/ticket-templates?'+new URLSearchParams({companyId,siteId}));
    if(!active||token!==logoVersion.current)return;
    const candidate=data.settings?.logo_data_uri;
    const uri=typeof candidate==='string'&&candidate.length<=180000
     &&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(candidate)
      ?candidate:null;
    setSiteLogo({key,uri,loading:false,error:false});
   }catch{
    if(active&&token===logoVersion.current)setSiteLogo({key,uri:null,loading:false,error:true});
   }
  })();
  return()=>{active=false;};
 },[companyId,siteId]);

 const uploadSiteLogo=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file||!site||!canEdit||!ready||working)return;
  const key=brandKey;
  const token=++logoVersion.current;
  setWorking(true);setError('');setNotice('');
  try{
   if(!/^image\/(png|webp)$/.test(file.type)||file.size>3_000_000||file.size===0)
    throw Error('Choisissez un logo PNG ou WebP transparent, 3 Mo maximum.');
   const input=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(Error('Logo illisible.'));
    reader.onerror=()=>reject(Error('Impossible de lire le logo.'));
    reader.readAsDataURL(file);
   });
   const optimized=await optimizeLogo(input);
   // Narrow endpoint updates the logo only; voucher styles and credentials
   // settings remain untouched even when another administrator edits them.
   if(key!==logoSiteRef.current)return;
   const result=await request('/api/ticket-templates',{method:'PATCH',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,siteId,logoDataUri:optimized.dataUri})});
   if(key!==logoSiteRef.current||token!==logoVersion.current)return;
   setSiteLogo({key,uri:result.logoDataUri,loading:false,error:false});
   setNotice('Logo du site enregistré : visible sur le portail web et les tickets. Le prochain export MikroTik utilisera ce logo.');
  }catch(e){
   if(key===logoSiteRef.current)setError(e instanceof Error?e.message:'Enregistrement du logo impossible.');
  }finally{setWorking(false);}
 };

 const reload=useCallback(async(id:string,tenant:string)=>{
  // A response for a previously selected site must never replace another site's draft.
  const token=++requestVersion.current;
  setState(initial);setForm(DEFAULT_PORTAL_CONFIG);setLoadedSite('');
  setHistory('');setSourceId('');setOriginalCoverName('');
  setError('');setNotice('');
  if(!id||!tenant){setBusy(false);return;}
  setBusy(true);
  try{
   const data=await request('/api/site-portal?'+new URLSearchParams({companyId:tenant,siteId:id}));
   if(token!==requestVersion.current)return;
   const result:PortalState={draft:data.draft,revision:data.revision,
    published:data.published,publishedVersion:data.publishedVersion,
    publishedAt:data.publishedAt,versions:data.versions||[]};
   setState(result);setForm(result.draft);setLoadedSite(tenant+':'+id);
  }catch(e){
   if(token===requestVersion.current)setError(e instanceof Error?e.message:'Configuration indisponible.');
  }finally{
   if(token===requestVersion.current)setBusy(false);
  }
 },[]);
 useEffect(()=>{void reload(siteId,companyId);},[siteId,companyId,reload]);

 function change<K extends keyof PortalConfig>(key:K,value:PortalConfig[K]){
  setForm(before=>({...before,[key]:value}));setNotice('');
 }
 const save=async()=>{
  if(!site||!canEdit||!ready||working)return;
  setWorking(true);setError('');setNotice('');
  try{
   const data=await request('/api/site-portal',{method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,siteId,expectedRevision:state.revision,config:form})});
   setState(previous=>({...previous,draft:form,revision:data.revision}));
   setNotice('Brouillon enregistré. Le portail public reste inchangé.');
  }catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible.');}
  finally{setWorking(false);}
 };
 const publish=async()=>{
  if(!site||!canEdit||!ready||working||dirty||state.revision<1)return;
  if(!window.confirm('Publier cette version pour '+site.name+' ? Le portail de ce site sera mis à jour.'))return;
  setWorking(true);setError('');
  try{
   const data=await request('/api/site-portal',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'publish',companyId,siteId,expectedRevision:state.revision})});
   await reload(siteId,companyId);
   setNotice('Version '+data.version+' publiée pour '+site.name+'. Les autres sites restent inchangés.');
  }catch(e){setError(e instanceof Error?e.message:'Publication impossible.');}
  finally{setWorking(false);}
 };
 const restore=async()=>{
  const version=Number(history);
  if(!site||!canEdit||!ready||working||dirty||!version)return;
  if(!window.confirm('Restaurer la version '+version+' dans le brouillon de '+site.name+' ? Le portail actuel restera publié.'))return;
  setWorking(true);setError('');
  try{
   await request('/api/site-portal',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'restore',companyId,siteId,version,expectedRevision:state.revision})});
   await reload(siteId,companyId);
   setNotice('Version '+version+' restaurée dans le brouillon. Publiez après vérification.');
  }catch(e){setError(e instanceof Error?e.message:'Restauration impossible.');}
  finally{setWorking(false);}
 };
 const duplicate=async()=>{
  if(!site||!sourceId||!canEdit||!ready||working||dirty)return;
  if(!window.confirm('Copier le portail PUBLIÉ du site source dans le brouillon de '+site.name+' ? Cela remplacera son brouillon, pas son portail public.'))return;
  setWorking(true);setError('');
  try{
   await request('/api/site-portal',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'duplicate',companyId,siteId,
     sourceSiteId:sourceId,expectedRevision:state.revision})});
   await reload(siteId,companyId);
   setNotice('Portail copié dans le brouillon. La publication reste séparée.');
  }catch(e){setError(e instanceof Error?e.message:'Duplication impossible.');}
  finally{setWorking(false);}
 };
 const upload=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];if(!file||!ready||working)return;
  setWorking(true);setError('');
  try{
   const processed=await coverData(file);
   change('coverImageDataUri',processed);
   setOriginalCoverName(file.name);
   setNotice('Image optimisée pour le web. L’original reste sur votre appareil.');
  }catch(e){setError(e instanceof Error?e.message:'Image invalide.');}
  finally{setWorking(false);event.target.value='';}
 };

 const downloadDetection=async()=>{
  if(!ready||working)return;
  setWorking(true);setError('');setNotice('');
  try{
   await downloadMikrotikCaptiveApi();
   setNotice('api.json téléchargé. Conservez md5.js et les pages HotSpot natives de votre routeur.');
  }catch(e){
   setError(e instanceof Error?e.message:'Téléchargement de api.json impossible.');
  }finally{setWorking(false);}
 };

 return <AppShell activePath="/portail" title="Studio des portails captifs">
  <div className="ps-studio">
   <div className="ps-bar">
    <div><h2>Portail de mon site</h2><p>Personnalisez, prévisualisez puis publiez. La connexion Wi-Fi reste gérée par MikroTik.</p></div>
    <div className="ps-site-selects">
     <label>Entreprise
      <select value={companyId} disabled={working} onChange={e=>{if(dirty&&ready&&!window.confirm('Abandonner les modifications non enregistrées ?'))return;const id=e.target.value;setCompanyId(id);setSiteId(sites.find(s=>s.company_id===id)?.id||'');}}>
       {companies.map(c=><option key={c.id} value={c.id}>{c.legal_name}</option>)}
      </select>
     </label>
     <label>Site
      <select value={siteId} disabled={working} onChange={e=>{if(dirty&&ready&&!window.confirm('Abandonner les modifications non enregistrées ?'))return;setSiteId(e.target.value);}}>
       {sites.filter(s=>s.company_id===companyId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
     </label>
    </div>
   </div>
   {error&&<p className="ps-alert" role="alert">{error}</p>}
   {notice&&<p className="ps-notice" role="status">{notice}</p>}
   {busy?<p role="status">Chargement de l’éditeur…</p>:!site?<div className="empty-state">Créez un site avant de personnaliser son portail.</div>:!ready?<div className="empty-state">Configuration indisponible. <button type="button" onClick={()=>void reload(siteId,companyId)}>Réessayer</button></div>:<>
    <div className="ps-publication">
     <span><span className={'ps-live-dot'+(state.published?' is-on':'')}/>
      {state.published?'Portail publié · version '+state.publishedVersion:'Aucun design personnalisé publié'}</span>
     <span>{dirty?'Modifications non enregistrées':state.revision>=1?'Brouillon enregistré':'Configuration par défaut'}</span>
     <div className="ps-commands">
      <button type="button" onClick={()=>void save()} disabled={working||!canEdit||(!dirty&&state.revision>=0)}><Save size={16}/> Enregistrer</button>
      <button type="button" className="ps-publish" onClick={()=>void publish()} disabled={working||!canEdit||dirty||state.revision<1||site.status!=='active'}><UploadCloud size={17}/> Publier</button>
      <button type="button" className="ps-muted" onClick={()=>{setForm(state.draft);setNotice('Modifications locales annulées.');}} disabled={!dirty||working}><RotateCcw size={15}/> Annuler</button>
     </div>
    </div>
    <div className="ps-columns">
     <section className="ps-controls" aria-label="Réglages du portail">
      <div className="ps-section">
       <h3> Choisir un modèle</h3>
       <div className="ps-template-grid">
        {PORTAL_TEMPLATES.map(t=><button type="button" key={t.key}
         className={'ps-template'+(form.template===t.key?' is-selected':'')}
         aria-pressed={form.template===t.key} onClick={()=>change('template',t.key)}
         disabled={!canEdit}><span className={'ps-template-swatch ps-'+t.key}><span/></span><strong>{t.label}</strong><small>{t.description}</small></button>)}
       </div>
      </div>
      <div className="ps-section ps-inputs">
       <h3> Textes et identité</h3>
       <label>Titre de bienvenue <input maxLength={85} value={form.headline} onChange={e=>change('headline',e.target.value)} disabled={!canEdit}/></label>
       <label>Sous-titre <textarea rows={2} maxLength={180} value={form.subtitle} onChange={e=>change('subtitle',e.target.value)} disabled={!canEdit}/></label>
       <label>Bouton de connexion <input maxLength={45} value={form.buttonLabel} onChange={e=>change('buttonLabel',e.target.value)} disabled={!canEdit}/></label>
       <label>Message d’accueil <input maxLength={180} value={form.welcomeMessage} onChange={e=>change('welcomeMessage',e.target.value)} disabled={!canEdit}/></label>
       <div className="ps-site-logo-editor">
        <label className="ps-single">Logo du site
         <input type="file" accept="image/png,image/webp" aria-label="Importer le logo transparent de ce site"
          disabled={!canEdit||working||!ready} onChange={e=>void uploadSiteLogo(e)}/>
        </label>
        <p className="ps-hint">PNG ou WebP transparent. ZARAY rogne les marges vides. Le logo est commun aux tickets et au portail.</p>
       </div>
       <Link className="ps-external" href={'/personnalisation-tickets?companyId='+encodeURIComponent(companyId)+'&siteId='+encodeURIComponent(siteId)}>
        Coordonnées et autres réglages des tickets <ChevronRight size={15}/>
       </Link>
      </div>
      <div className="ps-section">
       <h3> Couleurs et mise en page</h3>
       <div className="ps-colors">{colors.map(({key,label})=><label key={key}>{label}
        <input type="color" value={form[key] as string} onChange={e=>change(key,e.target.value)} disabled={!canEdit}/>
       </label>)}</div>
       <label className="ps-single">Alignement
        <select value={form.align} disabled={!canEdit} onChange={e=>change('align',e.target.value as PortalConfig['align'])}>
         <option value="center">Centré</option><option value="left">Aligné à gauche</option>
        </select>
       </label>
       <label className="ps-single">Arrondi des cartes : {form.cornerRadius}px
        <input type="range" min="0" max="32" step="2" value={form.cornerRadius}
         disabled={!canEdit} onChange={e=>change('cornerRadius',Number(e.target.value))}/>
       </label>
       <label className="ps-single"><Picture size={16}/> Image de couverture optimisée
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void upload(e)} disabled={!canEdit||working}/>
       </label>
       {form.coverImageDataUri&&<button type="button" className="ps-muted" disabled={!canEdit}
        onClick={()=>{change('coverImageDataUri',null);setOriginalCoverName('');}}>Retirer la couverture</button>}
       {originalCoverName&&<p className="ps-hint">Fichier original sur votre appareil : {originalCoverName}</p>}
      </div>
      <div className="ps-section">
       <h3>Champs de saisie</h3>
       <div className="ps-colors">
        {([
         ['inputBackgroundColor','Fond des champs'],
         ['inputBorderColor','Bordure des champs'],
         ['inputFocusColor','Couleur au focus'],
         ['inputTextColor','Texte saisi']
        ] as const).map(([key,label])=><label key={key}>{label}
         <input type="color" value={form[key]} onChange={e=>change(key,e.target.value)} disabled={!canEdit}/>
        </label>)}
       </div>
       <p className="ps-hint">Les guides « Identifiant du ticket » et « Mot de passe » gardent un contraste lisible et une légère transparence, quelle que soit la couleur choisie.</p>
      </div>
      <div className="ps-section">
       <h3> Parcours visibles</h3>
       {options.map(({key,label,detail})=><label className="ps-check" key={key}>
        <input type="checkbox" checked={form[key] as boolean} disabled={!canEdit}
         onChange={e=>change(key,e.target.checked)}/>
        <span><strong>{label}</strong><small>{detail}</small></span>
       </label>)}
       <p className="ps-hint">Ces réglages n’ajoutent aucun droit d’accès réseau et ne modifient pas le MikroTik.</p>
      </div>
      <div className="ps-section ps-inputs">
       <h3> Mentions et confidentialité</h3>
       <label>Conditions d’utilisation <textarea rows={3} maxLength={1500} value={form.termsText} onChange={e=>change('termsText',e.target.value)} disabled={!canEdit}/></label>
       <label>Politique de confidentialité <textarea rows={3} maxLength={1500} value={form.privacyText} onChange={e=>change('privacyText',e.target.value)} disabled={!canEdit}/></label>
      </div>
      <div className="ps-section">
       <h3> Versions et duplication</h3>
       <label className="ps-single"><History size={16}/> Restaurer dans le brouillon
        <select value={history} onChange={e=>setHistory(e.target.value)} disabled={!canEdit}>
         <option value="">Choisir une version</option>
         {state.versions.map(v=><option value={v.version} key={v.version}>Version {v.version} · {new Date(v.published_at).toLocaleDateString('fr-FR')}</option>)}
        </select>
       </label>
       <button type="button" disabled={!history||working||dirty||!canEdit} onClick={()=>void restore()}>Restaurer le brouillon</button>
       <label className="ps-single"><Copy size={16}/> Copier depuis un autre site
        <select value={sourceId} onChange={e=>setSourceId(e.target.value)} disabled={!canEdit}>
         <option value="">Choisir un site source</option>
         {peers.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
        </select>
       </label>
       <button type="button" disabled={!sourceId||working||dirty||!canEdit} onClick={()=>void duplicate()}>Copier dans ce brouillon</button>
      </div>
     </section>
     <aside className="ps-preview-area" aria-label="Prévisualisation du portail">
      <div className="ps-preview-head">
       <span><Eye size={18}/> Aperçu en direct · non publié</span>
       <div role="group" aria-label="Taille de prévisualisation">
        <button type="button" aria-pressed={device==='mobile'} onClick={()=>setDevice('mobile')}><Smartphone size={17}/> Mobile</button>
        <button type="button" aria-pressed={device==='desktop'} onClick={()=>setDevice('desktop')}><Monitor size={17}/> Ordinateur</button>
       </div>
      </div>
      <div className={'ps-preview-frame '+(device==='mobile'?'is-mobile':'is-desktop')}>
       <div className={'ps-demo-portal ps-style-'+form.template+' align-'+form.align}
        style={previewCss(form)}>
        {form.coverImageDataUri&&<img className="ps-cover" alt="" src={form.coverImageDataUri}/>}
        <div className="ps-demo-card">
         <div className="ps-site-logo" aria-label={'Logo du site '+site.name}>
          {currentLogo?.uri
           ?<img src={currentLogo.uri} alt={'Logo du site '+site.name}/>
           :<span>{currentLogo?.loading?'Chargement du logo…':currentLogo?.error?'Logo indisponible':'Logo non configuré'}</span>}
         </div>
         {form.welcomeMessage&&<span className="ps-kicker">{form.welcomeMessage}</span>}
         <h3>{form.headline||'Bienvenue chez '+site.name}</h3>
         <p>{form.subtitle||'Connectez-vous avec votre ticket.'}</p>
         <input className="ps-demo-field" readOnly tabIndex={-1} aria-label="Aperçu du champ identifiant" placeholder="Identifiant du ticket"/>
         <input className="ps-demo-field" readOnly tabIndex={-1} aria-label="Aperçu du champ mot de passe" placeholder="Mot de passe"/>
         <div className="ps-demo-button"><Wifi size={17}/>{form.buttonLabel||'Se connecter'}<ChevronRight size={16}/></div>
         <div className="ps-demo-links">
          {form.showOffers&&<span>Voir les offres</span>}
          {form.showSubscribe&&<span>Devenir abonné</span>}
          {form.showAccount&&<span>Mon compte</span>}
         </div>
         {form.showContact&&<small>Votre fournisseur Internet · {site.name}</small>}
        </div>
       </div>
      </div>
      {publishedLink&&<Link className="ps-external" href={publishedLink} target="_blank">
       Ouvrir le portail public <ChevronRight size={16}/>
      </Link>}
      {site&&<Link className="ps-external" href={'/tickets?companyId='+encodeURIComponent(companyId)+'&siteId='+encodeURIComponent(siteId)+'&tab=generate'}>
       Prévisualiser les tickets sans routeur <ChevronRight size={16}/>
      </Link>}
      <details className="ps-installation">
       <summary>Installation MikroTik · état du site</summary>
       <p className="ps-hint">{state.published
        ?'Version '+state.publishedVersion+' publiée sur le web. Installation sur le MikroTik non vérifiée.'
        :'Publiez d’abord le design du site. Le routeur conserve sa page précédente tant que login.html n’est pas installé.'}</p>
       {routerSnapshot?.companyId!==companyId
        ?<p className="ps-hint">Chargement des équipements…</p>
        :routerSnapshot.error
         ?<p className="ps-hint">État des équipements indisponible.</p>
         :linkedRouters.length
          ?<ul className="ps-router-list">{linkedRouters.map(router=><li key={router.id}>
           <strong>{router.name}</strong>
           <span>{routerOnline(router.last_seen_at)?'Connecteur en ligne':'Connecteur hors ligne ou non associé'}</span>
          </li>)}</ul>
          :<p className="ps-hint">Aucun MikroTik enregistré pour ce site.</p>}
       <div className="ps-installation-actions">
        <Link className="ps-external" href={'/gestion-reseau?companyId='+encodeURIComponent(companyId)+'&siteId='+encodeURIComponent(siteId)}>
         Associer un MikroTik <ChevronRight size={15}/>
        </Link>
        <Link className="ps-external" href={'/personnalisation-tickets?companyId='+encodeURIComponent(companyId)+'&siteId='+encodeURIComponent(siteId)}>
         Préparer login.html <ChevronRight size={15}/>
        </Link>
        <button type="button" onClick={()=>void downloadDetection()} disabled={working||!ready}>
         Télécharger api.json
        </button>
       </div>
       <p className="ps-hint">Sur le routeur : sauvegardez le dossier HotSpot, remplacez login.html, conservez md5.js et les autres pages natives. Ajoutez api.json si nécessaire pour la détection mobile. Le DNS HotSpot et un certificat HTTPS valide sont requis pour annoncer le portail aux appareils compatibles. Un connecteur en ligne ne confirme pas que la page est installée.</p>
      </details>
      <p className="ps-hint">L’aperçu ne tente aucune authentification. Publier sur Vercel n’installe pas de fichiers sur un MikroTik privé.</p>
     </aside>
    </div>
   </>}
  </div>
 </AppShell>;
}
