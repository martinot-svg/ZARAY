'use client';
import {useEffect,useMemo,useState} from 'react';
import {ZarayIcon} from '@/components/ui/zaray-icon';
type Site={id:string;company_id:string;name:string};
type Voucher={id:string;username:string;status:string;duration_minutes:number;validity_days:number;paid_at:string|null;activated_at:string|null;expires_at:string|null;network:{router_id:string;network_state:string}|null};
const stateLabels:Record<string,string>={not_sold:'En stock',queued:'Activation en attente',provisioned:'Prêt sur MikroTik',failed:'Erreur réseau',expired:'Désactivé'};
export default function WifiVoucherSales({companyId}:{companyId:string}){
 const [sites,setSites]=useState<Site[]>([]),[siteId,setSiteId]=useState('');
 const [tickets,setTickets]=useState<Voucher[]>([]),[voucherId,setVoucherId]=useState(''),[customer,setCustomer]=useState('Client occasionnel');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 async function load(company=companyId,site=siteId){
  if(!site)return;
  const response=await fetch('/api/wifi-vouchers?'+new URLSearchParams({companyId:company,siteId:site}),{cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Stock Wi-Fi indisponible.');
  setTickets(data.vouchers??[]);
 }
 useEffect(()=>{let active=true;(async()=>{try{
  const r=await fetch('/api/sites',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Sites indisponibles');
  const list:Site[]=(d.sites??[]).filter((s:Site)=>s.company_id===companyId);
  if(active){setSites(list);setSiteId(list[0]?.id??'');}
 }catch(e){if(active)setError(e instanceof Error?e.message:'Erreur');}})();return()=>{active=false};},[companyId]);
 useEffect(()=>{if(!siteId)return;let live=true;async function refresh(){try{await load();}catch(e){if(live)setError(e instanceof Error?e.message:'Erreur');}}
 void refresh();const interval=setInterval(()=>void refresh(),30000);return()=>{live=false;clearInterval(interval);};},[companyId,siteId]);
 const stock=useMemo(()=>tickets.filter(t=>t.status==='available'&&t.network),[tickets]);
 async function sell(){
  if(!voucherId)return;setBusy(true);setNotice('');setError('');
  try{
   const r=await fetch('/api/wifi-vouchers/sell',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voucherId,customerName:customer})}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Vente impossible.');
   setNotice('Paiement en espèces enregistré. Le MikroTik est en cours de provisionnement ; attendez le statut « Prêt sur MikroTik ».');
   setVoucherId('');await load();
  }catch(e){setError(e instanceof Error?e.message:'Erreur de vente.');}finally{setBusy(false);}
 }
 return <section className="panel" style={{padding:18}}>
  <div className="panel-head"><div><h2 className="panel-title">Vendre et activer un ticket Wi-Fi</h2><p className="muted">Un ticket imprimé reste désactivé jusqu'à l'encaissement et la confirmation du routeur.</p></div></div>
  <div className="field-grid">
   <label>Site<select value={siteId} onChange={e=>{setSiteId(e.target.value);setVoucherId('');setError('');}}>
    {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
   <label>Ticket en stock<select value={voucherId} onChange={e=>setVoucherId(e.target.value)}><option value="">Choisir l’identifiant du ticket</option>
    {stock.map(t=><option key={t.id} value={t.id}>{t.username} · {t.duration_minutes} min</option>)}</select></label>
   <label>Client (facultatif)<input value={customer} onChange={e=>setCustomer(e.target.value)} maxLength={160} placeholder="Client occasionnel"/></label>
  </div>
  <button type="button" className="primary-link" disabled={busy||!voucherId} onClick={()=>void sell()}><ZarayIcon name="payment" size={18}/> {busy?'Enregistrement…':'Encaisser en espèces et activer'}</button>
  {error&&<p className="alert alert-error" role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  <h3 style={{marginTop:24}}>État des tickets du site</h3>
  {tickets.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Identifiant</th><th>Vente</th><th>MikroTik</th><th>Activation</th><th>Expiration</th></tr></thead>
   <tbody>{tickets.map(t=><tr key={t.id}><td><strong>{t.username}</strong></td><td>{t.status==='available'?'En stock':t.status==='paid'?'Vendu':t.status==='active'?'Utilisé':t.status==='expired'?'Expiré':t.status}</td><td>{t.network?stateLabels[t.network.network_state]??t.network.network_state:'Ancien ticket non lié'}</td><td>{t.activated_at?new Date(t.activated_at).toLocaleString('fr-FR'):'—'}</td><td>{t.expires_at?new Date(t.expires_at).toLocaleString('fr-FR'):'—'}</td></tr>)}</tbody></table></div>
  :<p className="muted">Aucun ticket pour ce site. Générez les identifiants depuis l’onglet Générer.</p>}
  <p className="muted">Les identifiants des anciens lots ne peuvent pas être provisionnés automatiquement : leurs mots de passe ne sont pas récupérables. Seuls les nouveaux lots liés à un MikroTik bénéficient de l'activation.</p>
 </section>;
}
