'use client';
import {useEffect,useMemo,useState} from 'react';
type Site={id:string;company_id:string;name:string};
type Net={router_id:string;network_state:string;used_seconds:number;last_usage_at:string|null;unit_price:number|string|null;unit_currency:string|null;last_error:string|null};
type Ticket={id:string;username:string;batch_id:string;status:string;duration_minutes:number;paid_at:string|null;activated_at:string|null;created_at:string;network:Net|null};
type Stats={totals:{generated:number;available:number;activated:number;todayActivated:number;expired:number;cancelled:number};activatedValue:{amount:number;currency:string}[];note:string;truncated:boolean};
const labels:Record<string,string>={available:'En stock',paid:'Ancienne vente',active:'Utilisé',expired:'Expiré',cancelled:'Annulé'};
const networks:Record<string,string>={not_sold:'Non préparé',queued:'Préparation',provisioned:'Prêt sur MikroTik',failed:'Erreur réseau',expired:'Désactivé'};
const time=(seconds:number)=>{const v=Math.max(0,Math.floor(seconds));return Math.floor(v/3600)+'h '+Math.floor(v%3600/60)+'min';};
const date=(value:string|null)=>value?new Date(value).toLocaleString('fr-FR'):'—';
export default function WifiVoucherSales({companyId}:{companyId:string}){
 const [sites,setSites]=useState<Site[]>([]),[siteId,setSiteId]=useState(''),[tickets,setTickets]=useState<Ticket[]>([]);
 const [stats,setStats]=useState<Stats|null>(null),[filter,setFilter]=useState('all'),[search,setSearch]=useState('');
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;(async()=>{try{
  const r=await fetch('/api/sites',{cache:'no-store'}),d=await r.json();
  if(!r.ok)throw Error(d.error||'Sites indisponibles');
  const list=(d.sites??[]).filter((x:Site)=>x.company_id===companyId);
  if(active){setSites(list);setSiteId(list[0]?.id??'');}
 }catch(e){if(active)setError(e instanceof Error?e.message:'Erreur');}})();return()=>{active=false};},[companyId]);
 useEffect(()=>{if(!siteId)return;let live=true;
  async function refresh(){
   try{
    const qs=new URLSearchParams({companyId,siteId});
    const [r1,r2]=await Promise.all([fetch('/api/wifi-vouchers?'+qs,{cache:'no-store'}),fetch('/api/wifi-vouchers/analytics?'+qs,{cache:'no-store'})]);
    const [a,b]=await Promise.all([r1.json(),r2.json()]);
    if(!r1.ok||!r2.ok)throw Error(a.error||b.error||'Inventaire indisponible');
    if(live){setTickets(a.vouchers??[]);setStats(b);}
   }catch(e){if(live)setError(e instanceof Error?e.message:'Erreur');}
  }
  void refresh();const timer=setInterval(()=>void refresh(),15000);
  return()=>{live=false;clearInterval(timer);};
 },[companyId,siteId]);
 const visible=useMemo(()=>tickets.filter(v=>{
  const state=v.status==='available'&&v.network?.network_state==='provisioned'?'ready':v.status;
  return (filter==='all'||filter===state)&&(v.username.toLowerCase().includes(search.toLowerCase())||v.batch_id.slice(0,8).toLowerCase().includes(search.toLowerCase()));
 }),[tickets,filter,search]);
 async function cancel(v:Ticket){
  if(!confirm('Révoquer le ticket '+v.username+' ? Son accès MikroTik sera désactivé et ce code ne pourra plus être vendu.'))return;
  const reason=prompt('Motif obligatoire de cette annulation :')?.trim();if(!reason||reason.length<5)return;
  setBusy(true);setError('');setMessage('');
  try{
   const r=await fetch('/api/wifi-vouchers/cancel',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({companyId,siteId,voucherId:v.id,reason})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Annulation impossible');
   setMessage(d.message||'Ticket annulé.');setTickets(old=>old.map(x=>x.id===v.id?{...x,status:'cancelled'}:x));
  }catch(e){setError(e instanceof Error?e.message:'Erreur');}finally{setBusy(false);}
 }
 const totalValue=stats?.activatedValue.map(x=>Number(x.amount).toLocaleString('fr-FR')+' '+(x.currency==='MGA'?'Ar':x.currency)).join(' + ')||'0 Ar';
 return <section className="panel" style={{padding:18}}>
  <div className="panel-head"><div><h2 className="panel-title">Stock, premières connexions et montants</h2>
   <p className="muted">Les tickets sont vendus physiquement en espèces. Le MikroTik prépare les codes avant impression et la première connexion réussie est comptabilisée automatiquement une seule fois.</p>
  </div></div>
  <label>Site<select value={siteId} onChange={e=>{setSiteId(e.target.value);setError('');}}>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
  <div className="workspace-grid" style={{marginTop:16}}>
   {[
    ['Tickets générés',stats?.totals.generated??0],
    ['Stock non utilisé',stats?.totals.available??0],
    ['Premières connexions',stats?.totals.activated??0],
    ['Connexions aujourd’hui',stats?.totals.todayActivated??0],
    ['Expirés',stats?.totals.expired??0],
    ['Annulés',stats?.totals.cancelled??0]
   ].map(([title,value])=><div className="panel" key={String(title)} style={{padding:14}}><p className="muted">{title}</p><h2>{value}</h2></div>)}
  </div>
  <div className="panel" style={{padding:18,margin:'16px 0'}}>
   <p className="muted">Valeur cumulée des tickets ayant réussi leur première connexion</p>
   <h2>{totalValue}</h2>
   <p className="muted">{stats?.note||'Les montants seront affichés après les premières connexions.'}</p>
   {stats?.truncated&&<p role="status">Historique volumineux : affichage partiel. Prévoir un export comptable paginé.</p>}
  </div>
  <div className="field-grid">
   <label>Rechercher par identifiant ou lot<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ex. A7K9"/></label>
   <label>État<select value={filter} onChange={e=>setFilter(e.target.value)}>
    <option value="all">Tous les tickets</option><option value="ready">Prêts en stock</option><option value="available">En préparation</option>
    <option value="active">Utilisés</option><option value="paid">Anciennes ventes</option><option value="expired">Expirés</option><option value="cancelled">Annulés</option>
   </select></label>
  </div>
  {visible.length?<div className="table-wrap"><table className="data-table"><thead><tr>
   <th>Ticket / lot</th><th>Valeur</th><th>État</th><th>Réseau</th><th>Temps restant</th><th>Première connexion</th><th>Action</th>
  </tr></thead><tbody>{visible.map(v=><tr key={v.id}>
   <td><strong>{v.username}</strong><small>Lot {v.batch_id.slice(0,8)}</small></td>
   <td>{v.network?.unit_price!=null?Number(v.network.unit_price).toLocaleString('fr-FR')+' '+(v.network.unit_currency==='MGA'?'Ar':v.network.unit_currency):'—'}</td>
   <td>{labels[v.status]||v.status}</td><td>{v.network?networks[v.network.network_state]||v.network.network_state:'Ancien ticket'}{v.network?.last_error&&<small>{v.network.last_error}</small>}</td>
   <td>{v.network?.last_usage_at?time(v.duration_minutes*60-v.network.used_seconds):v.duration_minutes+' min (non utilisé)'}</td>
   <td>{date(v.activated_at)}</td><td>{v.status==='available'?<button type="button" disabled={busy} onClick={()=>void cancel(v)}>Révoquer</button>:'—'}</td>
  </tr>)}</tbody></table></div>:<p className="muted">Aucun ticket correspondant.</p>}
  <p className="muted">Affichage limité aux 200 tickets récents par site. Les codes de 3 à 5 chiffres sont réservés à l’accès Hotspot et doivent être protégés contre les tentatives répétées. Une connexion constatée ne prouve pas à elle seule que le vendeur a encaissé les espèces.</p>
  {error&&<p role="alert" className="alert alert-error">{error}</p>}{message&&<p role="status" className="alert alert-success">{message}</p>}
 </section>;
}
