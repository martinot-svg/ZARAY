'use client';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import BrandLogo from '@/components/brand-logo';

import { useEffect, useState } from 'react';
type Invitation = { id: string; company_id: string; company_name: string; role: string; created_at: string; expires_at: string };
const labels: Record<string,string> = { admin:'Administrateur',site_manager:'Responsable de site',support:'Support',technician:'Technicien',sales:'Commercial',finance:'Finance' };
export default function InvitationsPage() {
  const [invitations,setInvitations] = useState<Invitation[]>([]);
  const [busy,setBusy] = useState(true);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  async function load() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/company-invitations',{cache:'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de charger les invitations.');
      setInvitations(data.invitations ?? []);
    } catch(e) { setError(e instanceof Error ? e.message : 'Erreur de chargement.'); }
    finally { setBusy(false); }
  }
  useEffect(()=>{ void load(); },[]);
  async function accept(id:string) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/company-invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invitationId:id})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible d’accepter l’invitation.');
      setNotice('Vous avez rejoint ' + data.membership.company_name + '. Rôle : ' + (labels[data.membership.role] ?? data.membership.role) + '.');
      await load();
    } catch(e) { setError(e instanceof Error ? e.message : 'Erreur.'); setBusy(false); }
  }
  return <main className="form-shell"><section className="form-card" style={{maxWidth:900,width:'min(100%,900px)'}}>
      <div className="workspace-brand"><a href="/" aria-label="ZARAY · Accueil"><BrandLogo /></a></div>
    <p className="eyebrow">ZARAY · ESPACE ÉQUIPE</p><h1>Mes invitations</h1>
    <p>Les invitations sont associées à votre adresse e-mail vérifiée. Connectez-vous avec l’adresse exacte qui a reçu l’invitation.</p>
    {busy ? null : invitations.length ? <div className="module-grid">{invitations.map(inv=><article className="module" key={inv.id}>
      <span className="module-number">INVITATION</span><h2>{inv.company_name}</h2><p>Rôle proposé : {labels[inv.role] ?? inv.role}</p><p>Expire le {new Date(inv.expires_at).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'})}</p>
      <button className="primary-link" type="button" disabled={busy} onClick={()=>void accept(inv.id)}><ZarayIcon name="confirm" size={18} /> Accepter l’invitation</button>
    </article>)}</div> : <p>Aucune invitation en attente pour cette adresse.</p>}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    <p style={{marginTop:28}}><a href="/membres"><ZarayIcon name="login" size={18} /> Gestion des membres</a> · <a href="/tableau-de-bord"><ZarayIcon name="login" size={18} /> Tableau de bord</a> · <a href="/connexion"><ZarayIcon name="login" size={18} /> Connexion</a></p>
  </section></main>;
}
