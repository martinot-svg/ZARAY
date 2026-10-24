'use client';
import { useEffect, useState } from 'react';
type Company = { id: string; legal_name: string; role: string };
type Order = { id: string; public_reference: string; customer_name: string; customer_email: string; customer_phone: string | null; offer_name: string; amount: number | string; currency: string; status: string; created_at: string; paid_at: string | null; activated_at: string | null };
const statusLabel: Record<string, string> = { pending_payment: 'Paiement en attente', paid: 'Payée', cancelled: 'Annulée', expired: 'Expirée', activation_pending: 'Activation en attente', active: 'Active', failed: 'Échec' };

export default function OrdersPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/sites', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Impossible de charger les entreprises.');
        if (active) { setCompanies(data.companies ?? []); setCompanyId(data.companies?.[0]?.id ?? ''); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!companyId) { setOrders([]); return; }
    let active = true; setBusy(true);
    (async () => {
      try {
        const response = await fetch('/api/subscription-orders?companyId=' + encodeURIComponent(companyId), { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Impossible de charger les commandes.');
        if (active) setOrders(data.orders ?? []);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Erreur.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [companyId]);

  return <main className="form-shell"><section className="form-card" style={{ maxWidth: 1100, width: 'min(100%,1100px)' }}>
    <p className="eyebrow">ZARAY · MODULE 7 · SOUSCRIPTIONS</p><h1>Commandes du portail captif</h1>
    <p>Les commandes publiques sont enregistrées avec un montant et un forfait figés. Leur création ne vaut ni paiement confirmé ni activation Internet.</p>
    {companies.length > 0 && <label>Entreprise<select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>{companies.map((c) => <option key={c.id} value={c.id}>{c.legal_name}</option>)}</select></label>}
    {companies.length === 0 && !busy && <p>Aucune entreprise accessible.</p>}
    {busy ? <p role="status">Chargement…</p> : orders.length ? <div className="module-grid" style={{ marginTop: 24 }}>
      {orders.map((o) => <article className="module" key={o.id}>
        <span className="module-number">{statusLabel[o.status] ?? o.status}</span><h3>{o.offer_name}</h3><p>Référence : <strong>{o.public_reference}</strong></p>
        <p>{o.customer_name} · {o.customer_email}</p>{o.customer_phone && <p>{o.customer_phone}</p>}
        <p style={{ marginTop: 10 }}>{Number(o.amount).toLocaleString('fr-FR')} {o.currency}</p>
        <span className="module-status">Créée le {new Date(o.created_at).toLocaleString('fr-FR')}</span>
        {o.status === 'pending_payment' && <p style={{ marginTop: 12 }}><strong>Pas de ticket : paiement non confirmé.</strong></p>}
        {o.status === 'paid' && !o.activated_at && <p style={{ marginTop: 12 }}>Paiement confirmé. Le ticket peut être émis ; l’accès réseau n’est pas encore activé.</p>}
        {o.activated_at && <p style={{ marginTop: 12 }}>Activation enregistrée le {new Date(o.activated_at).toLocaleString('fr-FR')}</p>}
      </article>)}
    </div> : !busy ? <p>Aucune commande pour cette entreprise. Le portail public sera accessible via <code>/portail/identifiant-entreprise</code>.</p> : null}
    {error && <p role="alert">{error}</p>}
    <p style={{ marginTop: 28 }}><a href="/tickets">Gestion des tickets Wi-Fi →</a> · <a href="/offres">Offres</a> · <a href="/tableau-de-bord">Tableau de bord</a></p>
  </section></main>;
}
