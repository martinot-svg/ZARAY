'use client';

import { useEffect, useState, type FormEvent } from 'react';

type Company = { id: string; legal_name: string; role: string };
type Member = { user_id: string; email: string; role: string; status: string; created_at: string };
type AuditEvent = { id: number; event: string; actor_email: string | null; metadata: Record<string, unknown>; created_at: string };
const roleLabels: Record<string, string> = { owner: 'Propriétaire', admin: 'Administrateur', site_manager: 'Responsable de site', support: 'Support', technician: 'Technicien', sales: 'Commercial', finance: 'Finance' };
const roles = [{value:'admin',label:'Administrateur'},{value:'site_manager',label:'Responsable de site'},{value:'support',label:'Support'},{value:'technician',label:'Technicien'},{value:'sales',label:'Commercial'},{value:'finance',label:'Finance'}];
const dateLabel = (value: string) => new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

export default function MembresPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [currentRole, setCurrentRole] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('support');
  const [changes, setChanges] = useState<Record<string, {role:string;status:string}>>({});
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function loadCompany(id: string) {
    if (!id) return;
    const [memberResponse, auditResponse] = await Promise.all([
      fetch('/api/company-members?companyId=' + encodeURIComponent(id), { cache: 'no-store' }),
      fetch('/api/audit-logs?companyId=' + encodeURIComponent(id), { cache: 'no-store' }),
    ]);
    const memberData = await memberResponse.json();
    const auditData = await auditResponse.json();
    if (!memberResponse.ok) throw new Error(memberData.error || 'Impossible de charger les membres.');
    setMembers(memberData.members ?? []);
    setCurrentRole(memberData.current_role ?? '');
    setChanges(Object.fromEntries((memberData.members ?? []).map((m: Member) => [m.user_id, { role: m.role, status: m.status }])));
    if (auditResponse.ok) setEvents(auditData.events ?? []);
    else setEvents([]);
  }
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/sites', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Impossible de charger les entreprises.');
        if (!active) return;
        setCompanies(data.companies ?? []);
        if (data.companies?.[0]) setCompanyId(data.companies[0].id);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!companyId) return;
    let active = true;
    setBusy(true); setError('');
    (async () => {
      try {
        const [mr, ar] = await Promise.all([
          fetch('/api/company-members?companyId=' + encodeURIComponent(companyId), {cache:'no-store'}),
          fetch('/api/audit-logs?companyId=' + encodeURIComponent(companyId), {cache:'no-store'}),
        ]);
        const md = await mr.json(); const ad = await ar.json();
        if (!mr.ok) throw new Error(md.error || 'Impossible de charger les membres.');
        if (!active) return;
        setMembers(md.members ?? []); setCurrentRole(md.current_role ?? '');
        setChanges(Object.fromEntries((md.members ?? []).map((m: Member) => [m.user_id, {role:m.role,status:m.status}])));
        setEvents(ar.ok ? (ad.events ?? []) : []);
        setNotice(ar.ok ? '' : (ad.error ?? 'Journal réservé aux rôles propriétaire, administrateur et finance.'));
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [companyId]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(''); setError('');
    try {
      const response = await fetch('/api/company-members', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId,email,role})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Invitation impossible.');
      setEmail(''); setNotice('Invitation créée pour ' + data.invitation.email + '. La personne doit créer/confirmer son compte avec cette adresse puis accepter l’invitation dans « Mes invitations ». Aucun e-mail automatique n’est envoyé pour le moment.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Invitation impossible.'); }
  }
  async function save(member: Member) {
    const value = changes[member.user_id];
    setNotice(''); setError('');
    try {
      const response = await fetch('/api/company-members', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId,userId:member.user_id,role:value.role,status:value.status})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Modification impossible.');
      setNotice('Rôle et statut mis à jour.'); await loadCompany(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Modification impossible.'); }
  }
  const canManage = currentRole === 'owner' || currentRole === 'admin';

  return <main className="form-shell"><section className="form-card" style={{maxWidth:1000,width:'min(100%,1000px)'}}>
    <p className="eyebrow">ZARAY · MODULE 4</p><h1>Membres, rôles et audit</h1>
    <p>Les autorisations sont contrôlées par l’API et Supabase. Les invitations sont limitées à l’entreprise sélectionnée.</p>
    {companies.length > 0 && <label>Entreprise<select value={companyId} onChange={e=>setCompanyId(e.target.value)}>{companies.map(c=><option key={c.id} value={c.id}>{c.legal_name} · {roleLabels[c.role] ?? c.role}</option>)}</select></label>}
    {companies.length===0 && !busy && <p>Aucune entreprise accessible.</p>}
    {canManage && <><h2 style={{marginTop:28}}>Inviter un membre</h2>
      <form className="form-stack" onSubmit={invite}>
        <label>E-mail de la personne<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="collegue@exemple.com"/></label>
        <label>Rôle<select value={role} onChange={e=>setRole(e.target.value)}>{roles.filter(r=>currentRole==='owner'||!['admin','finance'].includes(r.value)).map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
        <button className="primary-link" type="submit" disabled={busy||!companyId}>Créer l’invitation</button>
      </form>
    </>}
    <h2 style={{marginTop:32}}>Membres de l’entreprise</h2>
    {busy ? <p>Chargement…</p> : members.length ? <div className="module-grid">{members.map(member=><article className="module" key={member.user_id}>
      <span className="module-number">{roleLabels[member.role] ?? member.role}</span><h3>{member.email}</h3><p>Ajouté le {dateLabel(member.created_at)}</p><span className="module-status">{member.status==='active'?'Actif':member.status}</span>
      {canManage && member.role!=='owner' && <div className="form-stack" style={{marginTop:14}}>
        <label>Rôle<select value={changes[member.user_id]?.role ?? member.role} disabled={member.user_id===members.find(m=>m.role===currentRole&&m.role==='owner')?.user_id} onChange={e=>setChanges(old=>({...old,[member.user_id]:{...old[member.user_id],role:e.target.value}}))}>{[{value:'owner',label:'Propriétaire'},...roles].filter(r=>r.value!=='owner'&&(currentRole==='owner'||!['admin','finance'].includes(r.value))).map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
        <label>Statut<select value={changes[member.user_id]?.status ?? member.status} onChange={e=>setChanges(old=>({...old,[member.user_id]:{...old[member.user_id],status:e.target.value}}))}><option value="active">Actif</option><option value="suspended">Suspendu</option></select></label>
        <button type="button" onClick={()=>void save(member)} disabled={busy}>Enregistrer</button>
      </div>}
    </article>)}</div> : <p>Aucun membre à afficher.</p>}
    <h2 style={{marginTop:36}}>Journal d’audit</h2>
    {events.length ? <div className="module-grid">{events.map(event=><article className="module" key={event.id}><span className="module-number">{event.event}</span><h3>{event.actor_email ?? 'Système'}</h3><p>{dateLabel(event.created_at)}</p><p>{JSON.stringify(event.metadata)}</p></article>)}</div> : <p>Journal non disponible pour votre rôle ou aucun événement enregistré.</p>}
    {notice && <p role="status" aria-live="polite">{notice}</p>}{error && <p role="alert">{error}</p>}
    <p style={{marginTop:28}}><a href="/invitations">Mes invitations →</a> · <a href="/tableau-de-bord">Tableau de bord</a> · <a href="/sites">Sites</a></p>
  </section></main>;
}
