'use client';
import { useEffect, useState } from 'react';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import VoucherCanvas from '@/components/voucher-canvas';
import { generateA4Pdf, generateA4Jpegs, generateSingleTicketJpeg, voucherPages, type PrintableVoucher, type TicketVisual } from '@/lib/ticket-pdf';
type Site={id:string;company_id:string;name:string;status:string};
type Offer={id:string;name:string;status:string};
type Router={id:string;site_id:string;name:string;control_enabled:boolean;last_seen_at:string|null};
type Batch={batchId:string;createdAt:string;count:number;ready:number;activated:number;pending:number;expired:number;printed:number;offerId:string};
const defaultVisual:TicketVisual={logo_data_uri:null,primary_color:'#167a46',secondary_color:'#ffffff',title_color:'#10251a',border_color:'#a5b9ad',font_family:'Arial',username_length:5,password_length:5};
export default function WifiTicketGenerator(){
 const [companyId,setCompanyId]=useState(''),[companyName,setCompanyName]=useState('');
 const [sites,setSites]=useState<Site[]>([]),[siteId,setSiteId]=useState('');
 const [offers,setOffers]=useState<Offer[]>([]),[offerId,setOfferId]=useState('');
 const [routers,setRouters]=useState<Router[]>([]),[routerId,setRouterId]=useState('');
 const [count,setCount]=useState(33),[design,setDesign]=useState<TicketVisual>(defaultVisual);
 const [tickets,setTickets]=useState<PrintableVoucher[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [batchId,setBatchId]=useState(''),[readyCount,setReadyCount]=useState(0),[batches,setBatches]=useState<Batch[]>([]),[singleId,setSingleId]=useState('');
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
   const netResponse=await fetch('/api/network?companyId='+encodeURIComponent(company),{cache:'no-store'}),netData=await netResponse.json();
   if(netResponse.ok&&live)setRouters(netData.routers??[]);
  }catch(e){if(live)setError(e instanceof Error?e.message:'Chargement impossible.');}
 })();return()=>{live=false};},[]);
 useEffect(()=>{if(!companyId||!siteId||!offerId)return;let live=true;(async()=>{
  try{const q=new URLSearchParams({companyId,siteId,offerId});
   const r=await fetch('/api/ticket-templates?'+q,{cache:'no-store'}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Personnalisation indisponible.');
   if(live)setDesign(d.settings);
  }catch(e){if(live)setError(e instanceof Error?e.message:'Personnalisation indisponible.');}
 })();return()=>{live=false};},[companyId,siteId,offerId]);
 function changeSite(value:string){setSiteId(value);setRouterId('');setTickets([]);setBatchId('');setReadyCount(0);setError('');}
 function changeOffer(value:string){setOfferId(value);setTickets([]);setBatchId('');setReadyCount(0);setError('');}

 async function fetchBatches(){
  if(!companyId||!siteId)return;
  try{
   const p=new URLSearchParams({companyId,siteId});
   const r=await fetch('/api/wifi-vouchers/batches?'+p,{cache:'no-store'});
   const d=await r.json();
   if(r.ok)setBatches(d.batches??[]);
  }catch{}
 }
 useEffect(()=>{void fetchBatches();const timer=setInterval(()=>void fetchBatches(),15000);return()=>clearInterval(timer);},[companyId,siteId]);
 useEffect(()=>{
  if(!batchId||!companyId||!siteId)return;
  let cancelled=false;
  async function check(){
   try{
    const q=new URLSearchParams({companyId,siteId});
    const r=await fetch('/api/wifi-vouchers?'+q,{cache:'no-store'});
    const d=await r.json();
    if(!r.ok||cancelled)return;
    const rows=(d.vouchers??[]).filter((v:{batch_id:string})=>v.batch_id===batchId);
    setReadyCount(rows.filter((v:{status:string;network:{network_state:string}|null})=>v.status==='available'&&v.network?.network_state==='provisioned').length);
   }catch{}
  }
  void check();
  const timer=setInterval(()=>void check(),5000);
  return()=>{cancelled=true;clearInterval(timer);};
 },[batchId,companyId,siteId]);
 async function authorizedPrint(currentBatch=batchId){
  const r=await fetch('/api/wifi-vouchers/batches',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,siteId,batchId:currentBatch})});
  const d=await r.json();
  if(!r.ok)throw Error(d.error||'Lot non prêt pour impression.');
  if(!Array.isArray(d.tickets)||!d.tickets.length)throw Error('Lot vide.');
  return d.tickets as PrintableVoucher[];
 }
 function downloadFile(blob:Blob,filename:string){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
 }
 async function restoreBatch(id:string){
  setBusy(true);setError('');
  try{
   const list=await authorizedPrint(id);
   setBatchId(id);setTickets(list);setSingleId(list[0].id);setReadyCount(list.length);
  }catch(e){setError(e instanceof Error?e.message:'Lot indisponible.');}
  finally{setBusy(false);}
 }
 async function exportJpegs(){
  setBusy(true);setError('');
  try{
   const list=await authorizedPrint();
   const pages=await generateA4Jpegs({siteName:sites.find(s=>s.id===siteId)?.name??'Site',design,tickets:list});
   pages.forEach((blob,i)=>downloadFile(blob,'ZARAY-tickets-'+batchId.slice(0,8)+'-page-'+(i+1)+'.jpeg'));
   await fetchBatches();
  }catch(e){setError(e instanceof Error?e.message:'Export JPEG impossible.');}
  finally{setBusy(false);}
 }
 async function exportOneJpeg(){
  setBusy(true);setError('');
  try{
   const list=await authorizedPrint();
   const t=list.find(item=>item.id===singleId)||list[0];
   const blob=await generateSingleTicketJpeg(t,design,sites.find(s=>s.id===siteId)?.name??'Site');
   downloadFile(blob,'ZARAY-ticket-'+t.username+'.jpeg');
  }catch(e){setError(e instanceof Error?e.message:'Export JPEG impossible.');}
  finally{setBusy(false);}
 }
 async function printBatch(){
  setBusy(true);setError('');
  try{
   await authorizedPrint();
   window.print();
   await fetchBatches();
  }catch(e){setError(e instanceof Error?e.message:'Impression indisponible.');}
  finally{setBusy(false);}
 }

 async function create(){
  setBusy(true);setError('');setTickets([]);setBatchId('');setReadyCount(0);
  try{
   const r=await fetch('/api/wifi-vouchers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId,siteId,offerId,count,routerId:selectedRouterId})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Génération refusée.');
   setTickets(d.tickets??[]);setBatchId(d.batchId??'');setSingleId(d.tickets?.[0]?.id??'');await fetchBatches();
  }catch(e){setError(e instanceof Error?e.message:'Génération impossible.');}
  finally{setBusy(false);}
 }
 async function download(){
  setBusy(true);setError('');
  try{
   const list=await authorizedPrint();
   const file=await generateA4Pdf({siteName:sites.find(s=>s.id===siteId)?.name??'Site',design,tickets:list});
   downloadFile(file,'ZARAY-tickets-WiFi-'+batchId.slice(0,8)+'.pdf');
   await fetchBatches();
  }catch(e){setError(e instanceof Error?e.message:'PDF impossible.');}
  finally{setBusy(false);}
 }
 const chosen=sites.find(s=>s.id===siteId);
 const availableRouters=routers.filter(r=>r.site_id===siteId&&r.control_enabled&&r.last_seen_at&&Date.now()-new Date(r.last_seen_at).getTime()<180000);
 const selectedRouterId=availableRouters.some(r=>r.id===routerId)?routerId:(availableRouters[0]?.id??'');
 return <>
  <section className="panel" style={{padding:18,marginBottom:16}}>
   <p>Entreprise active : <strong>{companyName}</strong></p>
   <div className="field-grid">
    <label>Site<select value={siteId} onChange={e=>changeSite(e.target.value)}>{sites.map(s=><option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}</select></label>
    <label>Offre<select value={offerId} onChange={e=>changeOffer(e.target.value)}>{offers.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
    <label>MikroTik du site<select value={selectedRouterId} onChange={e=>{setRouterId(e.target.value);setTickets([]);}} required>
      {availableRouters.length===0&&<option value="">Aucun routeur connecté</option>}
      {availableRouters.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
     </select></label>
    <label>Quantité<select value={count} onChange={e=>{setCount(Number(e.target.value));setTickets([]);}}>{[1,11,33,66,99].map(n=><option key={n} value={n}>{n} ticket{n>1?'s':''}</option>)}</select></label>
   </div>
   <p className="muted">Chaque ticket possède un identifiant unique et un mot de passe numérique de 3 à 5 chiffres. La durée Internet est cumulée : une déconnexion interrompt le décompte. Les comptes sont préparés sur MikroTik avant la vente. Le client paie en espèces, reçoit son ticket imprimé, puis la première connexion réussie déclenche automatiquement sa comptabilisation.</p>
   {!availableRouters.length&&<p className="alert" role="status">Aucun MikroTik autorisé n’est connecté à ce site. <a href={'/gestion-reseau?companyId='+encodeURIComponent(companyId)}>Associer et activer le routeur</a>.</p>}
   <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
    <button type="button" className="primary-link" disabled={!companyId||!siteId||!offerId||!selectedRouterId||busy||chosen?.status!=='active'} onClick={create}><ZarayIcon name="ticket" size={16}/>{busy?'Génération…':'Générer un lot unique'}</button>
    <a href={'/tickets?companyId='+encodeURIComponent(companyId)+'&siteId='+encodeURIComponent(siteId)+'&tab=customize'}>Personnaliser l'apparence</a>
   </div>
   {error&&<p className="alert alert-error" role="alert">{error}</p>}
  </section>
  <section className="panel" style={{padding:18,marginBottom:16}}>
   <h2>Lots et stock de tickets préimprimés</h2>
   <p className="muted">Les lots sont préparés automatiquement sur MikroTik avant leur impression. Une réimpression nécessite l'autorisation d'un responsable et est journalisée.</p>
   {batches.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Lot</th><th>Création</th><th>Stock prêt</th><th>Activés</th><th>En préparation</th><th>Exportés</th><th>Action</th></tr></thead>
   <tbody>{batches.map(b=><tr key={b.batchId}><td><strong>{b.batchId.slice(0,8)}</strong></td><td>{new Date(b.createdAt).toLocaleDateString('fr-FR')}</td>
    <td>{b.ready} / {b.count}</td><td>{b.activated}</td><td>{b.pending}</td><td>{b.printed}</td>
    <td><button type="button" disabled={busy||b.ready!==b.count||b.activated>0||b.expired>0} onClick={()=>void restoreBatch(b.batchId)}>Ouvrir / réimprimer</button></td></tr>)}</tbody></table></div>
    :<p className="muted">Aucun lot pour ce site.</p>}
  </section>
  {tickets.length>0&&<>
   <div className="panel" style={{padding:18,marginBottom:18}}>
    <h2>Lot créé — {tickets.length} identifiants uniques</h2>
    <p role="status">{readyCount===tickets.length?'Lot prêt sur MikroTik : les tickets peuvent être imprimés et vendus.':readyCount+' / '+tickets.length+' comptes prêts sur MikroTik. Attendez la préparation complète avant d’imprimer ou de vendre.'}</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
     <button className="primary-link" type="button" disabled={busy||readyCount!==tickets.length} onClick={()=>void download()}><ZarayIcon name="download" size={16}/> PDF A4</button>
     <button type="button" disabled={busy||readyCount!==tickets.length} onClick={()=>void exportJpegs()}>JPEG A4</button>
     <button type="button" disabled={busy||readyCount!==tickets.length} onClick={()=>void printBatch()}><ZarayIcon name="print" size={16}/> Imprimer en ligne</button>
     <label>Ticket individuel <select value={singleId} onChange={e=>setSingleId(e.target.value)}>{tickets.map(t=><option value={t.id} key={t.id}>{t.username}</option>)}</select></label>
     <button type="button" disabled={busy||readyCount!==tickets.length} onClick={()=>void exportOneJpeg()}>JPEG individuel</button>
    </div>
   </div>
   <div style={{overflowX:'auto'}}>
    <div id="zaray-print-area">
     {voucherPages(tickets).map((page,index)=><div className="zaray-a4-sheet" key={index}>
       {page.map(ticket=><div className="zaray-small-voucher" key={ticket.id}>
         <VoucherCanvas ticket={ticket} design={design} siteName={chosen?.name??''}/>
       </div>)}
     </div>)}
    </div>
   </div>
   <style jsx global>{`
    .zaray-a4-sheet{box-sizing:border-box;width:210mm;height:297mm;padding:21mm 10mm;display:grid;grid-template-columns:repeat(3,60mm);grid-template-rows:repeat(11,20mm);column-gap:5mm;row-gap:3.5mm;background:white;margin:0 auto 16px;box-shadow:0 0 4px #999;page-break-after:always;break-after:page}
    .zaray-small-voucher{box-sizing:border-box;width:60mm;height:20mm;display:block;overflow:hidden;position:relative;padding:0}
    .zaray-voucher-edge{position:absolute;left:0;top:0;bottom:0;width:0.6mm}
    .zaray-voucher-logo{width:11mm;height:16mm;object-fit:contain;align-self:center}
    .zaray-voucher-detail{min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center;font-size:5.7pt;line-height:1.16;overflow:hidden}
    .zaray-voucher-detail strong,.zaray-voucher-detail span{white-space:nowrap;overflow:hidden;text-overflow:clip}
    .zaray-voucher-detail small{font-size:5pt;white-space:nowrap}.zaray-voucher-detail span:nth-of-type(3){white-space:normal;overflow-wrap:anywhere;font-size:5pt;line-height:1.05}
    @page{size:A4 portrait;margin:0}
    .zaray-voucher-print-canvas{width:60mm!important;height:20mm!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    @media print{html,body{margin:0!important;padding:0!important;background:white!important}body *{visibility:hidden!important}#zaray-print-area,#zaray-print-area *{visibility:visible!important}#zaray-print-area{position:absolute!important;top:0!important;left:0!important;width:210mm!important} .zaray-a4-sheet{margin:0!important;box-shadow:none!important} }
   `}</style>
  </>}
 </>;
}
