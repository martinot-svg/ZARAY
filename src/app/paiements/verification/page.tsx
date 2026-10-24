'use client';
import { useEffect, useState } from 'react';

type Company = { id: string; legal_name: string; role: string };
type Submission = {
  id: string; order_id: string; provider: 'orange_money' | 'mvola'; sender_phone: string; transaction_reference: string;
  amount: number | string; currency: string; proofUrl: string | null; customer_note: string;
  status: 'submitted' | 'approved' | 'rejected'; created_at: string; review_note: string;
  order: null | { id: string; public_reference: string; customer_name: string; customer_email: string; offer_name: string; amount: number | string; currency: string; status: string };
};
const providerLabel: Record<string,string> = { orange_money: 'Orange Money', mvola: 'MVola' };
const statusLabel: Record<string,string> = { submitted: 'À vérifier', approved: 'Validé', rejected: 'Rejeté' };
const money = (amount: number | string, currency: string) => Number(amount).toLocaleString('fr-FR') + ' ' + currency;

export default function VerificationPaiementsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string,string>>({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load(id: string) {
    if (!id) return;
    const response = await fetch('/api/manual-payments/review?companyId=' + encodeURIComponent(id), { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible de charger les justificatifs.');
    setSubmissions(data.submissions ?? []);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/sites', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Impossible de charger les entreprises.');
        const candidates = (data.companies ?? []).filter((company: Company) => ['owner','admin'].includes(company.role));
        const checked = await Promise.all(candidates.map(async (company: Company) => {
          if (company.role === 'owner') return company;
          try {
            const accessResponse = await fetch('/api/manual-payments/access?companyId=' + encodeURIComponent(company.id), { cache: 'no-store' });
            const access = await accessResponse.json();
            return accessResponse.ok && access.canReview === true ? company : null;
          } catch { return null; }
        }));
        const authorized = checked.filter((company): company is Company => company !== null);
        if (!active) return;
        setCompanies(authorized);
        if (authorized[0]) setCompanyId(authorized[0].id);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    setBusy(true); setError('');
    load(companyId).catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement.'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [companyId]);

  async function review(item: Submission, action: 'approve' | 'reject') {
    if (action === 'approve' && !window.confirm('As-tu vérifié le reçu dans le compte Orange Money/MVola et confirmé le montant ?')) return;
    if (action === 'reject' && !window.confirm('Rejeter ce justificatif ? Le client pourra en soumettre un nouveau.')) return;
    setWorking(item.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/manual-payments/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: item.id, action, reviewNote: reviewNotes[item.id] ?? '' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Action impossible.');
      setNotice(action === 'approve' ? 'Paiement validé. La commande est marquée comme payée.' : 'Justificatif rejeté.');
      await load(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Action impossible.'); }
    finally { setWorking(''); }
  }

  return <main className="form-shell"><section className="form-card" style={{ maxWidth: 1100, width: 'min(100%,1100px)' }}>
    <p className="eyebrow">ZARAY · FINANCES</p><h1>Vérification des paiements</h1>
    <p>Vérifie chaque transaction dans le compte bénéficiaire avant de valider le reçu. Une image seule ne prouve pas que l’argent a été reçu.</p>
    {companies.length > 0 && <label>Entreprise<select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>{companies.map((company) => <option key={company.id} value={company.id}>{company.legal_name}</option>)}</select></label>}
    {companies.length === 0 && !busy && <p>Aucune entreprise accessible : le dirigeant peut valider directement ou autoriser un administrateur depuis les <a href="/autorisations-paiement">autorisations des validateurs</a>.</p>}
    {busy ? <p>Chargement des paiements…</p> : submissions.length ? <div className="module-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
      {submissions.map((item) => <article className="module" key={item.id} style={{ minHeight: 0 }}>
        <span className="module-number">{statusLabel[item.status] ?? item.status}</span>
        <h2>{item.order?.customer_name ?? 'Commande inconnue'}</h2>
        <p>Référence commande : <strong>{item.order?.public_reference ?? item.order_id}</strong></p>
        <p>Forfait : {item.order?.offer_name ?? '—'}</p>
        <p>Montant déclaré : <strong>{money(item.amount, item.currency)}</strong></p>
        <p>Moyen : {providerLabel[item.provider]} · Envoyé depuis {item.sender_phone}</p>
        <p>Référence transaction : <strong>{item.transaction_reference}</strong></p>
        <p>E-mail : {item.order?.customer_email ?? '—'}</p>
        {item.customer_note && <p>Note client : {item.customer_note}</p>}
        <p>Soumis le {new Date(item.created_at).toLocaleString('fr-FR')}</p>
        {item.proofUrl && <p><a href={item.proofUrl} target="_blank" rel="noreferrer">Ouvrir le justificatif privé ↗</a></p>}
        {!item.proofUrl && <p role="alert">Le justificatif n’a pas pu être chargé.</p>}
        {item.status !== 'submitted' && <p>Décision : {item.review_note || statusLabel[item.status]}</p>}
        {item.status === 'submitted' && <>
          <label>Note de validation (facultatif)<textarea rows={2} maxLength={1000} value={reviewNotes[item.id] ?? ''} onChange={(e) => setReviewNotes((old) => ({ ...old, [item.id]: e.target.value }))} /></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            <button className="primary-link" type="button" disabled={working === item.id} onClick={() => void review(item,'approve')}>{working === item.id ? 'Traitement…' : 'Valider le paiement'}</button>
            <button type="button" disabled={working === item.id} onClick={() => void review(item,'reject')}>Rejeter</button>
          </div>
        </>}
      </article>)}
    </div> : !busy ? <p>Aucun justificatif pour cette entreprise.</p> : null}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    <p style={{ marginTop: 28 }}><a href="/autorisations-paiement">Gérer les validateurs →</a> · <a href="/parametres-paiement">Configurer les numéros</a> · <a href="/commandes">Commandes</a> · <a href="/tableau-de-bord">Tableau de bord</a></p>
  </section></main>;
}
