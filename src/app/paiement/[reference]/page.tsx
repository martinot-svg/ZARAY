'use client';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import BrandLogo from '@/components/brand-logo';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type PaymentStatus = {
  reference: string; offerName: string; amount: number | string; currency: string;
  orderStatus: string; paid: boolean;
  submission: null | { provider: 'orange_money' | 'mvola'; status: 'submitted' | 'approved' | 'rejected'; createdAt: string; reviewedAt: string | null };
};
const providerLabel: Record<string,string> = { orange_money: 'Orange Money', mvola: 'MVola' };
const statusLabel: Record<string,string> = { submitted: 'Justificatif reçu — en attente de vérification', approved: 'Paiement validé', rejected: 'Justificatif rejeté', not_submitted: 'Aucun justificatif transmis' };

export default function PaymentStatusPage() {
  const params = useParams<{ reference: string }>();
  const reference = params.reference;
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  async function refresh() {
    try {
      const response = await fetch('/api/manual-payments/status?reference=' + encodeURIComponent(reference), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Statut indisponible.');
      setStatus(data); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Statut indisponible.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, [reference]);
  return <main className="form-shell"><section className="form-card" style={{ width: 'min(100%, 680px)' }}>
      <div className="workspace-brand"><a href="/" aria-label="ZARAY · Accueil"><BrandLogo /></a></div>
    <p className="eyebrow">ZARAY · PAIEMENT MANUEL</p><h1>Suivi du paiement</h1>
    <p>Référence de commande : <strong>{reference}</strong></p>
    {busy && <p role="status">Vérification du statut…</p>}
    {status && <section className="module" style={{ marginTop: 20, minHeight: 0 }}>
      <span className="module-number">{status.paid ? 'PAYÉ' : 'EN ATTENTE'}</span>
      <h2>{status.offerName}</h2>
      <p>Montant : <strong>{Number(status.amount).toLocaleString('fr-FR')} {status.currency}</strong></p>
      <p>Statut : {statusLabel[status.submission?.status ?? 'not_submitted']}</p>
      {status.submission && <>
        <p>Moyen de paiement : {providerLabel[status.submission.provider]}</p>
        <p>Justificatif transmis le {new Date(status.submission.createdAt).toLocaleString('fr-FR')}</p>
        {status.submission.reviewedAt && <p>Décision le {new Date(status.submission.reviewedAt).toLocaleString('fr-FR')}</p>}
      </>}
      <button type="button" className="primary-link" onClick={() => { setBusy(true); void refresh(); }}><ZarayIcon name="refresh" size={18} /> Actualiser le statut</button>
      <p><strong>Le paiement est confirmé uniquement après vérification du transfert par un responsable autorisé. Aucun accès Internet n’est activé par la simple soumission d’un reçu.</strong></p>
    </section>}
    {error && <p role="alert">{error}</p>}
    <p style={{ marginTop: 28 }}><a href="/"><ZarayIcon name="back" size={18} /> Retour à ZARAY</a></p>
  </section></main>;
}
