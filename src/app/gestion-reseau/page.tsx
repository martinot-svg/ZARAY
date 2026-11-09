'use client';
import { fetchWorkspaceDirectory } from '@/lib/workspace-directory-request';
import {useEffect,useMemo,useState,type FormEvent} from 'react';
import AppShell from '@/components/app-shell';
import {ZarayIcon} from '@/components/ui/zaray-icon';
type Router={id:string;site_id:string;name:string;host:string;model:string|null;routeros_version:string|null;status:string;control_enabled:boolean;agent_kind:'unreported'|'node-local'|'routeros-native';last_seen_at:string|null};
type RouterResource={router_id:string;cpu_load_percent:number;total_memory_bytes:number;free_memory_bytes:number;router_uptime:string;observed_at:string};
type Observation={id:string;router_id:string;observed_kind:string;identity_key:string;ip_address:string|null;mac_address:string|null;client_label:string|null;active:boolean;observed_at:string};
type Account={id:string;router_id:string;order_id:string|null;username:string;protocol:string;expires_at:string|null;grace_until:string|null;extension_until:string|null;administrative_hold:boolean;desired_state:string;applied_state:string};
type Order={id:string;site_id:string;public_reference:string;customer_name:string;status:string;validity_days:number};
type Command={id:string;router_id:string;action:string;username:string;status:string;outcome:string|null;created_at:string};
type Site={id:string;company_id:string;name:string};
const fresh=(stamp:string|null)=>!!stamp&&Date.now()-new Date(stamp).getTime()<150000;
const status=(r:Router)=>fresh(r.last_seen_at)?'En ligne':r.last_seen_at?'Hors ligne':'Non appairé';
const fmt=(d:string|null)=>d?new Date(d).toLocaleString('fr-FR'):'—';
const commandStatus:Record<string,string>={
 queued:'Demande enregistrée',dispatched:'Mise à disposition de l’agent — confirmation attendue',
 success:'Application confirmée par le connecteur',failed:'Échec du connecteur',cancelled:'Annulée'
};
export default function NetworkPage(){
 const [companyId,setCompanyId]=useState(''),[role,setRole]=useState(''),[sites,setSites]=useState<Site[]>([]),[siteId,setSiteId]=useState('');
 const [routers,setRouters]=useState<Router[]>([]),[resources,setResources]=useState<RouterResource[]>([]),[devices,setDevices]=useState<Observation[]>([]),[accounts,setAccounts]=useState<Account[]>([]),[orders,setOrders]=useState<Order[]>([]),[commands,setCommands]=useState<Command[]>([]);
 const [name,setName]=useState(''),[host,setHost]=useState(''),[routerId,setRouterId]=useState(''),[username,setUsername]=useState(''),[protocol,setProtocol]=useState('hotspot'),[orderId,setOrderId]=useState('');
 const [pair,setPair]=useState<{token:string;routerId:string;expiresAt:string}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [grace,setGrace]=useState('72'),[extensionLimit,setExtensionLimit]=useState('24'),[filter,setFilter]=useState('all'),[selectedDevice,setSelectedDevice]=useState('');
 const [radiusGateway,setRadiusGateway]=useState<{configured:boolean;enabled:boolean;lastAuthAt:string|null}|null>(null);
 const [radiusToken,setRadiusToken]=useState(''),[radiusAccountId,setRadiusAccountId]=useState(''),[radiusPassword,setRadiusPassword]=useState('');
 const canManage=role==='owner'||role==='admin';
 const chosen=routers.find(r=>r.id===routerId);
 const [adminSource,setAdminSource]=useState('interface');
 const [inventoryPage,setInventoryPage]=useState(1),[inventoryVersion,setInventoryVersion]=useState(0);
 const [adminInventory,setAdminInventory]=useState<Observation[]>([]);
 const [adminCount,setAdminCount]=useState(0),[adminLoading,setAdminLoading]=useState(false),[adminError,setAdminError]=useState('');
 const [adminCoverage,setAdminCoverage]=useState<{reported_count:number;collected_count:number;complete:boolean;observed_at:string}|null>(null);
 const [adminState,setAdminState]=useState('not_collected');
 const routerInventory=adminInventory;
 const routerCommands=commands.filter(c=>c.router_id===routerId);
 const chosenResources=resources.find(r=>r.router_id===routerId);
 const healthy=chosenResources&&fresh(chosenResources.observed_at)&&chosen&&fresh(chosen.last_seen_at);
 const recentlySeenRouters=routers.filter(r=>fresh(r.last_seen_at));
 // This configuration template intentionally contains no pairing token or RouterOS credentials.
 function downloadConnectorConfig(router:Router){
  const rows=[
   '# ZARAY — configuration locale du connecteur MikroTik',
   '# À remplir sur la machine du réseau local, jamais dans GitHub.',
   'ZARAY_URL=https://zaray.vercel.app',
   'ZARAY_ROUTER_ID='+router.id,
   'MIKROTIK_URL=https://'+router.host.trim(),
   'MIKROTIK_USER=REMPLACER_COMPTE_ROUTEROS',
   'MIKROTIK_PASSWORD=REMPLACER_LOCALEMENT',
   'ZARAY_PAIRING_TOKEN=REMPLACER_CODE_TEMPORAIRE',
   '# NODE_EXTRA_CA_CERTS=/chemin/ca-routeros.pem',
   ''
  ];
  const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/plain;charset=utf-8'}));
  const a=document.createElement('a');
  a.href=url;
  a.download='zaray-connecteur-'+router.id+'.env.example';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const visibleDevices=useMemo(()=>devices.filter(d=>filter==='all'||d.observed_kind===filter),[devices,filter]);
 async function refresh(id=companyId){
  if(!id)return;
  try{
   const [network,access]=await Promise.all([fetch('/api/network?companyId='+encodeURIComponent(id),{cache:'no-store'}),fetch('/api/network/access?companyId='+encodeURIComponent(id),{cache:'no-store'})]);
   const n=await network.json(),a=await access.json();
   if(!network.ok||!access.ok)throw Error(n.error||a.error||'Données réseau indisponibles');
   setRouters(n.routers||[]);setDevices(n.observations||[]);setResources(n.resources||[]);setAccounts(a.accounts||[]);setOrders(a.orders||[]);setCommands(a.commands||[]);
   setGrace(String(a.policy.grace_hours));setExtensionLimit(String(a.policy.extension_max_hours));
   setRouterId(v=>(n.routers||[]).some((x:Router)=>x.id===v)?v:(n.routers?.[0]?.id||''));
  }catch(e){setError(e instanceof Error?e.message:'Erreur réseau');}
 }
 useEffect(()=>{(async()=>{try{
  const r=await fetchWorkspaceDirectory();const data=await r.json();if(!r.ok)throw Error(data.error||'Sites indisponibles');
  const query=new URLSearchParams(location.search);
  const id=query.get('companyId')||data.companies?.[0]?.id||'';
  const company=data.companies?.find((c:{id:string})=>c.id===id);
  if(!company)throw Error('Entreprise inaccessible.');
  setCompanyId(id);setRole(company.role);const list=(data.sites||[]).filter((s:Site)=>s.company_id===id);
  const requestedSite=query.get('siteId')||'';
  setSites(list);setSiteId(list.find((s:Site)=>s.id===requestedSite)?.id||list[0]?.id||'');await refresh(id);
 }catch(e){setError(e instanceof Error?e.message:'Erreur de chargement');}})();},[]);
 useEffect(()=>{if(!companyId)return;const handle=setInterval(()=>void refresh(companyId),30000);return()=>clearInterval(handle);},[companyId]);
 useEffect(()=>{
  if(!companyId||!routerId)return;
  const ctl=new AbortController();
  setAdminLoading(true);setAdminError('');setAdminInventory([]);setAdminCoverage(null);
  const params=new URLSearchParams({companyId,routerId,kind:adminSource,page:String(inventoryPage)});
  fetch('/api/network/inventory?'+params.toString(),{cache:'no-store',signal:ctl.signal})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Inventaire indisponible');return d;})
   .then(d=>{if(ctl.signal.aborted)return;
    setAdminInventory(d.items||[]);setAdminCount(d.total||0);
    setAdminCoverage(d.source||null);setAdminState(d.sourceState||'not_collected');})
   .catch(e=>{if(!ctl.signal.aborted){setAdminError(e instanceof Error?e.message:'Lecture impossible');setAdminState('error');}})
   .finally(()=>{if(!ctl.signal.aborted)setAdminLoading(false);});
  return()=>ctl.abort();
 },[companyId,routerId,adminSource,inventoryPage,inventoryVersion]);
 async function disconnectObserved(d:Observation){
  if(!chosen||!canManage||busy||!fresh(chosen.last_seen_at)||!fresh(d.observed_at))return;
  const kind=d.observed_kind==='hotspot'?'Hotspot':'PPPoE';
  const identity=d.client_label||'session inconnue';
  const reason=prompt('Déconnecter '+identity+' ('+kind+') sur '+chosen.name+' ? Motif obligatoire :')?.trim();
  if(!reason)return;
  if(!confirm('Confirmer la déconnexion de cette session uniquement ? La commande sera envoyée au routeur ; le résultat ne sera confirmé qu’après vérification par RouterOS.'))return;
  await run('/api/network/operations',{routerId:chosen.id,observationId:d.id,reason,confirmation:'DECONNECTER'});
  setInventoryVersion(v=>v+1);
 }
 async function run(endpoint:string,payload:Record<string,unknown>,method='POST'){
  setBusy(true);setError('');setNotice('');
  try{const response=await fetch(endpoint,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,companyId})});const data=await response.json();if(!response.ok)throw Error(data.error||'Action impossible');setNotice(data.message||'Action enregistrée.');await refresh();return data;}
  catch(e){setError(e instanceof Error?e.message:'Erreur');return null;}
  finally{setBusy(false);}
 }
 useEffect(()=>{
  if(!companyId||!routerId){setRadiusGateway(null);return;}
  const controller=new AbortController();
  fetch('/api/network/radius/gateway?companyId='+encodeURIComponent(companyId)+'&routerId='+encodeURIComponent(routerId),
   {cache:'no-store',signal:controller.signal})
   .then(async res=>{const data=await res.json();if(!res.ok)throw Error(data.error||'Passerelle indisponible');return data;})
   .then(data=>{if(!controller.signal.aborted)setRadiusGateway(data);})
   .catch(()=>{if(!controller.signal.aborted)setRadiusGateway(null);});
  return()=>controller.abort();
 },[companyId,routerId]);
 async function prepareRadiusGateway(){
  if(!routerId||!canManage||role!=='owner')return;
  if(!confirm('Créer ou renouveler la clé de la passerelle ? Une clé précédente sera révoquée et la passerelle restera désactivée.'))return;
  const result=await run('/api/network/radius/gateway',{routerId});
  if(result?.gatewayToken){setRadiusToken(result.gatewayToken);setRadiusGateway({configured:true,enabled:false,lastAuthAt:null});}
 }
 async function saveRadiusPassword(e:FormEvent){
  e.preventDefault();
  if(!radiusAccountId||!radiusPassword||radiusPassword.length<12)return;
  const result=await run('/api/network/radius/credentials',{accountId:radiusAccountId,password:radiusPassword});
  setRadiusPassword('');
  if(result?.saved)setRadiusAccountId('');
 }
 async function add(e:FormEvent){e.preventDefault();const data=await run('/api/network',{siteId,name,host});if(data){setName('');setHost('');}}
 async function register(e:FormEvent){e.preventDefault();const data=await run('/api/network/access',{routerId,orderId,username,protocol});if(data)setUsername('');}
 async function pairing(r:Router){const data=await run('/api/network/pair',{routerId:r.id});if(data?.pairingToken){setPair({token:data.pairingToken,routerId:r.id,expiresAt:data.expiresAt});}}
 async function prepareNativeAgent(r:Router){
  if(!canManage||busy)return;
  const approved=confirm('Préparer un agent natif sur '+r.name+' ? Cela révoque tout connecteur précédent, désactive les commandes réseau et impose un nouvel appairage.');
  if(!approved)return;
  setError('');setNotice('');
  try{
   const response=await fetch('/network/zaray-routeros-agent.rsc',{cache:'no-store'});
   if(!response.ok)throw new Error('Modèle de l’agent natif indisponible.');
   const template=await response.text();
   if(!template.includes('__ZARAY_ROUTER_ID__')||!template.includes('__ZARAY_PAIRING_TOKEN__'))
    throw new Error('Le modèle du script est incomplet.');
   const data=await run('/api/network/pair',{routerId:r.id});
   if(!data?.pairingToken)return;
   setPair({token:data.pairingToken,routerId:r.id,expiresAt:data.expiresAt});
   const source=template.replaceAll('__ZARAY_ROUTER_ID__',r.id)
    .replaceAll('__ZARAY_PAIRING_TOKEN__',data.pairingToken);
   const url=URL.createObjectURL(new Blob([source],{type:'text/plain;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='zaray-native-'+r.id+'.rsc';
   document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   setNotice('Fichier .rsc généré. Importez-le sur le MikroTik dans les 15 minutes, puis supprimez toute copie du fichier contenant le code.');
  }catch(e){setError(e instanceof Error?e.message:'Préparation native indisponible.');}
 }

 async function control(r:Router){if(!confirm('Changer les autorisations de contrôle sur '+r.name+' ?'))return;await run('/api/network/access',{kind:'control',routerId:r.id,enabled:!r.control_enabled},'PATCH');}
 async function hold(a:Account){if(!confirm('Modifier la suspension administrative du compte '+a.username+' ?'))return;const reason=prompt('Motif de l’intervention :')?.trim();if(!reason)return;await run('/api/network/access',{kind:'hold',accountId:a.id,blocked:!a.administrative_hold,reason},'PATCH');}
 async function extend(a:Account){const hours=Number(prompt('Durée en heures, maximum '+extensionLimit+' :','24'));if(!Number.isInteger(hours)||hours<1)return;const reason=prompt('Motif de la prolongation :')?.trim();if(!reason)return;await run('/api/network/access',{kind:'extend',accountId:a.id,hours,reason},'PATCH');}
 async function deviceAction(d:Observation,blocked:boolean){
  if(!d.mac_address)return;
  const reason=prompt((blocked?'Bloquer':'Débloquer')+' cet appareil Hotspot ? Indiquez le motif :')?.trim();
  if(!reason)return;
  await run('/api/network/device-action',{routerId:d.router_id,mac:d.mac_address,action:blocked?'block':'unblock',reason});
 }
 return <AppShell activePath="/gestion-reseau" title="Gestion réseau">
  <div className="workspace-grid">
   <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Ajouter un MikroTik</h2></div></div>
    <form onSubmit={add} className="form-stack compact-form">
     <label>Site<select value={siteId} onChange={e=>setSiteId(e.target.value)} required>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
     <label>Nom du routeur<input value={name} onChange={e=>setName(e.target.value)} placeholder="MikroTik principal" minLength={2} maxLength={120} required/></label>
     <label>IP ou domaine local<input value={host} onChange={e=>setHost(e.target.value)} placeholder="192.168.88.1" maxLength={255} required/></label>
     
     <button type="submit" className="primary-link" disabled={!canManage||!siteId||busy}><ZarayIcon name="add" size={17}/> {busy?'En cours…':'Enregistrer'}</button>
    </form>
   </section>
   <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Équipements MikroTik</h2><span className="muted">{routers.length} routeur(s)</span></div></div>
    {routers.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Routeur</th><th>Site</th><th>Connexion</th><th>Contrôle</th><th>Actions</th></tr></thead><tbody>{routers.map(r=><tr key={r.id}>
     <td><strong>{r.name}</strong><small>{r.model||r.host} · {r.routeros_version||'RouterOS non détecté'}</small></td><td>{sites.find(s=>s.id===r.site_id)?.name||'—'}</td><td>{status(r)}<small>{fmt(r.last_seen_at)}</small></td>
     <td>{r.control_enabled?'Activé':'Lecture seule'}<small>{r.agent_kind==='routeros-native'?'Agent RouterOS natif':r.agent_kind==='node-local'?'Connecteur Node.js':'Type non confirmé'}</small></td><td><button type="button" onClick={()=>downloadConnectorConfig(r)} title="Télécharger un modèle sans aucun secret">Préparer le connecteur</button> <button type="button" disabled={!canManage||busy} onClick={()=>void prepareNativeAgent(r)} title="Télécharger le programme natif RouterOS, sans ordinateur intermédiaire">Agent natif (.rsc)</button> <button type="button" disabled={!canManage||busy} onClick={()=>void pairing(r)}>Associer</button> <button type="button" disabled={role!=='owner'||busy} onClick={()=>void control(r)}>{r.control_enabled?'Désactiver':'Activer le contrôle'}</button></td>
    </tr>)}</tbody></table></div>:<div className="empty-state"><strong>Aucun MikroTik</strong><p>Enregistrez un équipement pour commencer.</p></div>}
   </section>
  </div>
  {pair&&<section className="panel" aria-live="polite"><h2 className="panel-title">Code d’association à usage unique</h2><p>Valable jusqu’au {fmt(pair.expiresAt)}. Ce code n’est affiché qu’une fois.</p><p><code style={{overflowWrap:'anywhere'}}>{pair.token}</code></p><p className="muted">Routeur : <code>{pair.routerId}</code>. Installez le connecteur Node.js du projet sur une machine du réseau local, avec les variables ZARAY_ROUTER_ID, ZARAY_PAIRING_TOKEN, MIKROTIK_URL, MIKROTIK_USER et MIKROTIK_PASSWORD. Utilisez un certificat RouterOS vérifiable. </p><button type="button" onClick={()=>void navigator.clipboard.writeText(pair.token)}>Copier le code</button> <button type="button" onClick={()=>setPair(null)}>Masquer</button></section>}
  <details className="workspace-disclosure"><summary>RADIUS · authentification centrale</summary>
   <section className="panel">
    <div className="panel-head"><h2 className="panel-title">Préparer le service RADIUS</h2></div>
    <p className="muted">Cette section prépare les identifiants pour un futur service FreeRADIUS. La passerelle reste désactivée tant qu’un serveur privé n’a pas été installé et vérifié.</p>
    <div className="form-stack compact-form">
     <label>Routeur cible<select value={routerId} onChange={e=>{setRadiusToken('');setRadiusAccountId('');setRadiusPassword('');setRouterId(e.target.value);}}>{routers.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
     <p className="muted">Passerelle : {radiusGateway?(radiusGateway.configured?(radiusGateway.enabled?'Activée':'Préparée · désactivée'):'Non préparée'):'État non disponible'}</p>
     <button type="button" disabled={!routerId||role!=='owner'||busy} onClick={()=>void prepareRadiusGateway()}>Créer / renouveler la clé de passerelle</button>
    </div>
    {radiusToken&&<div className="panel" aria-live="polite"><strong>Clé RADIUS temporairement affichée</strong><p className="muted">Enregistrez-la exclusivement sur le serveur privé FreeRADIUS. Elle ne sera pas affichée à nouveau.</p><code style={{overflowWrap:'anywhere'}}>{radiusToken}</code><div><button type="button" onClick={()=>void navigator.clipboard.writeText(radiusToken)}>Copier la clé</button> <button type="button" onClick={()=>setRadiusToken('')}>Masquer</button></div></div>}
    <form className="form-stack compact-form" onSubmit={saveRadiusPassword}>
     <label>Compte réseau résidentiel<select required value={radiusAccountId} onChange={e=>setRadiusAccountId(e.target.value)}><option value="">Choisir un compte</option>{accounts.filter(a=>a.router_id===routerId).map(a=><option key={a.id} value={a.id}>{a.username} · {a.protocol.toUpperCase()}</option>)}</select></label>
     <label>Nouveau mot de passe RADIUS<input type="password" value={radiusPassword} minLength={12} maxLength={128} autoComplete="new-password" onChange={e=>setRadiusPassword(e.target.value)} placeholder="12 caractères minimum"/></label>
     <button type="submit" disabled={!canManage||busy||!radiusAccountId||radiusPassword.length<12}>Enregistrer le secret du compte</button>
     <p className="muted">Le mot de passe n’est jamais réaffiché. Ce formulaire ne crée pas d’accès Internet. Les tickets occasionnels restent gérés par le connecteur Hotspot existant.</p>
    </form>
   </section>
  </details>
  <details className="workspace-disclosure"><summary>Agent natif MikroTik · sans VPS</summary>
   <section className="panel">
    <h2 className="panel-title">Moteur natif ZARAY</h2>
    <p className="muted">Pour un routeur RouterOS 7 compatible, le script natif synchronise les interfaces et sessions puis traite uniquement les commandes autorisées : suspension, reprise, déconnexion et tickets Hotspot. Aucun ordinateur Node.js ou serveur RADIUS n’est requis pour ce mode.</p>
    <p className="muted">Sur la ligne du routeur, choisissez « Agent natif (.rsc) ». Importez le fichier dans <strong>WinBox → Files</strong>, puis exécutez <code>/import file-name=zaray-native-IDENTIFIANT.rsc</code> dans le terminal du MikroTik. Le routeur doit pouvoir accéder à ZARAY en HTTPS avec validation du certificat. Supprimez le fichier d’import après appairage : il contient un code temporaire.</p>
    <p className="muted">L’installation ne se fait pas depuis Vercel : elle exige une seule intervention initiale sur le routeur. Les commandes restent en lecture seule tant que le propriétaire n’active pas explicitement le contrôle dans ZARAY. Ne faites pas tourner l’agent natif et le connecteur Node.js simultanément sur un même routeur.</p>
    <p className="muted"><a href="https://github.com/martinot-svg/ZARAY/tree/main/network-connector/routeros" target="_blank" rel="noopener noreferrer">Documentation et limites du moteur natif</a></p>
   </section>
  </details>
  <details className="workspace-disclosure"><summary>Administration MikroTik</summary>
   <section className="panel">
    <div className="panel-head"><div><h2 className="panel-title">Administration MikroTik</h2><span className="muted">Diagnostics RouterOS en lecture seule</span></div></div>
    <p className="muted">Ce tableau de bord reprend certaines fonctions de supervision de WinBox, sans lancer d'exécutable Windows ni ouvrir l'administration du routeur sur Internet. Les données sont remontées par le connecteur privé ZARAY.</p>
    <div className="form-stack compact-form">
     <label>Routeur<select value={routerId} onChange={e=>setRouterId(e.target.value)}>{routers.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></label>
    </div>
    {chosen?<div className="workspace-grid">
      <div className="panel" style={{padding:16}}>
       <h3>{chosen.name}</h3>
       <p className="muted">Modèle : {chosen.model||'Non détecté'}</p>
       <p className="muted">RouterOS : {chosen.routeros_version||'Non détecté'}</p>
       <p>Connecteur : <strong>{status(chosen)}</strong></p>
       <p className="muted">Dernière connexion : {fmt(chosen.last_seen_at)}</p>
       <button type="button" onClick={()=>void navigator.clipboard.writeText(chosen.host)}>Copier l'adresse du routeur</button>
      </div>
      <div className="panel" style={{padding:16}}>
       <h3>Ressources système</h3>
       {healthy&&chosenResources?<div>
        <p>CPU : <strong>{chosenResources.cpu_load_percent} %</strong></p>
        <p>Mémoire : <strong>{(chosenResources.free_memory_bytes/1048576).toFixed(1)} Mo libres sur {(chosenResources.total_memory_bytes/1048576).toFixed(1)} Mo</strong></p>
        <p>Uptime : <strong>{chosenResources.router_uptime}</strong></p>
        <p className="muted">Observé : {fmt(chosenResources.observed_at)}</p>
       </div>:<p className="muted">Ressources non disponibles ou données trop anciennes. Un connecteur MikroTik actif est nécessaire.</p>}
      </div>
      <div className="panel" style={{padding:16}}>
       <h3>Activité du routeur</h3>
       <p>Interfaces : <strong>{devices.filter(d=>d.router_id===routerId&&d.observed_kind==='interface').length}</strong></p>
       <p>Interfaces en fonctionnement : <strong>{devices.filter(d=>d.router_id===routerId&&d.observed_kind==='interface'&&d.active&&fresh(d.observed_at)).length}</strong></p>
       <p>Sessions Hotspot : <strong>{devices.filter(d=>d.router_id===routerId&&d.observed_kind==='hotspot'&&d.active&&fresh(d.observed_at)).length}</strong></p>
       <p>Sessions PPPoE : <strong>{devices.filter(d=>d.router_id===routerId&&d.observed_kind==='pppoe'&&d.active&&fresh(d.observed_at)).length}</strong></p>
       <p className="muted">Les nombres représentent uniquement les dernières observations reçues, pas un contrôle d'accès Internet.</p>
      </div>
     </div>:<div className="empty-state"><strong>Aucun routeur sélectionné</strong><p>Ajoutez puis associez un MikroTik pour afficher ses diagnostics.</p></div>}
    {chosen&&<>
     <div className="panel" style={{padding:16}}>
      <h3>Inventaire du routeur sélectionné</h3>
      <p className="muted">Site : {sites.find(s=>s.id===chosen.site_id)?.name||'Non disponible'} · Agent : {chosen.agent_kind==='routeros-native'?'RouterOS natif':chosen.agent_kind==='node-local'?'Connecteur local':'Non identifié'} · Contrôle : {chosen.control_enabled?'activé':'désactivé'}</p>
      <label>Source d’inventaire<select value={adminSource} onChange={e=>{setAdminSource(e.target.value);setInventoryPage(1);}}>
       <optgroup label="Vue générale et interfaces"><option value="interface">Interfaces</option><option value="wifi">Stations Wi-Fi</option><option value="neighbor">Voisins</option><option value="radius">Serveurs RADIUS déclarés</option></optgroup>
       <optgroup label="Hotspot et PPPoE"><option value="hotspot">Sessions Hotspot</option><option value="hotspot-user">Comptes Hotspot</option><option value="hotspot-profile">Profils Hotspot</option><option value="pppoe">Sessions PPPoE</option><option value="ppp-secret">Comptes PPP</option><option value="ppp-profile">Profils PPP</option></optgroup>
       <optgroup label="IP et DHCP"><option value="ip-address">Adresses IP</option><option value="ip-pool">Pools IP</option><option value="dhcp-server">Serveurs DHCP</option><option value="dhcp">Baux DHCP</option></optgroup>
       <optgroup label="Débits et sécurité"><option value="queue">Files d’attente</option><option value="firewall-filter">Règles pare-feu</option><option value="firewall-nat">Règles NAT</option><option value="route">Routes IP</option></optgroup>
      </select></label>
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
       <p className="muted" role="status">{adminLoading?'Chargement des observations…':adminState==='migration_required'?'Migration des inventaires non appliquée.':adminState==='requires_local_connector'?'Source avancée réservée au connecteur local HTTPS.':adminState==='stale'?'Inventaire ancien : aucune donnée considérée comme actuelle.':adminState==='partial'?'Inventaire partiel : limite de collecte atteinte.':adminState==='complete'?'Source lue par le connecteur (instantané, pas une mesure en direct).':adminState==='error'?'Lecture impossible.':'Source non encore collectée ou non compatible avec ce routeur.'}</p>
       <button type="button" disabled={adminLoading} onClick={()=>setInventoryVersion(v=>v+1)}>Actualiser l’affichage</button>
      </div>
      {adminCoverage&&<p className="muted">Collectés : {adminCoverage.collected_count} / {adminCoverage.reported_count} éléments observés sur cette source · dernier relevé : {fmt(adminCoverage.observed_at)} · {adminCoverage.complete?'Collecte déclarée complète':'Collecte tronquée'}</p>}
      {adminError&&<p role="alert" className="muted">{adminError}</p>}
      {routerInventory.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Nom</th><th>Adresse IP</th><th>Adresse MAC</th><th>État observé</th><th>Dernière observation</th><th>Intervention</th></tr></thead><tbody>
       {routerInventory.map(d=><tr key={d.id}><td>{d.client_label||d.identity_key}</td><td>{d.ip_address||'—'}</td><td>{d.mac_address||'—'}</td><td>{fresh(d.observed_at)&&fresh(chosen.last_seen_at)?(d.active?'Actif':'Inactif'):'Non vérifié récemment'}</td><td>{fmt(d.observed_at)}</td><td>{(d.observed_kind==='hotspot'||d.observed_kind==='pppoe')&&canManage&&chosen.control_enabled&&d.active&&fresh(d.observed_at)&&fresh(chosen.last_seen_at)?
        <button type="button" disabled={busy} onClick={()=>void disconnectObserved(d)}>Déconnecter</button>:
        <span className="muted">{d.observed_kind==='hotspot'||d.observed_kind==='pppoe'?'Non disponible':'Lecture seule'}</span>}</td></tr>)}
      </tbody></table></div>:<p className="muted">Aucune observation vérifiable pour cette source sur ce routeur.</p>}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:8}}>
       <span className="muted">{adminCount} lignes mémorisées (incluant l’historique) · page {inventoryPage}</span>
       <button type="button" disabled={adminLoading||inventoryPage<=1} onClick={()=>setInventoryPage(p=>p-1)}>Précédent</button>
       <button type="button" disabled={adminLoading||inventoryPage*50>=adminCount} onClick={()=>setInventoryPage(p=>p+1)}>Suivant</button>
      </div>
     </div>
     <div className="panel" style={{padding:16}}>
      <h3>Commandes du routeur sélectionné</h3>
      <p className="muted">Extrait des 50 dernières commandes de l’entreprise. Une commande demandée ou envoyée reste en attente de confirmation du routeur.</p>
      {routerCommands.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Heure</th><th>Action</th><th>Compte</th><th>Statut</th><th>Retour du routeur</th></tr></thead><tbody>
       {routerCommands.map(c=><tr key={c.id}><td>{fmt(c.created_at)}</td><td>{c.action}</td><td>{c.username}</td><td>{commandStatus[c.status]||'État inconnu'}</td><td>{c.outcome||'—'}</td></tr>)}
      </tbody></table></div>:<p className="muted">Aucune commande pour ce routeur dans cet extrait.</p>}
     </div>
     <p className="muted">Les inventaires pare-feu, NAT, routage, DHCP et files d’attente sont disponibles uniquement en lecture avec le connecteur local si RouterOS prend en charge leurs API. Le moteur natif conserve ses sources limitées. Les modifications de pare-feu, NAT, routes, DHCP, le terminal libre et les journaux sensibles restent désactivés jusqu’à validation sur routeur de test et retour arrière local sûr.</p>
    </>}
    <div className="panel" style={{padding:16}}>
     <h3>WinBox officiel — application locale</h3>
     <p className="muted">L'archive Windows fournie correspond à WinBox v4.5. Pour ouvrir l'application, téléchargez-la sur votre ordinateur Windows, extrayez WinBox.exe et connectez-vous à l'adresse du routeur depuis un réseau autorisé.</p>
     <a className="primary-link" href="https://download.mikrotik.com/routeros/winbox/4.5/WinBox_Windows.zip" target="_blank" rel="noopener noreferrer">Télécharger WinBox 4.5 pour Windows</a>
     <p className="muted"><a href="https://mikrotik.com/download/winbox" target="_blank" rel="noopener noreferrer">WinBox officiel pour Linux, macOS et autres versions</a></p>
    </div>
   </section>
  </details>
  <details className="workspace-disclosure"><summary>Cartographie</summary><section className="panel"><div className="panel-head"><div><h2 className="panel-title">Cartographie du réseau</h2></div></div>
   
   <div className="workspace-grid">{sites.map(s=><div className="panel" key={s.id} style={{padding:16}}>
    <h3>◈ {s.name}</h3>{routers.filter(r=>r.site_id===s.id).map(r=><div key={r.id} style={{margin:'12px 0',padding:12,border:'1px solid var(--border, rgba(120,150,200,.25))',borderRadius:12}}>
      <strong>↳ {r.name}</strong> <small>{status(r)}</small>
      <div className="muted">{devices.filter(d=>d.router_id===r.id).length} observations : {devices.filter(d=>d.router_id===r.id&&d.active&&fresh(d.observed_at)).length} actives</div>
      <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:8}}>{devices.filter(d=>d.router_id===r.id).slice(0,18).map(d=><span key={d.id} className="muted" style={{border:'1px solid currentColor',borderRadius:20,padding:'4px 8px'}}>{d.observed_kind==='wifi'?'⌁':'•'} {d.client_label||d.identity_key}</span>)}</div>
    </div>)}{!routers.some(r=>r.site_id===s.id)&&<p className="muted">Aucun routeur associé.</p>}
   </div>)}</div>
  </section></details>
  <details className="workspace-disclosure"><summary>MikroTik · interfaces réseau</summary>
   <section className="panel"><div className="panel-head"><h2 className="panel-title">Interfaces RouterOS</h2></div>
    <p className="muted">Supervision en lecture seule des interfaces détectées par le connecteur. « En fonctionnement » désigne le signal RouterOS « running » ; ce n’est pas une mesure du débit ou de la disponibilité Internet.</p>
    {devices.some(d=>d.observed_kind==='interface')?<div className="table-wrap"><table className="data-table"><thead><tr><th>Routeur</th><th>Interface et type</th><th>Adresse MAC</th><th>État</th></tr></thead><tbody>
    {devices.filter(d=>d.observed_kind==='interface').map(d=><tr key={d.id}><td>{routers.find(r=>r.id===d.router_id)?.name||'Routeur inconnu'}</td><td>{d.client_label||d.identity_key}</td><td>{d.mac_address||'—'}</td><td>{fresh(d.observed_at)&&routers.some(r=>r.id===d.router_id&&fresh(r.last_seen_at))?(d.active?'En fonctionnement':'Non actif'):'Non vérifié récemment'}</td></tr>)}
    </tbody></table></div>:<div className="empty-state"><strong>Aucune interface découverte</strong><p>Les interfaces apparaissent après appairage et synchronisation d’un routeur compatible.</p></div>}
   </section>
  </details>
  <details className="workspace-disclosure"><summary>RADIUS · configuration des routeurs</summary>
   <section className="panel">
    <div className="panel-head"><h2 className="panel-title">Serveurs RADIUS déclarés sur MikroTik</h2></div>
    <p className="muted">Inventaire en lecture seule obtenu par le connecteur local. « Activé » indique uniquement que le serveur n’est pas désactivé dans RouterOS : cela ne confirme ni sa joignabilité, ni l’authentification des clients. Les secrets partagés ne sont jamais récupérés.</p>
    {devices.filter(d=>d.observed_kind==='radius').length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Routeur</th><th>Serveur et service</th><th>État déclaré</th><th>Dernière observation</th></tr></thead><tbody>
     {devices.filter(d=>d.observed_kind==='radius').map(d=><tr key={d.id}>
      <td>{routers.find(r=>r.id===d.router_id)?.name||'Routeur inconnu'}</td>
      <td>{d.client_label||d.identity_key}</td>
      <td>{fresh(d.observed_at)&&routers.some(r=>r.id===d.router_id&&fresh(r.last_seen_at))?(d.active?'Activé dans RouterOS':'Désactivé dans RouterOS'):'Non vérifié récemment'}</td>
      <td>{fmt(d.observed_at)}</td>
     </tr>)}
    </tbody></table></div>:<div className="empty-state"><strong>Aucun serveur RADIUS observé</strong><p>Connectez le routeur et autorisez la lecture de la configuration RADIUS dans RouterOS. Aucun serveur RADIUS n’est automatiquement créé.</p></div>}
   </section>
  </details>
  <details className="workspace-disclosure"><summary>Sessions et appareils</summary><section className="panel"><div className="panel-head"><div><h2 className="panel-title">Appareils et sessions détectés</h2></div><label>Source <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Toutes</option>{['hotspot','pppoe','dhcp','wifi','neighbor','radius','interface'].map(x=><option key={x} value={x}>{x.toUpperCase()}</option>)}</select></label></div>
   {visibleDevices.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Appareil / Utilisateur</th><th>Source</th><th>Adresse IP</th><th>État</th><th>Intervention</th></tr></thead><tbody>{visibleDevices.map(d=><tr key={d.id}><td><strong>{d.client_label||d.identity_key}</strong><small>{d.mac_address||'MAC inconnue'}</small></td><td>{d.observed_kind}</td><td>{d.ip_address||'—'}</td><td>{d.active&&fresh(d.observed_at)&&routers.some(r=>r.id===d.router_id&&fresh(r.last_seen_at))?'Session active':'Historique / état inconnu'}</td><td>{d.observed_kind==='hotspot'&&d.mac_address&&canManage?<button type="button" disabled={busy} onClick={()=>void deviceAction(d,true)}>Bloquer</button>:<span className="muted">Consultation</span>}</td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Aucune découverte</strong><p>Les équipements apparaîtront après l’appairage et la première synchronisation.</p></div>}
  </section></details>
  <div className="workspace-grid"><details className="workspace-disclosure"><summary>Associer un abonnement</summary><section className="panel"><h2 className="panel-title">Associer un abonnement au réseau</h2>
   <form className="form-stack compact-form" onSubmit={register}>
    <label>Routeur<select value={routerId} onChange={e=>setRouterId(e.target.value)} required>{routers.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></label>
    <label>Commande<select value={orderId} onChange={e=>setOrderId(e.target.value)} required><option value="">Choisir une commande</option>{orders.filter(o=>chosen&&o.site_id===chosen.site_id&&!accounts.some(a=>a.order_id===o.id)).map(o=><option key={o.id} value={o.id}>{o.customer_name} · {o.public_reference} · {o.status}</option>)}</select></label>
    <label>Protocole<select value={protocol} onChange={e=>setProtocol(e.target.value)}><option value="hotspot">Hotspot</option><option value="pppoe">PPPoE</option></select></label>
    <label>Identifiant du compte RouterOS existant<input value={username} onChange={e=>setUsername(e.target.value)} maxLength={128} required placeholder="client-001"/></label>
    <p className="muted">Le compte doit exister sur RouterOS. Aucun identifiant de ticket imprimé n’est provisionné automatiquement.</p>
    <button type="submit" disabled={!canManage||!routerId||!orderId||busy}>Associer le compte</button>
   </form>
  </section></details>
  <details className="workspace-disclosure"><summary>Règles des impayés</summary><section className="panel"><h2 className="panel-title">Règles des impayés</h2><p className="muted">Définies par le dirigeant ; les justificatifs non approuvés ne déclenchent jamais un renouvellement.</p>
   <div className="form-stack compact-form"><label>Délai de grâce (heures)<input type="number" min="0" max="2160" value={grace} onChange={e=>setGrace(e.target.value)}/></label>
   <label>Prolongation exceptionnelle maximale (heures)<input type="number" min="1" max="87600" value={extensionLimit} onChange={e=>setExtensionLimit(e.target.value)}/></label>
   <button type="button" disabled={role!=='owner'||busy} onClick={()=>void run('/api/network/access',{kind:'policy',graceHours:Number(grace),extensionMaxHours:Number(extensionLimit)},'PATCH')}>Enregistrer les règles</button></div>
  </section></details></div>
  <details className="workspace-disclosure"><summary>Comptes et suspensions</summary><section className="panel"><div className="panel-head"><h2 className="panel-title">Comptes et suspensions</h2><span className="muted">{accounts.length} comptes</span></div>
   {accounts.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Compte</th><th>Expiration / grâce</th><th>Décision</th><th>Appliqué sur MikroTik</th><th>Actions</th></tr></thead><tbody>{accounts.map(a=><tr key={a.id}><td><strong>{a.username}</strong><small>{a.protocol.toUpperCase()}{a.administrative_hold?' · Suspension administrative':''}</small></td><td>{fmt(a.expires_at)}<small>Grâce : {fmt(a.grace_until)} · Exception : {fmt(a.extension_until)}</small></td><td>{a.desired_state}</td><td>{a.applied_state}</td><td><button type="button" disabled={!canManage||busy} onClick={()=>void hold(a)}>{a.administrative_hold?'Lever le blocage':'Suspendre'}</button> <button type="button" disabled={!canManage||busy} onClick={()=>void extend(a)}>Prolonger</button></td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Aucun compte associé</strong><p>Associez une commande à un utilisateur Hotspot ou PPPoE.</p></div>}
  </section></details>
  <details className="workspace-disclosure"><summary>Historique des commandes</summary><section className="panel"><h2 className="panel-title">Historique des commandes réseau</h2>{commands.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Heure</th><th>Action</th><th>Compte</th><th>Statut</th><th>Retour</th></tr></thead><tbody>{commands.map(c=><tr key={c.id}><td>{fmt(c.created_at)}</td><td>{c.action}</td><td>{c.username}</td><td>{commandStatus[c.status]||'État inconnu'}</td><td>{c.outcome||'—'}</td></tr>)}</tbody></table></div>:<p className="muted">Aucune commande pour cette entreprise.</p>}</section></details>
  {(error||notice)&&<section className="panel" role={error?'alert':'status'}>{error||notice}</section>}
 </AppShell>;
}
