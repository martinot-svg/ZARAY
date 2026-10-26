'use client';
import BrandLogo from '@/components/brand-logo';

import { selectedCompany,switchCompany } from '@/lib/workspace-url';
import { useEffect, useState } from 'react';

type Company = { id: string; legal_name: string; role: string };
type Reviewer = { user_id: string; email: string; role: 'admin'; authorized: boolean; granted_at: string | null };

export default function AutorisationsPaiementPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadReviewers(id: string) {
    if (!id) { setReviewers([]); return; }
    const response = await fetch('/api/manual-payments/reviewers?companyId=' + encodeURIComponent(id), { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible de charger les validateurs.');
    setReviewers(data.reviewers ?? []);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/sites', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Impossible de charger les entreprises.');
        const owned = (data.companies ?? []).filter((company: Company) => company.role === 'owner');
        if (!active) return;
        setCompanies(owned);
        if (owned[0]) setCompanyId(selectedCompany(owned,data.sites??[]));
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!companyId) { setReviewers([]); return; }
    let active = true;
    setBusy(true); setError(''); setNotice('');
    loadReviewers(companyId)
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [companyId]);

  async function setAuthorization(reviewer: Reviewer, authorized: boolean) {
    setSaving(reviewer.user_id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/manual-payments/reviewers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, userId: reviewer.user_id, authorized }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Modification impossible.');
      setReviewers((current) => current.map((item) => item.user_id === reviewer.user_id ? { ...item, authorized } : item));
      setNotice(authorized ? 'Administrateur autorisé à valider les paiements.' : 'Autorisation de validation révoquée.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Modification impossible.'); }
    finally { setSaving(''); }
  }

  return <main className="form-shell"><section className="form-card" style={{ maxWidth: 900, width: 'min(100%,900px)' }}>
      <div className="workspace-brand"><a href="/" aria-label="ZARAY · Accueil"><BrandLogo /></a></div>
    <p className="eyebrow">ZARAY · SÉCURITÉ FINANCIÈRE</p>
    <h1>Autorisations des validateurs</h1>
    <p>Le dirigeant conserve le droit de validation. Les autres administrateurs ne peuvent accéder aux justificatifs ni confirmer un paiement qu’après une autorisation explicite ici.</p>
    {companies.length > 0 && <label>Entreprise<select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>{companies.map((company) => <option key={company.id} value={company.id}>{company.legal_name}</option>)}</select></label>}
    {!busy && companies.length === 0 && <p>Aucune entreprise dont vous êtes le dirigeant. Seul le dirigeant peut modifier ces autorisations.</p>}
    {busy ? <p>Chargement des administrateurs…</p> : reviewers.length ? <div className="module-grid" style={{ marginTop: 24 }}>
      {reviewers.map((reviewer) => <article className="module" key={reviewer.user_id} style={{ minHeight: 0 }}>
        <span className="module-number">Administrateur</span>
        <h2>{reviewer.email}</h2>
        <p>{reviewer.authorized ? 'Autorisé à consulter et vérifier les justificatifs.' : 'Aucun accès à la vérification des paiements.'}</p>
        {reviewer.granted_at && <small>Autorisation accordée le {new Date(reviewer.granted_at).toLocaleString('fr-FR')}</small>}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <input type="checkbox" checked={reviewer.authorized} disabled={saving === reviewer.user_id} onChange={(e) => void setAuthorization(reviewer, e.target.checked)} />
          Autoriser la validation des paiements
        </label>
      </article>)}
    </div> : !busy && companyId ? <p>Aucun administrateur actif dans cette entreprise. Ajoutez d’abord un administrateur depuis la gestion des membres.</p> : null}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    <p style={{ marginTop: 28 }}><a href="/paiements/verification">Vérification des paiements →</a> · <a href="/membres">Gestion des membres</a> · <a href="/tableau-de-bord">Tableau de bord</a></p>
  </section></main>;
}
