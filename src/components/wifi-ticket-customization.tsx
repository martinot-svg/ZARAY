'use client';
import { useEffect,useRef,useState,type ChangeEvent } from 'react';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import VoucherCanvas from '@/components/voucher-canvas';
import type { TicketVisual,TicketStyle,PrintableVoucher } from '@/lib/ticket-pdf';
import {legibleInk} from '@/lib/ticket-pdf';
import {paletteFromLogo} from '@/lib/logo-palette';
import {optimizeLogo} from '@/lib/logo-optimizer';

type Site={id:string;company_id:string;name:string};
type Offer={id:string;name:string;status:string;duration_minutes:number;validity_days:number;price_amount:number|string;currency:string};
type Settings=TicketVisual;
const initial:Settings={
 logo_data_uri:null,primary_color:'#167a46',secondary_color:'#ffffff',title_color:'#10251a',
 border_color:'#a5b9ad',font_family:'Arial',username_length:5,password_length:5,
 template_key:'classic',accent_color:'#0e9f6e',gradient_enabled:false,decorations_enabled:true,
 brand_name:'',wifi_ssid:'',phone:'',address:'',welcome_message:'',footer_text:'',
 show_price:true,show_duration:true,show_ticket_id:false,show_wifi_ssid:false
};
const styles:{key:TicketStyle;label:string;detail:string}[]=[
 {key:'classic',label:'Classic',detail:'Présentation historique de ZARAY.'},
 {key:'event',label:'Premium Event Ticket',detail:'Dégradé, séparation et encoches graphiques.'},
 {key:'minimal',label:'Minimal',detail:'Essentiel, discret et élégant.'},
 {key:'corporate',label:'Corporate',detail:'Valorise le logo et les couleurs du site.'}
];
export default function WifiTicketCustomization(){
 const [companyId,setCompanyId]=useState(''),[companyName,setCompanyName]=useState(''),[companySlug,setCompanySlug]=useState('');
 const [sites,setSites]=useState<Site[]>([]),[offers,setOffers]=useState<Offer[]>([]);
 const [siteId,setSiteId]=useState(''),[offerId,setOfferId]=useState('');
 const [form,setForm]=useState<Settings>(initial);
 const [busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[analyzingLogo,setAnalyzingLogo]=useState(false);
 const logoRequest=useRef(0);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let active=true;(async()=>{
   try{
     const qs=new URLSearchParams(window.location.search),company=qs.get('companyId')??'';
     if(!company){window.location.replace('/entreprises');return;}
     const r=await fetch('/api/sites',{cache:'no-store'}),d=await r.json();
     if(!r.ok)throw Error(d.error||'Entreprises indisponibles.');
     const found=(d.companies??[]).find((c:{id:string})=>c.id===company);
     if(!found)throw Error('Entreprise inaccessible.');
     const siteList=(d.sites??[]).filter((s:Site)=>s.company_id===company);
     const selected=qs.get('siteId')??'';
     const or=await fetch('/api/offers?companyId='+encodeURIComponent(company),{cache:'no-store'}),od=await or.json();
     if(!or.ok)throw Error(od.error||'Offres indisponibles.');
     if(!active)return;
     const offerList=od.offers??[];
     setCompanyId(company);setCompanyName(found.legal_name);setCompanySlug(found.slug??'');setSites(siteList);setOffers(offerList);
     setSiteId(siteList.some((s:Site)=>s.id===selected)?selected:siteList[0]?.id??'');
     const requestedOffer=qs.get('offerId')??'';
     setOfferId(offerList.some((o:Offer)=>o.id===requestedOffer)?requestedOffer:'');
   }catch(e){if(active)setError(e instanceof Error?e.message:'Erreur de chargement.');}
   finally{if(active)setBusy(false);}
 })();return()=>{active=false};},[]);
 useEffect(()=>{logoRequest.current++;if(!companyId||!siteId)return;let active=true;setBusy(true);setError('');(async()=>{
   try{
     const q=new URLSearchParams({companyId,siteId});
     if(offerId)q.set('offerId',offerId);
     const r=await fetch('/api/ticket-templates?'+q,{cache:'no-store'}),d=await r.json();
     if(!r.ok)throw Error(d.error||'Configuration indisponible.');
     if(active)setForm({...initial,...d.settings});
   }catch(e){if(active)setError(e instanceof Error?e.message:'Chargement de l’apparence impossible.');}
   finally{if(active)setBusy(false);}
 })();return()=>{active=false};},[companyId,siteId,offerId]);
 function change<K extends keyof Settings>(key:K,value:Settings[K]){setForm(previous=>({...previous,[key]:value}));}
 async function applyLogoPalette(uri:string,replaceLogo:boolean){
  const request=++logoRequest.current;
  setAnalyzingLogo(true);setError('');setNotice(replaceLogo?'Analyse et détourage du logo en cours…':'');
  try{
   const cleaned=replaceLogo?await optimizeLogo(uri):null;
   const targetUri=cleaned?.dataUri??uri;
   const palette=await paletteFromLogo(targetUri);
   if(request!==logoRequest.current)return;
   setForm(previous=>({...previous,...(palette??{}),...(replaceLogo?{logo_data_uri:targetUri}:{})}));
   setNotice(replaceLogo
    ?(cleaned?.removedBackground?'Arrière-plan retiré, marges rognées et logo optimisé.':'Logo optimisé. Le détourage complexe n’a pas pu être appliqué sans risque de perte.')
    :(palette?'Couleurs du logo actualisées.':'Logo conservé.'));
  }catch{
   if(request===logoRequest.current)setError('Le traitement du logo a échoué. Vérifiez son format et sa taille.');
  }finally{if(request===logoRequest.current)setAnalyzingLogo(false);}
 }
 async function upload(e:ChangeEvent<HTMLInputElement>){
   const file=e.target.files?.[0];if(!file)return;
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2_000_000){
     setError('Logo PNG, JPEG ou WebP, maximum technique 2 Mo.');return;
   }
   const reader=new FileReader();
   reader.onload=()=>{if(typeof reader.result==='string')void applyLogoPalette(reader.result,true);};
   reader.onerror=()=>setError('Impossible de lire le fichier logo.');
   reader.readAsDataURL(file);
 }
 async function save(){
   setSaving(true);setError('');setNotice('');
   try{
     const r=await fetch('/api/ticket-templates',{
       method:'PUT',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({companyId,siteId,offerId:offerId||null,...form,
         logo_data_uri:offerId?undefined:form.logo_data_uri})
     });
     const d=await r.json();
     if(!r.ok)throw Error(d.error||'Enregistrement refusé.');
     setNotice('Template enregistré pour '+(offerId?'cette offre du site.':'ce site.')+' Il sera réutilisé lors des prochaines générations.');
   }catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible.');}
   finally{setSaving(false);}
 }

 async function downloadPortal(){
  if(!siteId)return;
  setBusy(true);setError('');setNotice('');
  try{
   if(!/^[a-z0-9-]{2,80}$/i.test(companySlug))throw Error('Identifiant public de l’entreprise indisponible.');
   const response=await fetch('/hotspot/zaray-login.html',{cache:'no-store'});
   if(!response.ok)throw Error('Modèle de portail indisponible.');
   const template=await response.text();
   if(!template.includes('__ZARAY_SITE_ID__')||!template.includes('__ZARAY_COMPANY_SLUG__')
      ||!template.includes('__ZARAY_BRANDING_JSON__'))throw Error('Modèle de portail incomplet.');
   // Always fetch the SITE default, never an offer override: Hotspot identity
   // belongs to the site, independently of whichever ticket is being edited.
   const qs=new URLSearchParams({companyId,siteId});
   const stored=await fetch('/api/ticket-templates?'+qs,{cache:'no-store'});
   const saved=await stored.json();
   if(!stored.ok)throw Error(saved.error||'Identité du site indisponible.');
   const base=saved.settings??initial;
   const linkResponse=await fetch('/api/site-links?'+qs,{cache:'no-store'});
   const linkData=await linkResponse.json().catch(()=>({}));
   if(!linkResponse.ok)throw Error('Impossible de confirmer le mode local du portail. Aucun export avec lien distant ne sera généré.');
   const localOnly=Boolean(linkData.link)&&!linkData.link.publicHostname;
   const snapshot={
    siteName:site?.name??'',
    brandName:String(base.brand_name||site?.name||companyName).slice(0,90),
    logoDataUri:typeof base.logo_data_uri==='string'?base.logo_data_uri:null,
    primaryColor:base.primary_color||'#40caff',
    accentColor:base.accent_color||'#66eabe',
    welcomeMessage:String(base.welcome_message||'').slice(0,120)
   };
   // encodeURIComponent leaves apostrophes unescaped, which must not be
   // injected into a single-quoted JavaScript string in the RouterOS page.
   const safeBranding=encodeURIComponent(JSON.stringify(snapshot)).replace(/'/g,'%27');
   const customized=template.replaceAll('__ZARAY_SITE_ID__',siteId)
    .replaceAll('__ZARAY_COMPANY_SLUG__',companySlug)
    .replaceAll('__ZARAY_BRANDING_JSON__',safeBranding)
    .replaceAll('__ZARAY_LOCAL_ONLY__',localOnly?'true':'false')
    .replaceAll('__ZARAY_PUBLIC_API_BASE__',localOnly?'':'https://zaray.vercel.app');
   const objectUrl=URL.createObjectURL(new Blob([customized],{type:'text/html;charset=utf-8'}));
   const a=document.createElement('a');a.href=objectUrl;a.download='login.html';
   document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(objectUrl),2000);
   setNotice(localOnly
    ?'Page HTML locale téléchargée : seule la connexion par ticket est autonome. Installez login.html et md5.js sur le MikroTik, puis configurez le nom DNS local. Pour inscrire de nouveaux abonnés sans service distant, un serveur local supplémentaire est nécessaire.'
    :'Portail du site téléchargé avec son logo et ses couleurs. Installez login.html et md5.js sur le MikroTik ; configurez les autorisations réseau nécessaires aux services distants.');
  }catch(e){setError(e instanceof Error?e.message:'Téléchargement impossible.');}
  finally{setBusy(false);}
 }
 function restore(){
   setForm(old=>({...initial,logo_data_uri:old.logo_data_uri,
       username_length:old.username_length,password_length:old.password_length}));
   setNotice('Style Classic restauré dans l’aperçu. Cliquez sur Enregistrer pour le sauvegarder.');
 }
 const site=sites.find(s=>s.id===siteId),offer=offers.find(o=>o.id===offerId);
 const example:PrintableVoucher={
   id:'DEMONSTRATION',username:'AZ7K9'.slice(0,form.username_length??5),password:'49381'.slice(0,form.password_length??5),
   offer_name:offer?.name??'Forfait Wi-Fi (exemple)',price_amount:offer?.price_amount??0,
   currency:offer?.currency??'MGA',duration_minutes:offer?.duration_minutes??60,
   validity_days:offer?.validity_days??1,status:'available'
 };
 const names=[
  ['brand_name','Nom commercial',90],['wifi_ssid','Nom du réseau / SSID',64],
  ['phone','Téléphone',60],['address','Localisation',160],
  ['welcome_message','Message de bienvenue',120],['footer_text','Pied du ticket',100]
 ] as const;
 return <>
  <section className="panel" style={{padding:20,marginBottom:16}}>
    <p>Entreprise active : <strong>{companyName}</strong></p>
    <div className="field-grid">
      <label>Site<select value={siteId} onChange={e=>{setSiteId(e.target.value);setOfferId('');}}>
        {sites.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
      </select></label>
      <label>Appliquer à<select value={offerId} onChange={e=>setOfferId(e.target.value)}>
        <option value="">Tous les forfaits du site (par défaut)</option>
        {offers.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}
      </select></label>
    </div>
  </section>
  {!sites.length?<p>Aucun site disponible pour cette entreprise.</p>:
  <div className="workspace-grid">
    <section className="panel wifi-template-editor" style={{padding:18}}>
      <h2>Bibliothèque des templates</h2>
      <div className="wifi-template-choices" role="group" aria-label="Choisir un modèle">
        {styles.map(style=><button type="button" key={style.key}
          aria-pressed={(form.template_key??'classic')===style.key}
          className={'wifi-template-choice'+((form.template_key??'classic')===style.key?' is-selected':'')}
          onClick={()=>change('template_key',style.key)}>
          <strong>{style.label}</strong><small>{style.detail}</small>
        </button>)}
      </div>
      <h2>Couleurs et identité</h2>
      {!offerId?<div><label>Logo du site (PNG, JPEG, WebP)</label>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={analyzingLogo}/>
        <p className="muted">Détourage intelligent : fonds unis et multicolores avec traitement IA local, puis rognage automatique.</p>
        
        {form.logo_data_uri&&<div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:12,margin:'12px 0'}}>
         <img src={form.logo_data_uri} alt="Logo du site chargé" style={{maxWidth:'100%',width:'auto',height:'auto',maxHeight:180,objectFit:'contain',background:'#E8EDF1',borderRadius:10,padding:7,border:'1px solid #9BADBA'}}/>
         <button type="button" disabled={analyzingLogo} onClick={()=>void applyLogoPalette(form.logo_data_uri!,false)}>{analyzingLogo?'Analyse du logo…':'Reprendre les couleurs du logo'}</button>
         <button type="button" disabled={analyzingLogo} onClick={()=>{logoRequest.current++;change('logo_data_uri',null);}}>Retirer le logo</button>
        </div>}
      </div>:null}
      <div className="field-grid">
        {([['primary_color','Principale'],['secondary_color','Fond'],['accent_color','Accent / dégradé'],
           ['title_color','Texte'],['border_color','Bordure']] as const).map(([key,label])=>
          <label key={key}>{label}<input type="color" value={form[key]??'#ffffff'} onChange={e=>change(key,e.target.value)}/></label>)}
      </div>
<details className="workspace-inline-disclosure"><summary>Effets et typographie</summary>      <div className="field-grid">
        {([['gradient_enabled','Dégradé (hors Classic)'],['decorations_enabled','Ornements graphiques']] as const).map(([key,label])=>
          <label key={key} className="wifi-template-check"><input type="checkbox" checked={form[key]===true} onChange={e=>change(key,e.target.checked)}/> {label}</label>)}
      </div>
      <label>Police<select value={form.font_family} onChange={e=>change('font_family',e.target.value)}>
        {['Arial','Georgia','Verdana','Tahoma'].map(f=><option value={f} key={f}>{f}</option>)}
      </select></label>
</details>
            <h2>Informations personnalisées</h2>
      <div className="field-grid">
        {names.map(([key,label,max])=><label key={key}>{label}
          <input type="text" value={form[key]??''} maxLength={max} onChange={e=>change(key,e.target.value)}/>
        </label>)}
      </div>
<details className="workspace-inline-disclosure"><summary>Options et codes d’accès</summary>      <div className="field-grid">
        {([['show_ticket_id','Afficher le numéro'],['show_wifi_ssid','Afficher le SSID']] as const).map(([key,label])=>
          <label key={key} className="wifi-template-check">
            <input type="checkbox" checked={form[key]===true} onChange={e=>change(key,e.target.checked)}/> {label}
          </label>)}
      </div>
      
      <h2>Codes d'accès — réglages existants</h2>
      <div className="field-grid">
        <label>Longueur du nom d’utilisateur (3–5)<input type="number" min={3} max={5} value={form.username_length} onChange={e=>change('username_length',Number(e.target.value))}/></label>
        <label>Longueur du mot de passe (3–5 chiffres)<input type="number" min={3} max={5} value={form.password_length} onChange={e=>change('password_length',Number(e.target.value))}/></label>
      </div>
      
</details>
            <div className="wifi-template-actions">
        <button type="button" onClick={restore} disabled={saving}>Restaurer Classic</button>
        <button type="button" className="primary-link" disabled={busy||saving||analyzingLogo||!siteId} onClick={()=>void save()}>
          <ZarayIcon name="save" size={17}/>{saving?'Enregistrement…':'Enregistrer comme modèle'}
        </button>
      </div>
      {error&&<p className="alert alert-error" role="alert">{error}</p>}
      {notice&&<p className="alert alert-success" role="status">{notice}</p>}
    </section>
    <section className="panel wifi-template-preview-panel" style={{padding:18}}>
      <h2>Aperçu en direct · 60 × 20 mm</h2>
      <div className="wifi-template-preview-wrap">
        <VoucherCanvas preview ticket={example} design={form} siteName={site?.name??'Site'}/>
      </div>
      <p className="muted">Aperçu fictif · aucun accès réseau.</p>
<details className="workspace-inline-disclosure"><summary>Aperçu et installation du portail captif</summary>      <div style={{margin:'20px 0',padding:16,border:'1px solid var(--line, #6c7d8a)',borderRadius:14}}>
       <h3>Portail captif personnalisé par site</h3>
       
       {!offerId?<div aria-label="Aperçu du portail captif du site" style={{margin:'14px auto',maxWidth:360,padding:20,borderRadius:20,background:'linear-gradient(140deg,#102436,#071522)',border:'1px solid '+(form.primary_color||'#40caff'),textAlign:'center',color:'#f2fbff'}}>
         {form.logo_data_uri?<img src={form.logo_data_uri} alt="Logo du site" style={{height:'auto',maxHeight:'min(24vh,180px)',maxWidth:'100%',width:'auto',objectFit:'contain',marginBottom:8,padding:6,background:'#DDE8ED',borderRadius:10,filter:'drop-shadow(0 1px 1px rgba(0,0,0,.6))'}}/>:<div aria-hidden="true" style={{fontSize:25,fontWeight:800,color:form.accent_color||'#66eabe'}}>Wi-Fi</div>}
         <div style={{fontWeight:800,fontSize:16}}>{form.brand_name||site?.name||companyName}</div>
         <p style={{fontSize:11,color:'#b8d3d9'}}>{form.welcome_message||'Chaque connexion ouvre votre univers.'}</p>
         <div style={{display:'grid',gap:8,textAlign:'left',fontSize:11,marginTop:14}}>
          <span>Nom d’utilisateur<input readOnly tabIndex={-1} value="" aria-label="Aperçu utilisateur" placeholder="Identifiant du ticket" style={{width:'100%',padding:9,borderRadius:8,background:'#142b3b',border:'1px solid #476071',color:'#ffffff'}}/></span>
          <span>Mot de passe<input readOnly tabIndex={-1} type="password" value="" aria-label="Aperçu mot de passe" placeholder="PIN" style={{width:'100%',padding:9,borderRadius:8,background:'#142b3b',border:'1px solid #476071',color:'#ffffff'}}/></span>
          <div style={{padding:10,borderRadius:9,background:'linear-gradient(90deg,'+(form.primary_color||'#40caff')+','+(form.accent_color||'#66eabe')+')',textAlign:'center',color:legibleInk('#081720',form.primary_color||'#40caff'),fontWeight:800}}>Se connecter</div>
         </div>
         <div style={{marginTop:10,fontSize:11,color:form.accent_color||'#66eabe',textDecoration:'underline'}}>Découvrir les offres</div>
        </div>:null}
       
       <button type="button" disabled={busy||!siteId} onClick={()=>void downloadPortal()}>
        <ZarayIcon name="download" size={17}/> Télécharger la page MikroTik pour ce site
       </button>
       <p className="muted"><a href={'/wifi/'+encodeURIComponent(companySlug)+(siteId?'?siteId='+encodeURIComponent(siteId):'')} target="_blank" rel="noopener noreferrer"><ZarayIcon name="next" size={17}/> Ouvrir la version web interactive du portail de ce site</a></p>
       
      </div>
</details>
            <a className="primary-link" href={'/tickets?companyId='+encodeURIComponent(companyId)+'&siteId='+encodeURIComponent(siteId)+'&tab=generate'}>
        <ZarayIcon name="print" size={17}/> Générer une planche A4
      </a>
    </section>
  </div>}
 </>;
}
