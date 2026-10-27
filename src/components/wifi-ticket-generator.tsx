'use client';
import { useEffect, useState } from 'react';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import { generateA4Pdf, voucherPages, type PrintableVoucher, type TicketVisual } from '@/lib/ticket-pdf';
type Site={id:string;company_id:string;name:string;status:string};
type Offer={id:string;name:string;status:string};
const defaultVisual:TicketVisual={logo_data_uri:null,primary_color:'#167a46',secondary_color:'#ffffff',title_color:'#10251a',border_color:'#a5b9ad',font_family:'Arial',username_length:5,password_length:12};
export default function WifiTicketGenerator(){
 const [companyId,setCompanyId]=useState(''),[companyName,setCompanyName]=useState('');
 const [sites,setSites]=useState<Site[]>([]),[siteId,setSiteId]=useState('');
 const [offers,setOffers]=useState<Offer[]>([]),[offerId,setOfferId]=useState('');
 const [count,setCount]=useState(33),[design,setDesign]=useState<TicketVisual>(defaultVisual);
 const [tickets,setTickets]=useState<PrintableVoucher[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;(async()=>{
  try{
   const qs=new URLSearchParams(window.location.search),company=qs.get('companyId')??'';
   if(!company){window.location.replace('/entreprises');return;}
   const res=await fetch('/api/sites',{cache:'no-store'}),data=await res.json();
   if(!res.ok)throw Error(data.error||'Sites indisponibles.');
   const c=(data.companies??[]).find((x:{id:string})=>x.id===company);
   if(!c)throw Error('Entreprise inaccessible.');
   const scoped=(data.sites??[]).filter((s:Site)=>s.company_id===company);
   const requested=qs.get('siteId')??'';
   if(live){setCompanyId(company);setCompanyName(c.legal_name);setSites(scoped);setSiteId(scoped.some((s:Site)=>s.id===requested)?requested:scoped[0]?.id??'');}
   const offersResponse=await fetch('/api/offers?companyId='+encodeURIComponent(company),{cache:'no-store'}),offersData=await offersResponse.json();
   if(!offersResponse.ok)throw Error(offersData.error||'Offres indisponibles.');
   if(live){const active=(offersData.offers??[]).filter((o:Offer)=>o.status==='active');setOffers(active);setOfferId(active[0]?.id??'');}
  }catch(e){if(live)setError(e instanceof Error?e.message:'Chargement impossible.');}
 })();return()=>{live=false};},[]);
 useEffect(()=>{if(!companyId||!siteId||!offerId)return;let live=true;(async()=>{
  try{const q=new URLSearchParams({companyId,siteId,offerId});
   const r=await fetch('/api/ticket-templates?'+q,{cache:'no-store'}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Personnalisation indisponible.');
   if(live)setDesign(d.settings);
  }catch(e){if(live)setError(e instanceof Error?e.message:'Personnalisation indisponible.');}
 })();return()=>{live=false};},[companyId,siteId,offerId]);
 function changeSite(value:string){setSiteId(value);setTickets([]);setError('');}
 function changeOffer(value:string){setOfferId(value);setTickets([]);setError('');}
 async function create(){
  setBusy(true);setError('');setTickets([]);
  try{
   const r=await fetch('/api/wifi-vouchers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId,siteId,offerId,count})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Génération refusée.');
   setTickets(d.tickets??[]);
  }catch(e){setError(e instanceof Error?e.message:'Génération impossible.');}
  finally{setBusy(false);}
 }
 async function download(){
  setBusy(true);setError('');
  try{
   const file=await generateA4Pdf({siteName:sites.find(s=>s.id===siteId)?.name??'Site',design,tickets});
   const uri=URL.createObjectURL(file),a=document.createElement('a');
   a.href=uri;a.download='ZARAY-tickets-WiFi-'+new Date().toISOString().slice(0,10)+'.pdf';
   a.click();setTimeout(()=>URL.revokeObjectURL(uri),1500);
  }catch(e){setError(e instanceof Error?e.message:'PDF impossible.');}
  finally{setBusy(false);}
 }
 const chosen=sites.find(s=>s.id===siteId);
 return <>
  <section className="panel" style={{padding:18,marginBottom:16}}>
   <p>Entreprise active : <strong>{companyName}</strong></p>
   <div className="field-grid">
    <label>Site<select value={siteId} onChange={e=>changeSite(e.target.value)}>{sites.map(s=><option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}</select></label>
    <label>Offre<select value={offerId} onChange={e=>changeOffer(e.target.value)}>{offers.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
    <label>Quantité<select value={count} onChange={e=>{setCount(Number(e.target.value));setTickets([]);}}>{[1,11,33,66,99].map(n=><option key={n} value={n}>{n} ticket{n>1?'s':''}</option>)}</select></label>
   </div>
   <p className="muted">Chaque ticket possède un identifiant et un mot de passe différents. Il reste « disponible », sans accès Internet, tant qu'il n'a pas été vendu et provisionné sur le réseau.</p>
   <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
    <button type="button" className="primary-link" disabled={!companyId||!siteId||!offerId||busy||chosen?.status!=='active'} onClick={create}><ZarayIcon name="ticket" size={16}/>{busy?'Génération…':'Générer un lot unique'}</button>
    <a href={'/tickets?companyId='+encodeURIComponent(companyId)+'&siteId='+encodeURIComponent(siteId)+'&tab=customize'}>Personnaliser l'apparence</a>
   </div>
   {error&&<p className="alert alert-error" role="alert">{error}</p>}
  </section>
  {tickets.length>0&&<>
   <div className="panel" style={{padding:18,marginBottom:18}}>
    <h2>Lot créé — {tickets.length} identifiants uniques</h2>
    <p role="alert">Conservez immédiatement le PDF ou imprimez ces tickets : les mots de passe ne sont jamais récupérables depuis ZARAY après fermeture de cette page. Il s'agit d'un stock non activé.</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
     <button className="primary-link" type="button" disabled={busy} onClick={()=>void download()}><ZarayIcon name="download" size={16}/> Télécharger PDF A4</button>
     <button type="button" onClick={()=>window.print()}><ZarayIcon name="print" size={16}/> Imprimer en ligne</button>
    </div>
   </div>
   <div style={{overflowX:'auto'}}>
    <div id="zaray-print-area">
     {voucherPages(tickets).map((page,index)=><div className="zaray-a4-sheet" key={index}>
      {page.map(ticket=><div className="zaray-small-voucher" key={ticket.id} style={{background:design.secondary_color,color:design.title_color,borderColor:design.border_color,fontFamily:design.font_family}}>
       <div className="zaray-voucher-edge" style={{background:design.primary_color}}/>
       {design.logo_data_uri&&<img src={design.logo_data_uri} alt="" className="zaray-voucher-logo"/>}
       <div className="zaray-voucher-detail">
        <strong style={{color:design.primary_color}}>{chosen?.name}</strong>
        <span>{ticket.offer_name}</span>
        <span>Utilisateur : <b>{ticket.username}</b></span>
        <span>Mot de passe : <b>{ticket.password}</b></span>
        <small>{ticket.duration_minutes} min · {ticket.price_amount} {ticket.currency} · Non activé</small>
       </div>
      </div>)}
     </div>)}
    </div>
   </div>
   <style jsx global>{`
    .zaray-a4-sheet{box-sizing:border-box;width:210mm;height:297mm;padding:21mm 10mm;display:grid;grid-template-columns:repeat(3,60mm);grid-template-rows:repeat(11,20mm);column-gap:5mm;row-gap:3.5mm;background:white;margin:0 auto 16px;box-shadow:0 0 4px #999;page-break-after:always;break-after:page}
    .zaray-small-voucher{box-sizing:border-box;width:60mm;height:20mm;border:0.25mm solid;display:flex;overflow:hidden;position:relative;padding:1mm;gap:1mm}
    .zaray-voucher-edge{position:absolute;left:0;top:0;bottom:0;width:0.6mm}
    .zaray-voucher-logo{width:11mm;height:16mm;object-fit:contain;align-self:center}
    .zaray-voucher-detail{min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center;font-size:5.7pt;line-height:1.16;overflow:hidden}
    .zaray-voucher-detail strong,.zaray-voucher-detail span{white-space:nowrap;overflow:hidden;text-overflow:clip}
    .zaray-voucher-detail small{font-size:5pt;white-space:nowrap}.zaray-voucher-detail span:nth-of-type(3){white-space:normal;overflow-wrap:anywhere;font-size:5pt;line-height:1.05}
    @page{size:A4 portrait;margin:0}
    @media print{html,body{margin:0!important;padding:0!important;background:white!important}body *{visibility:hidden!important}#zaray-print-area,#zaray-print-area *{visibility:visible!important}#zaray-print-area{position:absolute!important;top:0!important;left:0!important;width:210mm!important} .zaray-a4-sheet{margin:0!important;box-shadow:none!important} }
   `}</style>
  </>}
 </>;
}
