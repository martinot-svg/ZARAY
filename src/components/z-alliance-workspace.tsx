'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import type { PersonalCompany } from '@/lib/personal-context';

type Member = { user_id: string; email: string; role: string; status: string; created_at: string };
type AuditEvent = {
  id: number; event: string; actor_email: string | null;
  metadata: { invitation_id?: string; email?: string; role?: string };
  created_at: string;
};

const roles = [
  { value: 'admin', label: 'Administrateur', description: 'Administration de l’entreprise et gestion des accès.' },
  { value: 'site_manager', label: 'Responsable de site', description: 'Opérations et organisation des sites autorisés.' },
  { value: 'support', label: 'Support', description: 'Assistance et suivi des activités autorisées.' },
  { value: 'technician', label: 'Technicien', description: 'Opérations techniques autorisées.' },
  { value: 'sales', label: 'Commercial', description: 'Activités commerciales autorisées.' },
  { value: 'finance', label: 'Finance', description: 'Accès aux opérations financières autorisées.' },
] as const;
const names: Record<string, string> = {
  owner: 'Propriétaire', admin: 'Administrateur', site_manager: 'Responsable de site',
  support: 'Support', technician: 'Technicien', sales: 'Commercial', finance: 'Finance',
};
const emailValid = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const displayDate = (date: string) => new Date(date).toLocaleDateString('fr-FR', { dateStyle: 'medium' });
const manageable = (role: string) => role === 'owner' || role === 'admin';

export default function ZAllianceWorkspace({ companies, actorEmail, contextError }: {
  companies: PersonalCompany[];
  actorEmail: string | null;
  contextError: string | null;
}) {
  const authorized = companies.filter(company => manageable(company.role));
  const [companyId, setCompanyId] = useState(authorized[0]?.id ?? '');
  const company = authorized.find(item => item.id === companyId);
  const allowedRoles = roles.filter(role => company?.role === 'owner' || (role.value !== 'admin' && role.value !== 'finance'));
  const [role, setRole] = useState('support');
  const [email, setEmail] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(contextError ?? '');
  const [auditNotice, setAuditNotice] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    async function load() {
      setLoading(true); setError(''); setAuditNotice('');
      setMembers([]); setEvents([]);
      try {
        const [memberResult, auditResult] = await Promise.all([
          fetch('/api/company-members?companyId=' + encodeURIComponent(companyId), { cache: 'no-store' }),
          fetch('/api/audit-logs?companyId=' + encodeURIComponent(companyId), { cache: 'no-store' })
        ]);
        const membersData = await memberResult.json();
        if (!memberResult.ok) throw new Error(membersData.error || 'Impossible de consulter les membres.');
        if (cancelled) return;
        setMembers(Array.isArray(membersData.members) ? membersData.members : []);
        if (auditResult.ok) {
          const auditData = await auditResult.json();
          if (!cancelled) setEvents(Array.isArray(auditData.events) ? auditData.events : []);
        } else if (!cancelled) {
          setAuditNotice('Le journal des créations d’invitations n’est pas accessible pour cet espace.');
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Erreur de chargement.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [companyId]);

  const invitations = events.filter(event => event.event === 'member.invitation_created'
    && event.actor_email?.toLowerCase() === actorEmail?.toLowerCase());
  // The audit log contains creation events, not actual delivery or current invitation status.
  const uniqueInvitations = invitations.filter((event, index, all) =>
    all.findIndex(item => (item.metadata?.invitation_id ?? item.id) === (event.metadata?.invitation_id ?? event.id)) === index);
  const activeMembers = members.filter(member => member.status === 'active');
  const normalizedEmail = email.trim().toLowerCase();
  const isValid = Boolean(company && allowedRoles.some(option => option.value === role) && emailValid(normalizedEmail));

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/company-members', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, email: normalizedEmail, role })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de créer l’invitation.');
      if (!data.invitation?.id) throw new Error('Confirmation de création indisponible.');
      setEmail('');
      setNotice('Invitation enregistrée pour ' + normalizedEmail +
        '. Aucun e-mail automatique n’est envoyé actuellement. Le destinataire peut créer ou confirmer son compte puis consulter « Mes invitations » avec cette adresse.');
      const [memberResult, auditResult] = await Promise.all([
        fetch('/api/company-members?companyId=' + encodeURIComponent(companyId), { cache: 'no-store' }),
        fetch('/api/audit-logs?companyId=' + encodeURIComponent(companyId), { cache: 'no-store' })
      ]);
      if (memberResult.ok) {
        const body = await memberResult.json();
        setMembers(Array.isArray(body.members) ? body.members : []);
      }
      if (auditResult.ok) {
        const body = await auditResult.json();
        setEvents(Array.isArray(body.events) ? body.events : []);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invitation impossible.');
    } finally {
      submitting.current = false; setBusy(false);
    }
  }

  return <section className="zalliance" aria-labelledby="zalliance-heading">
    <div className="zalliance-heading">
      <div>
        <p className="eyebrow">COLLABORATION · ZARAY</p>
        <h1 id="zalliance-heading"><ZarayIcon name="alliance" size={30} /> Z’Alliance</h1>
        <p>Construisez votre équipe et partagez votre espace de travail en toute confiance.</p>
      </div>
      <Link href="/mon-compte" className="zalliance-close" aria-label="Fermer Z’Alliance et revenir à l’accueil"><ZarayIcon name="close" size={20}/><span>Fermer</span></Link>
    </div>
    <p className="zalliance-info"><ZarayIcon name="help" size={20} />
      Z’Alliance utilise actuellement les invitations enregistrées dans Supabase. L’envoi d’e-mails, les liens secrets, le renvoi et la révocation ne sont pas encore disponibles. Aucun message d’envoi n’est simulé.</p>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {authorized.length ? <>
      <label className="zalliance-company">Entreprise autorisée
        <select value={companyId} onChange={event => { setCompanyId(event.target.value); setRole('support'); setNotice(''); }}>
          {authorized.map(item => <option value={item.id} key={item.id}>{item.legal_name} · {names[item.role] ?? item.role}</option>)}
        </select>
      </label>
      <div className="zalliance-sections">
        <section className="panel zalliance-invite" aria-labelledby="zalliance-invite-heading">
          <h2 id="zalliance-invite-heading"><ZarayIcon name="signup" size={20}/> Inviter un collaborateur</h2>
          <p className="muted">Créez une invitation sécurisée, associée à une adresse e-mail vérifiée et à une seule entreprise.</p>
          <form className="form-stack" onSubmit={event => void createInvitation(event)}>
            <label>Adresse e-mail
              <input type="email" required autoComplete="email" maxLength={254} placeholder="collegue@exemple.com"
                value={email} onChange={event => setEmail(event.target.value)} />
            </label>
            <label>Rôle du collaborateur
              <select value={role} onChange={event => setRole(event.target.value)}>
                {allowedRoles.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <p className="zalliance-role-description">{allowedRoles.find(option => option.value === role)?.description ?? ''}</p>
            <div className="zalliance-actions">
              <button type="submit" className="primary-link" disabled={!isValid || busy || loading}>
                <ZarayIcon name="add" size={18}/> {busy ? 'Création en cours…' : 'Créer l’invitation'}
              </button>
              <button type="button" disabled={busy} onClick={() => { setEmail(''); setRole('support'); setError(''); }}>Annuler</button>
            </div>
          </form>
          <p className="muted">Le message personnel et le bouton « Envoyer l’invitation » seront activés uniquement après intégration d’un service d’envoi testé.</p>
        </section>
        <div className="zalliance-lists">
          <section className="panel" aria-labelledby="zalliance-history-heading">
            <h2 id="zalliance-history-heading"><ZarayIcon name="document" size={20}/> Invitations enregistrées</h2>
            <p className="muted">Extraits du journal d’audit des créations effectuées par votre compte, limités à l’historique accessible. Ce n’est pas un suivi de livraison.</p>
            {loading ? <p className="muted">Chargement des invitations…</p>
              : auditNotice ? <p className="muted">{auditNotice}</p>
              : uniqueInvitations.length ? <ul className="zalliance-items">
                {uniqueInvitations.map(item => <li key={item.id}>
                  <span><strong>{item.metadata?.email ?? 'Destinataire masqué'}</strong>
                  <small>{names[item.metadata?.role ?? ''] ?? item.metadata?.role ?? 'Rôle non renseigné'} · {displayDate(item.created_at)}</small></span>
                  <span className="status-pill">Enregistrée</span>
                </li>)}
              </ul> : <p className="muted">Aucune création d’invitation dans le journal accessible.</p>}
          </section>
          <section className="panel" aria-labelledby="zalliance-members-heading">
            <h2 id="zalliance-members-heading"><ZarayIcon name="members" size={20}/> Collaborateurs actifs</h2>
            {loading ? <p className="muted">Chargement des collaborateurs…</p>
              : activeMembers.length ? <ul className="zalliance-items">
                {activeMembers.map(member => <li key={member.user_id}>
                  <span><strong>{member.email}</strong>
                    <small>{names[member.role] ?? member.role} · Membre depuis {displayDate(member.created_at)}</small></span>
                  <span className="status-pill">Actif</span>
                </li>)}
              </ul> : <p className="muted">Aucun collaborateur actif à afficher.</p>}
            <Link className="header-link zalliance-external-link" href={'/membres?companyId=' + encodeURIComponent(companyId)}>
              <ZarayIcon name="next" size={17}/> Gérer les rôles et statuts
            </Link>
          </section>
        </div>
      </div>
    </> : <section className="empty-state">
      <strong>Aucune entreprise avec autorisation d’invitation</strong>
      <p>La création d’invitations est réservée aux propriétaires et administrateurs d’une entreprise. Les droits ne peuvent pas être élevés depuis cette interface.</p>
      <Link href="/entreprises" className="header-link"><ZarayIcon name="company" size={18}/> Consulter mes entreprises</Link>
    </section>}
    <div className="zalliance-footer">
      <Link href="/invitations" className="header-link"><ZarayIcon name="next" size={18}/> Mes invitations reçues</Link>
      <p className="muted">Pour accepter une invitation existante, le destinataire doit se connecter avec l’adresse e-mail vérifiée ciblée par l’invitation. L’acceptation s’effectue dans « Mes invitations ».</p>
    </div>
  </section>;
}
