'use client';
import { useEffect, useState, type ChangeEvent } from 'react';
import AppShell from '@/components/app-shell';
import { ZarayIcon } from '@/components/ui/zaray-icon';

type Site={id:string;company_id:string;name:string};
type Offer={id:string;name:string;status:string};
type Settings={
 logo_data_uri:string|null;primary_color:string;secondary_color:string;title_color:string;border_color:string;
 font_family:string;username_length:number;password_length:number;
};
const initial:Settings={logo_data_uri:null,primary_color:'#167a46',secondary_color:'#ffffff',title_color:'#10251a',border_color:'#a5b9ad',font_family:'Arial',username_length:5,password_length:12};
export default function TicketCustomizationPage(){
 const [companyId,setCompanyId]=useState('');
 const [companyName,setCompanyName]=useState('');
 const [sites,setSites]=useState<Site[]>([]);
 const [offers,setOffers]=useState<Offer[]>([]);
 const [siteId,setSiteId]=useState('');
 const [offerId,setOfferId]=useState('');
 const [form,setForm]=useState<Settings>(initial);
 const [busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let active=true;(async()=>{
  try{
   const qs=new URLSearchParams(window.location.search),company=qs.get('companyId')??'';
   if(!company){window.location.replace('/entreprises');return;}
   const r=await fetch('/api/sites',{cache:'no-store'}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Entreprises indisponibles.');
   const c=(d.companies??[]).find((c:{id:string})=>c.id===company);
   if(!c)throw Error('Entreprise inaccessible.');
   if(!active)return;
   const scoped=(d.sites??[]).filter((s:Site)=>s.company_id===company);
   setCompanyId(company);setCompanyName(c.legal_name);setSites(scoped);
   const requested=qs.get('siteId')??'';
   setSiteId(scoped.some((s:Site)=>s.id===requested)?requested:(scoped[0]?.id??''));
   const or=await fetch('/api/offers?companyId='+encodeURIComponent(company),{cache:'no-store'}),od=await or.json();
   if(!or.ok)throw Error(od.error||'Offres indisponibles.');
   if(active)setOffers(od.offers??[]);
  }catch(e){if(active)setError(e instanceof Error?e.message:'Erreur.');}
  finally{if(active)setBusy(false);}
 })();return()=>{active=false};},[]);
 useEffect(()=>{if(!companyId||!siteId)return;let active=true;setBusy(true);setError('');(async()=>{
  try{
   const qs=new URLSearchParams({companyId,siteId});if(offerId)qs.set('offerId',offerId);
   const r=await fetch('/api/ticket-templates?'+qs,{cache:'no-store'}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Configuration indisponible.');
   if(active)setForm(d.settings);
  }catch(e){if(active)setError(e instanceof Error?e.message:'Erreur.');}
  finally{if(active)setBusy(false);}
 })();return()=>{active=false};},[companyId,siteId,offerId]);
 function change<K extends keyof Settings>(key:K,value:Settings[K]){setForm(s=>({...s,[key]:value}));}
 async function upload(e:ChangeEvent<HTMLInputElement>){
  const f=e.target.files?.[0];if(!f)return;
  if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>130000){setError('PNG, JPEG ou WebP, maximum 130 Ko.');return;}
  const reader=new FileReader();
  reader.onload=()=>{if(typeof reader.result==='string')change('logo_data_uri',reader.result);};
  reader.readAsDataURL(f);
 }
 async function save(){
  setSaving(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/ticket-templates',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    companyId,siteId,offerId:offerId||null,...form,
    logo_data_uri:offerId?undefined:form.logo_data_uri
   })});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Modification refusée.');
   setNotice('Paramètres enregistrés uniquement pour ce site'+(offerId?' et cette offre':'')+'.');
  }catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible.');}
  finally{setSaving(false);}
 }
 const site=sites.find(s=>s.id===siteId);
 const offer=offers.find(o=>o.id===offerId);
 return <AppShell activePath="/personnalisation-tickets" companyId={companyId} eyebrow="MODULE 7 · IDENTITÉ" title="Personnalisation des tickets" description="Logo propre à chaque site, apparence par forfait et identifiants temporaires.">
  <div className="panel" style={{padding:20,marginBottom:16}}>
   <p>Entreprise active : <strong>{companyName}</strong></p>
   <div className="field-grid">
    <label>Site<select value={siteId} onChange={e=>{setSiteId(e.target.value);setOfferId('');}}>
     {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
    </select></label>
    <label>Style de l'offre<select value={offerId} onChange={e=>setOfferId(e.target.value)}>
     <option value="">Paramètres généraux du site</option>
     {offers.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
    </select></label>
   </div>
  </div>
  {!sites.length?<p>Aucun site disponible. Créez d'abord un site dans cette entreprise.</p>:
  <div className="workspace-grid">
   <section className="panel" style={{padding:18}}>
    <h2>Paramètres du ticket</h2>
    {!offerId?<div><label>Logo de ce site (PNG, JPEG, WebP)</label><input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload}/>
     {form.logo_data_uri&&<button type="button" onClick={()=>change('logo_data_uri',null)}>Supprimer ce logo</button>}</div>
    :<p className="muted">Le logo provient exclusivement du site. Le style de cette offre reste indépendant.</p>}
    <div className="field-grid">
     {([['primary_color','Principale'],['secondary_color','Arrière-plan'],['title_color','Titres'],['border_color','Bordures']] as const).map(([key,label])=>
      <label key={key}>{label}<input type="color" value={form[key]} onChange={e=>change(key,e.target.value)}/></label>)}
    </div>
    <label>Typographie<select value={form.font_family} onChange={e=>change('font_family',e.target.value)}>
     {['Arial','Georgia','Verdana','Tahoma'].map(f=><option key={f}>{f}</option>)}
    </select></label>
    <div className="field-grid">
     <label>Longueur du nom d'utilisateur (3–5)<input type="number" min="3" max="5" value={form.username_length} onChange={e=>change('username_length',Number(e.target.value))}/></label>
     <label>Longueur du mot de passe (12–32)<input type="number" min="12" max="32" value={form.password_length} onChange={e=>change('password_length',Number(e.target.value))}/></label>
    </div>
    <button className="primary-link" type="button" disabled={saving||busy||!companyId||!siteId} onClick={save}><ZarayIcon name="save" size={16}/>{saving?'Enregistrement…':'Enregistrer la personnalisation'}</button>
    {error&&<p role="alert" className="alert alert-error">{error}</p>}
    {notice&&<p role="status">{notice}</p>}
   </section>
   <section className="panel" style={{padding:18}}>
    <h2>Aperçu à l'échelle 3:1</h2>
    <div style={{maxWidth:480,width:'100%',aspectRatio:'3 / 1',border:'1px solid '+form.border_color,borderRadius:4,background:form.secondary_color,fontFamily:form.font_family,display:'flex',gap:8,padding:8,color:form.title_color,overflow:'hidden'}}>
     {form.logo_data_uri&&<img src={form.logo_data_uri} alt="Logo du site" style={{objectFit:'contain',width:'24%',height:'100%'}}/>}
     <div style={{flex:1,minWidth:0}}>
      <strong style={{fontSize:13,color:form.primary_color,display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{site?.name??'Site'}</strong>
      <div style={{fontSize:11}}>{offer?.name??'Ticket Wi-Fi'}</div>
      <div style={{fontSize:11}}>Utilisateur : {'A'.repeat(Math.max(3,Math.min(5,form.username_length)))}</div>
      <div style={{fontSize:11}}>Mot de passe : {'•'.repeat(Math.max(12,Math.min(32,form.password_length)))}</div>
     </div>
    </div>
    <p className="muted">Les dates ne seront imprimées que lorsqu'elles sont réellement connues. Les identifiants d'aperçu sont fictifs.</p>
    <a className="primary-link" href={'/tickets?companyId='+encodeURIComponent(companyId)+'&siteId='+encodeURIComponent(siteId)}>Générer et imprimer des tickets</a>
   </section>
  </div>}
 </AppShell>;
}
