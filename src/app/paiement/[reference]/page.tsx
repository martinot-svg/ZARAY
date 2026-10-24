'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type PaymentStatus = { reference: string; orderStatus: string; paid: boolean; paymentStatus: string; providerConfigured: boolean };
const paymentLabels: Record<string,string> = { pending: 'En attente de confirmation MVola', succeeded: 'Paiement confirmé', failed: 'Échec du paiement', cancelled: 'Paiement annulé', review_required: 'Vérification manuelle nécessaire', not_started: 'Paiement non démarré' };

export default function PaymentStatusPage() {
  const params = useParams<{ reference: string }>();
  const reference = params.reference;
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  async function refresh() {
    try {
      const response = await fetch('/api/payments/mvola/status?reference=' + encodeURIComponent(reference), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Statut indisponible.');
      setStatus(data);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Statut indisponible.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, [reference]);
  return <main className="form-shell"><section className="form-card" style={{ width: 'min(100%, 680px)' }}>
    <p className="eyebrow">ZARAY · PAIEMENT MVOLA</p><h1>Suivi du paiement</h1>
    <p>Référence de commande : <strong>{reference}</strong></p>
    {busy ? <p role="status">Vérification du statut…</p> : null}
    {status && <section className="module" style={{ marginTop: 20, minHeight: 0 }}>
      <span className="module-number">{status.paid ? 'PAYÉ' : 'NON PAYÉ'}</span>
      <h2>{paymentLabels[status.paymentStatus] ?? status.paymentStatus}</h2>
      <p>État de la commande : {status.orderStatus}</p>
      {!status.providerConfigured && <p>Les identifiants MVola ne sont pas encore configurés sur le serveur.</p>}
      <button type="button" className="primary-link" onClick={() => { setBusy(true); void refresh(); }}>Actualiser le statut</button>
      <p><strong>Aucun accès Internet ne sera accordé avant une confirmation vérifiée et une activation réseau distincte.</strong></p>
    </section>}
    {error && <p role="alert">{error}</p>}
    <p style={{ marginTop: 28 }}><a href="/">Retour à ZARAY</a></p>
  </section></main>;
}
