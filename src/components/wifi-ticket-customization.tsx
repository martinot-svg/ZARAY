'use client';
import { useEffect,useState,type ChangeEvent } from 'react';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import VoucherCanvas from '@/components/voucher-canvas';
import type { TicketVisual,TicketStyle,PrintableVoucher } from '@/lib/ticket-pdf';

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
 const [busy,setBusy]=useState(true),[saving,setSaving]=useState(false);
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
 useEffect(()=>{if(!companyId||!siteId)return;let active=true;setBusy(true);setError('');(async()=>{
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
 async function upload(e:ChangeEvent<HTMLInputElement>){
   const file=e.target.files?.[0];if(!file)return;
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>130000){
     setError('Logo PNG, JPEG ou WebP, maximum 130 Ko.');return;
   }
   const reader=new FileReader();
   reader.onload=()=>{if(typeof reader.result==='string')change('logo_data_uri',reader.result);};
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
   if(!template.includes('__ZARAY_SITE_ID__')||!template.includes('__ZARAY_COMPANY_SLUG__'))throw Error('Modèle de portail incomplet.');
   const customized=template.replaceAll('__ZARAY_SITE_ID__',siteId).replaceAll('__ZARAY_COMPANY_SLUG__',companySlug);
   const objectUrl=URL.createObjectURL(new Blob([customized],{type:'text/html;charset=utf-8'}));
   const a=document.createElement('a');a.href=objectUrl;a.download='login.html';
   document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(objectUrl),2000);
   setNotice('Portail unifié téléchargé : tickets Wi-Fi et bouton d’abonnement résidentiel. Installez login.html et md5.js dans le Hotspot, puis autorisez les pages de souscription ZARAY avant authentification.');
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
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload}/>
        {form.logo_data_uri&&<button type="button" onClick={()=>change('logo_data_uri',null)}>Retirer le logo</button>}
      </div>:<p className="muted">Le logo est hérité du site. La personnalisation d'une offre ne modifie pas le logo du site.</p>}
      <div className="field-grid">
        {([['primary_color','Principale'],['secondary_color','Fond'],['accent_color','Accent / dégradé'],
           ['title_color','Texte'],['border_color','Bordure']] as const).map(([key,label])=>
          <label key={key}>{label}<input type="color" value={form[key]??'#ffffff'} onChange={e=>change(key,e.target.value)}/></label>)}
      </div>
      <div className="field-grid">
        {([['gradient_enabled','Dégradé (hors Classic)'],['decorations_enabled','Ornements graphiques']] as const).map(([key,label])=>
          <label key={key} className="wifi-template-check"><input type="checkbox" checked={form[key]===true} onChange={e=>change(key,e.target.checked)}/> {label}</label>)}
      </div>
      <label>Police<select value={form.font_family} onChange={e=>change('font_family',e.target.value)}>
        {['Arial','Georgia','Verdana','Tahoma'].map(f=><option value={f} key={f}>{f}</option>)}
      </select></label>
      <h2>Informations personnalisées</h2>
      <div className="field-grid">
        {names.map(([key,label,max])=><label key={key}>{label}
          <input type="text" value={form[key]??''} maxLength={max} onChange={e=>change(key,e.target.value)}/>
        </label>)}
      </div>
      <div className="field-grid">
        {([['show_ticket_id','Afficher le numéro'],['show_wifi_ssid','Afficher le SSID']] as const).map(([key,label])=>
          <label key={key} className="wifi-template-check">
            <input type="checkbox" checked={form[key]===true} onChange={e=>change(key,e.target.checked)}/> {label}
          </label>)}
      </div>
      <p className="muted">La durée, le prix et l’état « Non activé » restent toujours visibles. Les détails facultatifs s’ajustent à l’espace disponible. Aucun QR code factice n’est imprimé.</p>
      <h2>Codes d'accès — réglages existants</h2>
      <div className="field-grid">
        <label>Longueur du nom d’utilisateur (3–5)<input type="number" min={3} max={5} value={form.username_length} onChange={e=>change('username_length',Number(e.target.value))}/></label>
        <label>Longueur du mot de passe (3–5 chiffres)<input type="number" min={3} max={5} value={form.password_length} onChange={e=>change('password_length',Number(e.target.value))}/></label>
      </div>
      <p className="muted">Les mots de passe des nouveaux tickets contiennent uniquement des chiffres (0–9). Pour réduire les tentatives de devinette, 5 chiffres sont recommandés.</p>
      <div className="wifi-template-actions">
        <button type="button" onClick={restore} disabled={saving}>Restaurer Classic</button>
        <button type="button" className="primary-link" disabled={busy||saving||!siteId} onClick={()=>void save()}>
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
      <p className="muted">APERÇU DE DÉMONSTRATION — les identifiants affichés ici ne donnent aucun accès au réseau.</p>
      <p className="muted">A4 portrait · 3 colonnes × 11 lignes · 33 tickets par page. PDF, écran et impression utilisent un moteur graphique commun.</p>
      <div style={{margin:'20px 0',padding:16,border:'1px solid var(--line, #6c7d8a)',borderRadius:14}}>
       <h3>Portail captif unique · Wi-Fi occasionnel et abonnements résidentiels</h3>
       <p className="muted">Tous les clients découvrent la même page après connexion au Wi-Fi du site : tickets occasionnels avec nom d’utilisateur et mot de passe, ou bouton « Devenir un abonné de {companyName||'votre entreprise'} » dirigeant vers l’inscription résidentielle. Le MikroTik reste responsable de l’authentification des tickets et du contrôle de l’accès.</p>
       <button type="button" disabled={busy||!siteId} onClick={()=>void downloadPortal()}>
        <ZarayIcon name="download" size={17}/> Télécharger la page MikroTik pour ce site
       </button>
       <p className="muted">Pour que le client puisse s’inscrire sans Internet actif, le MikroTik doit autoriser avant authentification les pages de souscription ZARAY et leurs ressources. L’installation de login.html sur le routeur local n’est pas effectuée depuis Vercel.</p>
      </div>
      <a className="primary-link" href={'/tickets?companyId='+encodeURIComponent(companyId)+'&siteId='+encodeURIComponent(siteId)+'&tab=generate'}>
        <ZarayIcon name="print" size={17}/> Générer une planche A4
      </a>
    </section>
  </div>}
 </>;
}
