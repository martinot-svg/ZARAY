'use client';
import {useEffect,useMemo,useState,type FormEvent} from 'react';
import AppShell from '@/components/app-shell';
import {ZarayIcon} from '@/components/ui/zaray-icon';
type Router={id:string;site_id:string;name:string;host:string;model:string|null;routeros_version:string|null;status:string;control_enabled:boolean;last_seen_at:string|null};
type Observation={id:string;router_id:string;observed_kind:string;identity_key:string;ip_address:string|null;mac_address:string|null;client_label:string|null;active:boolean;observed_at:string};
type Account={id:string;router_id:string;order_id:string|null;username:string;protocol:string;expires_at:string|null;grace_until:string|null;extension_until:string|null;administrative_hold:boolean;desired_state:string;applied_state:string};
type Order={id:string;site_id:string;public_reference:string;customer_name:string;status:string;validity_days:number};
type Command={id:string;router_id:string;action:string;username:string;status:string;outcome:string|null;created_at:string};
type Site={id:string;company_id:string;name:string};
const fresh=(stamp:string|null)=>!!stamp&&Date.now()-new Date(stamp).getTime()<150000;
const status=(r:Router)=>fresh(r.last_seen_at)?'En ligne':r.last_seen_at?'Hors ligne':'Non appairé';
const fmt=(d:string|null)=>d?new Date(d).toLocaleString('fr-FR'):'—';
export default function NetworkPage(){
 const [companyId,setCompanyId]=useState(''),[role,setRole]=useState(''),[sites,setSites]=useState<Site[]>([]),[siteId,setSiteId]=useState('');
 const [routers,setRouters]=useState<Router[]>([]),[devices,setDevices]=useState<Observation[]>([]),[accounts,setAccounts]=useState<Account[]>([]),[orders,setOrders]=useState<Order[]>([]),[commands,setCommands]=useState<Command[]>([]);
 const [name,setName]=useState(''),[host,setHost]=useState(''),[routerId,setRouterId]=useState(''),[username,setUsername]=useState(''),[protocol,setProtocol]=useState('hotspot'),[orderId,setOrderId]=useState('');
 const [pair,setPair]=useState<{token:string;routerId:string;expiresAt:string}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [grace,setGrace]=useState('72'),[extensionLimit,setExtensionLimit]=useState('24'),[filter,setFilter]=useState('all'),[selectedDevice,setSelectedDevice]=useState('');
 const canManage=role==='owner'||role==='admin';
 const chosen=routers.find(r=>r.id===routerId);
 const visibleDevices=useMemo(()=>devices.filter(d=>filter==='all'||d.observed_kind===filter),[devices,filter]);
 async function refresh(id=companyId){
  if(!id)return;
  try{
   const [network,access]=await Promise.all([fetch('/api/network?companyId='+encodeURIComponent(id),{cache:'no-store'}),fetch('/api/network/access?companyId='+encodeURIComponent(id),{cache:'no-store'})]);
   const n=await network.json(),a=await access.json();
   if(!network.ok||!access.ok)throw Error(n.error||a.error||'Données réseau indisponibles');
   setRouters(n.routers||[]);setDevices(n.observations||[]);setAccounts(a.accounts||[]);setOrders(a.orders||[]);setCommands(a.commands||[]);
   setGrace(String(a.policy.grace_hours));setExtensionLimit(String(a.policy.extension_max_hours));
   setRouterId(v=>(n.routers||[]).some((x:Router)=>x.id===v)?v:(n.routers?.[0]?.id||''));
  }catch(e){setError(e instanceof Error?e.message:'Erreur réseau');}
 }
 useEffect(()=>{(async()=>{try{
  const r=await fetch('/api/sites',{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'Sites indisponibles');
  const id=new URLSearchParams(location.search).get('companyId')||data.companies?.[0]?.id||'';
  const company=data.companies?.find((c:{id:string})=>c.id===id);
  if(!company)throw Error('Entreprise inaccessible.');
  setCompanyId(id);setRole(company.role);const list=(data.sites||[]).filter((s:Site)=>s.company_id===id);
  setSites(list);setSiteId(list[0]?.id||'');await refresh(id);
 }catch(e){setError(e instanceof Error?e.message:'Erreur de chargement');}})();},[]);
 useEffect(()=>{if(!companyId)return;const handle=setInterval(()=>void refresh(companyId),30000);return()=>clearInterval(handle);},[companyId]);
 async function run(endpoint:string,payload:Record<string,unknown>,method='POST'){
  setBusy(true);setError('');setNotice('');
  try{const response=await fetch(endpoint,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,companyId})});const data=await response.json();if(!response.ok)throw Error(data.error||'Action impossible');setNotice(data.message||'Action enregistrée.');await refresh();return data;}
  catch(e){setError(e instanceof Error?e.message:'Erreur');return null;}
  finally{setBusy(false);}
 }
 async function add(e:FormEvent){e.preventDefault();const data=await run('/api/network',{siteId,name,host});if(data){setName('');setHost('');}}
 async function register(e:FormEvent){e.preventDefault();const data=await run('/api/network/access',{routerId,orderId,username,protocol});if(data)setUsername('');}
 async function pairing(r:Router){const data=await run('/api/network/pair',{routerId:r.id});if(data?.pairingToken){setPair({token:data.pairingToken,routerId:r.id,expiresAt:data.expiresAt});}}
 async function control(r:Router){if(!confirm('Changer les autorisations de contrôle sur '+r.name+' ?'))return;await run('/api/network/access',{kind:'control',routerId:r.id,enabled:!r.control_enabled},'PATCH');}
 async function hold(a:Account){if(!confirm('Modifier la suspension administrative du compte '+a.username+' ?'))return;const reason=prompt('Motif de l’intervention :')?.trim();if(!reason)return;await run('/api/network/access',{kind:'hold',accountId:a.id,blocked:!a.administrative_hold,reason},'PATCH');}
 async function extend(a:Account){const hours=Number(prompt('Durée en heures, maximum '+extensionLimit+' :','24'));if(!Number.isInteger(hours)||hours<1)return;const reason=prompt('Motif de la prolongation :')?.trim();if(!reason)return;await run('/api/network/access',{kind:'extend',accountId:a.id,hours,reason},'PATCH');}
 async function deviceAction(d:Observation,blocked:boolean){
  if(!d.mac_address)return;
  const reason=prompt((blocked?'Bloquer':'Débloquer')+' cet appareil Hotspot ? Indiquez le motif :')?.trim();
  if(!reason)return;
  await run('/api/network/device-action',{routerId:d.router_id,mac:d.mac_address,action:blocked?'block':'unblock',reason});
 }
 return <AppShell activePath="/gestion-reseau" eyebrow="MODULE 10 · NETWORK CONTROL CENTER" title="Gestion réseau" description="Routeurs MikroTik, sessions Internet, inventaire des appareils et droits d’accès — avec synchronisation depuis le réseau local.">
  <div className="workspace-grid">
   <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Ajouter un MikroTik</h2><p className="muted">Rattachez un routeur à son site, puis associez le connecteur local.</p></div></div>
    <form onSubmit={add} className="form-stack compact-form">
     <label>Site<select value={siteId} onChange={e=>setSiteId(e.target.value)} required>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
     <label>Nom du routeur<input value={name} onChange={e=>setName(e.target.value)} placeholder="MikroTik principal" minLength={2} maxLength={120} required/></label>
     <label>IP ou domaine local<input value={host} onChange={e=>setHost(e.target.value)} placeholder="192.168.88.1" maxLength={255} required/></label>
     <p className="muted">Aucun mot de passe n’est demandé par le navigateur. Le connecteur se connecte localement via HTTPS, même derrière CGNAT.</p>
     <button type="submit" className="primary-link" disabled={!canManage||!siteId||busy}><ZarayIcon name="add" size={17}/> {busy?'En cours…':'Enregistrer'}</button>
    </form>
   </section>
   <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Équipements MikroTik</h2><span className="muted">{routers.length} routeur(s)</span></div></div>
    {routers.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Routeur</th><th>Site</th><th>Connexion</th><th>Contrôle</th><th>Actions</th></tr></thead><tbody>{routers.map(r=><tr key={r.id}>
     <td><strong>{r.name}</strong><small>{r.model||r.host} · {r.routeros_version||'RouterOS non détecté'}</small></td><td>{sites.find(s=>s.id===r.site_id)?.name||'—'}</td><td>{status(r)}<small>{fmt(r.last_seen_at)}</small></td>
     <td>{r.control_enabled?'Activé':'Lecture seule'}</td><td><button type="button" disabled={!canManage||busy} onClick={()=>void pairing(r)}>Associer</button> <button type="button" disabled={role!=='owner'||busy} onClick={()=>void control(r)}>{r.control_enabled?'Désactiver':'Activer le contrôle'}</button></td>
    </tr>)}</tbody></table></div>:<div className="empty-state"><strong>Aucun MikroTik</strong><p>Enregistrez un équipement pour commencer.</p></div>}
   </section>
  </div>
  {pair&&<section className="panel" aria-live="polite"><h2 className="panel-title">Code d’association à usage unique</h2><p>Valable jusqu’au {fmt(pair.expiresAt)}. Ce code n’est affiché qu’une fois.</p><p><code style={{overflowWrap:'anywhere'}}>{pair.token}</code></p><p className="muted">Routeur : <code>{pair.routerId}</code>. Installez le connecteur Node.js du projet sur une machine du réseau local, avec les variables ZARAY_ROUTER_ID, ZARAY_PAIRING_TOKEN, MIKROTIK_URL, MIKROTIK_USER et MIKROTIK_PASSWORD. Utilisez un certificat RouterOS vérifiable. </p><button type="button" onClick={()=>void navigator.clipboard.writeText(pair.token)}>Copier le code</button> <button type="button" onClick={()=>setPair(null)}>Masquer</button></section>}
  <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Cartographie du réseau</h2><p className="muted">Topologie déduite des sites, routeurs et observations réellement remontées. Les liens radio non confirmés ne sont pas inventés.</p></div></div>
   <div className="workspace-grid">{sites.map(s=><div className="panel" key={s.id} style={{padding:16}}>
    <h3>◈ {s.name}</h3>{routers.filter(r=>r.site_id===s.id).map(r=><div key={r.id} style={{margin:'12px 0',padding:12,border:'1px solid var(--border, rgba(120,150,200,.25))',borderRadius:12}}>
      <strong>↳ {r.name}</strong> <small>{status(r)}</small>
      <div className="muted">{devices.filter(d=>d.router_id===r.id).length} observations : {devices.filter(d=>d.router_id===r.id&&d.active&&fresh(d.observed_at)).length} actives</div>
      <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:8}}>{devices.filter(d=>d.router_id===r.id).slice(0,18).map(d=><span key={d.id} className="muted" style={{border:'1px solid currentColor',borderRadius:20,padding:'4px 8px'}}>{d.observed_kind==='wifi'?'⌁':'•'} {d.client_label||d.identity_key}</span>)}</div>
    </div>)}{!routers.some(r=>r.site_id===s.id)&&<p className="muted">Aucun routeur associé.</p>}
   </div>)}</div>
  </section>
  <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Appareils et sessions détectés</h2><p className="muted">« Actif » signifie observé dans les 2 min 30 précédentes. DHCP ou voisinage seuls ne prouvent pas une connexion Internet.</p></div><label>Source <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Toutes</option>{['hotspot','pppoe','dhcp','wifi','neighbor','radius'].map(x=><option key={x} value={x}>{x.toUpperCase()}</option>)}</select></label></div>
   {visibleDevices.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Appareil / Utilisateur</th><th>Source</th><th>Adresse IP</th><th>État</th><th>Intervention</th></tr></thead><tbody>{visibleDevices.map(d=><tr key={d.id}><td><strong>{d.client_label||d.identity_key}</strong><small>{d.mac_address||'MAC inconnue'}</small></td><td>{d.observed_kind}</td><td>{d.ip_address||'—'}</td><td>{d.active&&fresh(d.observed_at)&&routers.some(r=>r.id===d.router_id&&fresh(r.last_seen_at))?'Session active':'Historique / état inconnu'}</td><td>{d.observed_kind==='hotspot'&&d.mac_address&&canManage?<button type="button" disabled={busy} onClick={()=>void deviceAction(d,true)}>Bloquer</button>:<span className="muted">Consultation</span>}</td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Aucune découverte</strong><p>Les équipements apparaîtront après l’appairage et la première synchronisation.</p></div>}
  </section>
  <div className="workspace-grid"><section className="panel"><h2 className="panel-title">Associer un abonnement au réseau</h2>
   <form className="form-stack compact-form" onSubmit={register}>
    <label>Routeur<select value={routerId} onChange={e=>setRouterId(e.target.value)} required>{routers.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></label>
    <label>Commande<select value={orderId} onChange={e=>setOrderId(e.target.value)} required><option value="">Choisir une commande</option>{orders.filter(o=>chosen&&o.site_id===chosen.site_id&&!accounts.some(a=>a.order_id===o.id)).map(o=><option key={o.id} value={o.id}>{o.customer_name} · {o.public_reference} · {o.status}</option>)}</select></label>
    <label>Protocole<select value={protocol} onChange={e=>setProtocol(e.target.value)}><option value="hotspot">Hotspot</option><option value="pppoe">PPPoE</option></select></label>
    <label>Identifiant du compte RouterOS existant<input value={username} onChange={e=>setUsername(e.target.value)} maxLength={128} required placeholder="client-001"/></label>
    <p className="muted">Le compte doit exister sur RouterOS. Aucun identifiant de ticket imprimé n’est provisionné automatiquement.</p>
    <button type="submit" disabled={!canManage||!routerId||!orderId||busy}>Associer le compte</button>
   </form>
  </section>
  <section className="panel"><h2 className="panel-title">Règles des impayés</h2><p className="muted">Définies par le dirigeant ; les justificatifs non approuvés ne déclenchent jamais un renouvellement.</p>
   <div className="form-stack compact-form"><label>Délai de grâce (heures)<input type="number" min="0" max="2160" value={grace} onChange={e=>setGrace(e.target.value)}/></label>
   <label>Prolongation exceptionnelle maximale (heures)<input type="number" min="1" max="87600" value={extensionLimit} onChange={e=>setExtensionLimit(e.target.value)}/></label>
   <button type="button" disabled={role!=='owner'||busy} onClick={()=>void run('/api/network/access',{kind:'policy',graceHours:Number(grace),extensionMaxHours:Number(extensionLimit)},'PATCH')}>Enregistrer les règles</button></div>
  </section></div>
  <section className="panel"><div className="panel-head"><h2 className="panel-title">Comptes et suspensions</h2><span className="muted">{accounts.length} comptes</span></div>
   {accounts.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Compte</th><th>Expiration / grâce</th><th>Décision</th><th>Appliqué sur MikroTik</th><th>Actions</th></tr></thead><tbody>{accounts.map(a=><tr key={a.id}><td><strong>{a.username}</strong><small>{a.protocol.toUpperCase()}{a.administrative_hold?' · Suspension administrative':''}</small></td><td>{fmt(a.expires_at)}<small>Grâce : {fmt(a.grace_until)} · Exception : {fmt(a.extension_until)}</small></td><td>{a.desired_state}</td><td>{a.applied_state}</td><td><button type="button" disabled={!canManage||busy} onClick={()=>void hold(a)}>{a.administrative_hold?'Lever le blocage':'Suspendre'}</button> <button type="button" disabled={!canManage||busy} onClick={()=>void extend(a)}>Prolonger</button></td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Aucun compte associé</strong><p>Associez une commande à un utilisateur Hotspot ou PPPoE.</p></div>}
  </section>
  <section className="panel"><h2 className="panel-title">Historique des commandes réseau</h2>{commands.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Heure</th><th>Action</th><th>Compte</th><th>Statut</th><th>Retour</th></tr></thead><tbody>{commands.map(c=><tr key={c.id}><td>{fmt(c.created_at)}</td><td>{c.action}</td><td>{c.username}</td><td>{c.status}</td><td>{c.outcome||'—'}</td></tr>)}</tbody></table></div>:<p className="muted">Aucune commande pour cette entreprise.</p>}</section>
  {(error||notice)&&<section className="panel" role={error?'alert':'status'}>{error||notice}</section>}
 </AppShell>;
}
