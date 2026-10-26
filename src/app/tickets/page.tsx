'use client';
import BrandLogo from '@/components/brand-logo';
import { useEffect, useState } from 'react';
import WorkspaceBreadcrumb from '@/components/workspace-breadcrumb';
import { activeSiteId, scopedQuery, selectedCompany, switchCompany } from '@/lib/workspace-url';
import { MotionFeedback, MotionSkeleton } from '@/components/motion';
type Company = { id: string; legal_name: string; role: string };
type Order = { id: string; public_reference: string; offer_name: string; customer_name: string; amount: number | string; currency: string; status: string; paid_at: string | null };
type Ticket = { id: string; subscription_order_id: string; code_prefix: string; status: string; duration_minutes: number; max_devices: number; valid_from: string; valid_until: string; created_at: string };
const statusLabel: Record<string, string> = { issued: 'Émis', redeemed: 'Utilisé', expired: 'Expiré', revoked: 'Révoqué' };

export default function WifiTicketsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [orderId, setOrderId] = useState('');
  const [oneTimeCode, setOneTimeCode] = useState('');
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/sites', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Impossible de charger les entreprises.');
        if (active) { setCompanies(data.companies ?? []); setCompanyId(selectedCompany(data.companies??[],data.sites??[])); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, []);

  async function reload(company: string) {
    if (!company) { setOrders([]); setTickets([]); return; }
    const results = await Promise.all([
      fetch('/api/subscription-orders?' + scopedQuery(company), { cache: 'no-store' }),
      fetch('/api/wifi-tickets?' + scopedQuery(company), { cache: 'no-store' }),
    ]);
    const data = await Promise.all(results.map((r) => r.json()));
    if (!results[0].ok) throw new Error(data[0].error || 'Impossible de charger les commandes.');
    if (!results[1].ok) throw new Error(data[1].error || 'Impossible de charger les tickets.');
    setOrders(data[0].orders ?? []); setTickets(data[1].tickets ?? []);
  }

  useEffect(() => {
    if (!companyId) return;
    let active = true; setBusy(true);
    (async () => {
      try { await reload(companyId); }
      catch (e) { if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [companyId]);

  async function issue() {
    setError(''); setNotice(''); setOneTimeCode(''); setSaving(true);
    try {
      const response = await fetch('/api/wifi-tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Émission impossible.');
      setOneTimeCode(data.code); setNotice('Ticket émis. Copiez le code maintenant : il ne sera plus affiché.');
      await reload(companyId); setOrderId('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Émission impossible.'); }
    finally { setSaving(false); }
  }

  async function revoke(ticketId: string) {
    setError(''); setNotice('');
    try {
      const response = await fetch('/api/wifi-tickets', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticketId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Révocation impossible.');
      setNotice('Ticket révoqué.'); await reload(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Révocation impossible.'); }
  }

  const paidOrdersWithoutTicket = orders.filter((o) => o.status === 'paid' && !tickets.some((t) => t.subscription_order_id === o.id));
  return <main className="form-shell"><section className="form-card" style={{ maxWidth: 1100, width: 'min(100%,1100px)' }}>
      <div className="workspace-brand"><a href="/" aria-label="ZARAY · Accueil"><BrandLogo /></a></div>
    <WorkspaceBreadcrumb companyId={companyId}/><p className="eyebrow">ZARAY · MODULE 8 · ACCÈS WI-FI</p><h1>Tickets Wi-Fi</h1>
    <p>Les codes sont hachés en base et affichés une seule fois. L’émission est refusée tant que la commande n’a pas un paiement confirmé côté serveur. Un ticket émis ne déclenche pas lui-même la connexion réseau.</p>
    {companies.length > 0 && <label>Entreprise<select value={companyId} onChange={(e) => switchCompany('/tickets',e.target.value)}>{companies.map((c) => <option key={c.id} value={c.id}>{c.legal_name}</option>)}</select></label>}
    {paidOrdersWithoutTicket.length > 0 && <section style={{ marginTop: 24 }}>
      <h2>Émettre un ticket après paiement</h2>
      <label>Commande payée<select value={orderId} onChange={(e) => setOrderId(e.target.value)}><option value="">Choisir une commande…</option>{paidOrdersWithoutTicket.map((o) => <option key={o.id} value={o.id}>{o.public_reference} · {o.customer_name} · {o.offer_name}</option>)}</select></label>
      <button className="primary-link" type="button" style={{ marginTop: 14 }} disabled={saving || !orderId} onClick={issue}>{saving ? 'Émission…' : 'Générer un ticket Wi-Fi'}</button>
    </section>}
    {oneTimeCode && <section className="module" style={{ marginTop: 22, minHeight: 0 }}>
      <span className="module-number">CODE AFFICHÉ UNE SEULE FOIS</span><h2 style={{ overflowWrap: 'anywhere' }}>{oneTimeCode}</h2>
      <p>Conservez ce code dans un endroit sûr. ZARAY ne stocke que son empreinte cryptographique.</p>
      <button type="button" onClick={() => { void navigator.clipboard?.writeText(oneTimeCode); setNotice('Code copié si le navigateur autorise le presse-papiers.'); }}>Copier le code</button>
    </section>}
    {busy ? <MotionSkeleton rows={3}/> : tickets.length ? <><h2 style={{ marginTop: 32 }}>Tickets existants</h2><div className="module-grid">
      {tickets.map((t) => <article className="module" key={t.id}>
        <span className="module-number">{statusLabel[t.status] ?? t.status}</span><h3>{t.code_prefix}••••</h3>
        <p>{t.duration_minutes} minutes · {t.max_devices} appareil(s)</p><p>Valide du {new Date(t.valid_from).toLocaleString('fr-FR')}</p><p>Jusqu’au {new Date(t.valid_until).toLocaleString('fr-FR')}</p>
        {t.status === 'issued' && new Date(t.valid_until).getTime() > Date.now() && <button type="button" style={{ marginTop: 16 }} onClick={() => revoke(t.id)}>Révoquer le ticket</button>}
      </article>)}
    </div></> : !busy ? <p>Aucun ticket émis. Les commandes en attente de paiement ne peuvent pas générer de ticket.</p> : null}
    <MotionFeedback message={error || notice} kind={error ? 'error' : 'success'}/>
    <p style={{ marginTop: 28 }}><a href="/commandes">Commandes →</a> · <a href="/tableau-de-bord">Tableau de bord</a></p>
  </section></main>;
}
