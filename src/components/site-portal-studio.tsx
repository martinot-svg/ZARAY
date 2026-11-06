'use client';
import {useCallback,useEffect,useMemo,useState,type CSSProperties,type ChangeEvent} from 'react';
import Link from 'next/link';
import {Check,ChevronRight,Copy,Eye,History,Image as Picture,Monitor,RotateCcw,Save,Smartphone,UploadCloud,Wifi} from 'lucide-react';
import AppShell from '@/components/app-shell';
import {DEFAULT_PORTAL_CONFIG,PORTAL_TEMPLATES,type PortalConfig} from '@/lib/site-portal-config';
import './site-portal-studio.css';

type Site={id:string;company_id:string;name:string;company_slug:string;status:string};
type Company={id:string;legal_name:string;slug:string;role:string};
type Version={version:number;published_at:string};
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
 return {'--ps-primary':config.primaryColor,'--ps-accent':config.accentColor,
  '--ps-background':config.backgroundColor,'--ps-panel':config.panelColor,
  '--ps-text':config.textColor,'--ps-radius':config.cornerRadius+'px'} as CSSProperties;
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
 const company=companies.find(c=>c.id===companyId);
 const site=sites.find(s=>s.id===siteId);
 const peers=sites.filter(s=>s.company_id===companyId&&s.id!==siteId&&s.status==='active');
 const canEdit=!!company&&['owner','admin'].includes(company.role);
 const dirty=JSON.stringify(form)!==JSON.stringify(state.draft);
 const publishedLink=company&&site?
  '/wifi/'+encodeURIComponent(company.slug)+'?siteId='+encodeURIComponent(site.id):'';
 const params=useMemo(()=>new URLSearchParams({companyId,siteId}),[companyId,siteId]);

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

 const reload=useCallback(async(id:string,tenant:string)=>{
  if(!id||!tenant)return;
  setBusy(true);setError('');setNotice('');
  try{
   const data=await request('/api/site-portal?'+new URLSearchParams({companyId:tenant,siteId:id}));
   const result:PortalState={draft:data.draft,revision:data.revision,
    published:data.published,publishedVersion:data.publishedVersion,
    publishedAt:data.publishedAt,versions:data.versions||[]};
   setState(result);setForm(result.draft);setOriginalCoverName('');
  }catch(e){setError(e instanceof Error?e.message:'Configuration indisponible.');}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void reload(siteId,companyId);},[siteId,companyId,reload]);

 function change<K extends keyof PortalConfig>(key:K,value:PortalConfig[K]){
  setForm(before=>({...before,[key]:value}));setNotice('');
 }
 const save=async()=>{
  if(!site||!canEdit)return;
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
  if(!site||!canEdit||dirty||state.revision<1)return;
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
  if(!site||!canEdit||dirty||!version)return;
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
  if(!site||!sourceId||!canEdit||dirty)return;
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
  const file=event.target.files?.[0];if(!file)return;
  setWorking(true);setError('');
  try{
   const processed=await coverData(file);
   change('coverImageDataUri',processed);
   setOriginalCoverName(file.name);
   setNotice('Image optimisée pour le web. L’original reste sur votre appareil.');
  }catch(e){setError(e instanceof Error?e.message:'Image invalide.');}
  finally{setWorking(false);event.target.value='';}
 };

 return <AppShell activePath="/portail" title="Studio des portails captifs">
  <div className="ps-studio">
   <div className="ps-bar">
    <div><h2>Portail de mon site</h2><p>Personnalisez, prévisualisez puis publiez. La connexion Wi-Fi reste gérée par MikroTik.</p></div>
    <div className="ps-site-selects">
     <label>Entreprise
      <select value={companyId} onChange={e=>{const id=e.target.value;setCompanyId(id);setSiteId(sites.find(s=>s.company_id===id)?.id||'');}}>
       {companies.map(c=><option key={c.id} value={c.id}>{c.legal_name}</option>)}
      </select>
     </label>
     <label>Site
      <select value={siteId} onChange={e=>setSiteId(e.target.value)}>
       {sites.filter(s=>s.company_id===companyId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
     </label>
    </div>
   </div>
   {error&&<p className="ps-alert" role="alert">{error}</p>}
   {notice&&<p className="ps-notice" role="status">{notice}</p>}
   {busy?<p role="status">Chargement de l’éditeur…</p>:!site?<div className="empty-state">Créez un site avant de personnaliser son portail.</div>:<>
    <div className="ps-publication">
     <span><span className={'ps-live-dot'+(state.published?' is-on':'')}/>
      {state.published?'Portail publié · version '+state.publishedVersion:'Aucun design personnalisé publié'}</span>
     <span>{dirty?'Modifications non enregistrées':state.revision>=1?'Brouillon enregistré':'Configuration par défaut'}</span>
     <div className="ps-commands">
      <button type="button" onClick={()=>void save()} disabled={working||!canEdit||!dirty}><Save size={16}/> Enregistrer</button>
      <button type="button" className="ps-publish" onClick={()=>void publish()} disabled={working||!canEdit||dirty||state.revision<1||site.status!=='active'}><UploadCloud size={17}/> Publier</button>
      <button type="button" className="ps-muted" onClick={()=>{setForm(state.draft);setNotice('Modifications locales annulées.');}} disabled={!dirty||working}><RotateCcw size={15}/> Annuler</button>
     </div>
    </div>
    <div className="ps-columns">
     <section className="ps-controls" aria-label="Réglages du portail">
      <div className="ps-section">
       <h3>1. Choisir un modèle</h3>
       <div className="ps-template-grid">
        {PORTAL_TEMPLATES.map(t=><button type="button" key={t.key}
         className={'ps-template'+(form.template===t.key?' is-selected':'')}
         aria-pressed={form.template===t.key} onClick={()=>change('template',t.key)}
         disabled={!canEdit}><span className={'ps-template-swatch ps-'+t.key}><span/></span><strong>{t.label}</strong><small>{t.description}</small></button>)}
       </div>
      </div>
      <div className="ps-section ps-inputs">
       <h3>2. Textes et identité</h3>
       <label>Titre de bienvenue <input maxLength={85} value={form.headline} onChange={e=>change('headline',e.target.value)} disabled={!canEdit}/></label>
       <label>Sous-titre <textarea rows={2} maxLength={180} value={form.subtitle} onChange={e=>change('subtitle',e.target.value)} disabled={!canEdit}/></label>
       <label>Bouton de connexion <input maxLength={45} value={form.buttonLabel} onChange={e=>change('buttonLabel',e.target.value)} disabled={!canEdit}/></label>
       <label>Message d’accueil <input maxLength={180} value={form.welcomeMessage} onChange={e=>change('welcomeMessage',e.target.value)} disabled={!canEdit}/></label>
       <p className="ps-hint">Le nom, le logo transparent et les coordonnées du site restent gérés dans l’identité existante.</p>
       <Link className="ps-external" href={'/personnalisation-tickets?companyId='+encodeURIComponent(companyId)+'&siteId='+encodeURIComponent(siteId)}>
        Modifier l’identité et le logo du site <ChevronRight size={15}/>
       </Link>
      </div>
      <div className="ps-section">
       <h3>3. Couleurs et mise en page</h3>
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
       <h3>4. Parcours visibles</h3>
       {options.map(({key,label,detail})=><label className="ps-check" key={key}>
        <input type="checkbox" checked={form[key] as boolean} disabled={!canEdit}
         onChange={e=>change(key,e.target.checked)}/>
        <span><strong>{label}</strong><small>{detail}</small></span>
       </label>)}
       <p className="ps-hint">Ces réglages n’ajoutent aucun droit d’accès réseau et ne modifient pas le MikroTik.</p>
      </div>
      <div className="ps-section ps-inputs">
       <h3>5. Mentions et confidentialité</h3>
       <label>Conditions d’utilisation <textarea rows={3} maxLength={1500} value={form.termsText} onChange={e=>change('termsText',e.target.value)} disabled={!canEdit}/></label>
       <label>Politique de confidentialité <textarea rows={3} maxLength={1500} value={form.privacyText} onChange={e=>change('privacyText',e.target.value)} disabled={!canEdit}/></label>
      </div>
      <div className="ps-section">
       <h3>6. Versions et duplication</h3>
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
         <div className="ps-brand-mark"><Wifi size={22}/></div>
         <span className="ps-brand-name">{site.name}</span>
         {form.welcomeMessage&&<span className="ps-kicker">{form.welcomeMessage}</span>}
         <h3>{form.headline||'Bienvenue chez '+site.name}</h3>
         <p>{form.subtitle||'Connectez-vous avec votre ticket.'}</p>
         <div className="ps-demo-field">Identifiant du ticket</div>
         <div className="ps-demo-field">Mot de passe</div>
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
      {site&&<Link className="ps-external" href={'/personnalisation-tickets?companyId='+encodeURIComponent(companyId)+'&siteId='+encodeURIComponent(siteId)}>
       Préparer le fichier login.html du MikroTik <ChevronRight size={16}/>
      </Link>}
      <p className="ps-hint">Cette prévisualisation ne tente aucune authentification. Les changements deviennent publics seulement après « Publier ». La page native MikroTik devra être téléchargée puis installée sur le routeur pour refléter les changements locaux.</p>
     </aside>
    </div>
   </>}
  </div>
 </AppShell>;
}
