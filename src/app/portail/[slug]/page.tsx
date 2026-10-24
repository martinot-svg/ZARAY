'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
type Offer = { id: string; name: string; description: string; durationMinutes: number; validityDays: number; priceAmount: number; currency: string; maxDevices: number };
type CreatedOrder = { reference: string; status: string; amount: number; currency: string; offer_name: string };

export default function CaptivePortalPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [companyName, setCompanyName] = useState('');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerId, setOfferId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/portal/' + encodeURIComponent(slug), { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Portail indisponible.');
        if (active) { setCompanyName(data.companyName); setOffers(data.offers ?? []); setOfferId(data.offers?.[0]?.id ?? ''); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Portail indisponible.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [slug]);

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setOrder(null); setSubmitting(true);
    try {
      const response = await fetch('/api/portal/' + encodeURIComponent(slug), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, customerName, customerEmail, customerPhone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Souscription impossible.');
      setOrder(data.order);
    } catch (e) { setError(e instanceof Error ? e.message : 'Souscription impossible.'); }
    finally { setSubmitting(false); }
  }

  const money = (offer: Offer) => {
    try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: offer.currency }).format(offer.priceAmount); }
    catch { return offer.priceAmount.toLocaleString('fr-FR') + ' ' + offer.currency; }
  };

  return <main className="form-shell"><section className="form-card" style={{ width: 'min(100%, 760px)' }}>
    <p className="eyebrow">ZARAY · PORTAIL CAPTIF</p>
    <h1>{companyName || 'Connexion Wi-Fi'}</h1>
    <p>Choisissez un forfait et préparez votre souscription. La connexion Internet ne sera pas activée par la création de la commande.</p>
    {busy ? <p role="status">Chargement des offres…</p> : offers.length ? <>
      <h2>Forfaits disponibles</h2>
      <div className="module-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', margin: '18px 0 28px' }}>
        {offers.map((offer) => <button key={offer.id} type="button" className="module" onClick={() => setOfferId(offer.id)} aria-pressed={offerId === offer.id} style={{ textAlign: 'left', cursor: 'pointer', borderColor: offerId === offer.id ? '#087f75' : undefined, color: '#102e3b', background: offerId === offer.id ? '#e4f3f1' : 'white' }}>
          <span className="module-number">{offer.durationMinutes} min de connexion</span><h3>{offer.name}</h3><p>{offer.description || 'Forfait Internet'}</p>
          <p style={{ marginTop: 12 }}>{offer.validityDays} jour(s) de validité · {offer.maxDevices} appareil(s)</p><strong style={{ display: 'block', marginTop: 18 }}>{money(offer)}</strong>
        </button>)}
      </div>
      <h2>Vos coordonnées</h2>
      <form className="form-stack" onSubmit={subscribe}>
        <label>Nom complet<input value={customerName} onChange={(e) => setCustomerName(e.target.value)} minLength={2} maxLength={160} required /></label>
        <label>Adresse e-mail<input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} maxLength={254} required /></label>
        <label>Téléphone (facultatif)<input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} maxLength={32} /></label>
        <button className="primary-link" type="submit" disabled={submitting || !offerId}>{submitting ? 'Création de la commande…' : 'Continuer vers le paiement'}</button>
      </form>
    </> : !error ? <p>Aucune offre active n’est disponible sur ce portail pour le moment.</p> : null}
    {order && <section className="module" style={{ marginTop: 24, minHeight: 0 }} role="status">
      <span className="module-number">COMMANDE CRÉÉE</span><h2>Référence : {order.reference}</h2>
      <p>Forfait : {order.offer_name}</p><p>Montant : {Number(order.amount).toLocaleString('fr-FR')} {order.currency}</p><p>État : paiement en attente.</p>
      <p><strong>Aucun accès Internet n’a été activé.</strong> Le paiement en ligne sera disponible après configuration du module de paiement.</p>
    </section>}
    {error && <p role="alert">{error}</p>}
    <p style={{ marginTop: 28 }}><a href="/">ZARAY</a></p>
  </section></main>;
}
