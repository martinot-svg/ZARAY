'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';

type Offer = { id: string; name: string; description: string; durationMinutes: number; validityDays: number; priceAmount: number; currency: string; maxDevices: number };
type CreatedOrder = { id?: string; reference: string; status: string; amount: number; currency: string; offer_name: string };
type PaymentMethod = { provider: 'orange_money' | 'mvola'; accountNumber: string; accountName: string; instructions: string };
type SubmissionState = { status: string; message: string } | null;
const providerLabel: Record<string,string> = { orange_money: 'Orange Money', mvola: 'MVola' };

export default function CaptivePortalPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [companyName, setCompanyName] = useState('');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [offerId, setOfferId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'orange_money' | 'mvola' | ''>('');
  const [senderPhone, setSenderPhone] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [submissionState, setSubmissionState] = useState<SubmissionState>(null);
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sendingProof, setSendingProof] = useState(false);
  const [error, setError] = useState('');
  const [proofError, setProofError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [portalResponse, methodsResponse] = await Promise.all([
          fetch('/api/portal/' + encodeURIComponent(slug), { cache: 'no-store' }),
          fetch('/api/portal/' + encodeURIComponent(slug) + '/payment-methods', { cache: 'no-store' }),
        ]);
        const data = await portalResponse.json();
        if (!portalResponse.ok) throw new Error(data.error || 'Portail indisponible.');
        const methodData = await methodsResponse.json().catch(() => ({}));
        if (active) {
          setCompanyName(data.companyName);
          setOffers(data.offers ?? []);
          setOfferId(data.offers?.[0]?.id ?? '');
          const methods = methodsResponse.ok ? (methodData.methods ?? []) as PaymentMethod[] : [];
          setPaymentMethods(methods);
          setSelectedProvider(methods[0]?.provider ?? '');
        }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Portail indisponible.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [slug]);

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setOrder(null); setSubmissionState(null); setProofError(''); setSubmitting(true);
    try {
      const response = await fetch('/api/portal/' + encodeURIComponent(slug), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, customerName, customerEmail, customerPhone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Souscription impossible.');
      setOrder(data.order);
      setSubmissionState(null);
      setProof(null);
      setTransactionReference('');
      setCustomerNote('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Souscription impossible.'); }
    finally { setSubmitting(false); }
  }

  async function sendProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order || !selectedProvider || !proof) {
      setProofError('Choisissez un moyen de paiement et ajoutez le justificatif.');
      return;
    }
    setProofError(''); setSubmissionState(null); setSendingProof(true);
    try {
      const form = new FormData();
      form.set('reference', order.reference);
      form.set('provider', selectedProvider);
      form.set('customerEmail', customerEmail);
      form.set('senderPhone', senderPhone);
      form.set('transactionReference', transactionReference);
      form.set('customerNote', customerNote);
      form.set('proof', proof);
      const response = await fetch('/api/manual-payments/submit', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible d’envoyer le justificatif.');
      setSubmissionState({ status: data.submission.status, message: data.message || 'Justificatif transmis pour vérification.' });
      setProof(null);
      const input = document.getElementById('payment-proof') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (e) { setProofError(e instanceof Error ? e.message : 'Impossible d’envoyer le justificatif.'); }
    finally { setSendingProof(false); }
  }

  const money = (offer: Offer) => {
    try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: offer.currency }).format(offer.priceAmount); }
    catch { return offer.priceAmount.toLocaleString('fr-FR') + ' ' + offer.currency; }
  };
  const selectedMethod = paymentMethods.find((method) => method.provider === selectedProvider);

  return <main className="form-shell"><section className="form-card" style={{ width: 'min(100%, 760px)' }}>
    <p className="eyebrow">ZARAY · PORTAIL CAPTIF</p>
    <h1>{companyName || 'Connexion Wi-Fi'}</h1>
    <p>Choisissez un forfait, envoyez le paiement sur le numéro indiqué et transmettez le reçu. L’accès ne sera accordé qu’après vérification du paiement.</p>
    {busy ? <p role="status">Chargement des offres…</p> : offers.length ? <>
      <h2>Forfaits disponibles</h2>
      <div className="module-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', margin: '18px 0 28px' }}>
        {offers.map((offer) => <button key={offer.id} type="button" className="module" onClick={() => setOfferId(offer.id)} aria-pressed={offerId === offer.id} style={{ textAlign: 'left', cursor: 'pointer', borderColor: offerId === offer.id ? '#087f75' : undefined, color: '#102e3b', background: offerId === offer.id ? '#e4f3f1' : 'white' }}>
          <span className="module-number">{offer.durationMinutes} min de connexion</span><h3>{offer.name}</h3><p>{offer.description || 'Forfait Internet'}</p>
          <p style={{ marginTop: 12 }}>{offer.validityDays} jour(s) de validité · {offer.maxDevices} appareil(s)</p><strong style={{ display: 'block', marginTop: 18 }}>{money(offer)}</strong>
        </button>)}
      </div>
      {!order && <>
        <h2>Vos coordonnées</h2>
        <form className="form-stack" onSubmit={subscribe}>
          <label>Nom complet<input value={customerName} onChange={(e) => setCustomerName(e.target.value)} minLength={2} maxLength={160} required /></label>
          <label>Adresse e-mail<input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} maxLength={254} required /></label>
          <label>Téléphone de contact (facultatif)<input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} maxLength={32} placeholder="0341234567" /></label>
          <button className="primary-link" type="submit" disabled={submitting || !offerId}>{submitting ? 'Création de la commande…' : 'Créer la commande et voir les instructions de paiement'}</button>
        </form>
      </>}
    </> : !error ? <p>Aucune offre active n’est disponible sur ce portail pour le moment.</p> : null}

    {order && <section className="module" style={{ marginTop: 24, minHeight: 0 }}>
      <span className="module-number">COMMANDE CRÉÉE</span><h2>Référence : {order.reference}</h2>
      <p>Forfait : {order.offer_name}</p>
      <p>Montant à envoyer : <strong>{Number(order.amount).toLocaleString('fr-FR')} {order.currency}</strong></p>
      <p>État : {submissionState?.status === 'submitted' ? 'justificatif en attente de vérification' : order.status === 'paid' ? 'payée' : 'paiement en attente'}.</p>
      {!submissionState && <>
        <h2 style={{ marginTop: 24 }}>1. Envoyez le montant au bénéficiaire</h2>
        {paymentMethods.length ? <>
          <div className="module-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', margin: '14px 0' }}>
            {paymentMethods.map((method) => <button key={method.provider} type="button" className="module" aria-pressed={selectedProvider === method.provider} onClick={() => setSelectedProvider(method.provider)} style={{ textAlign: 'left', cursor: 'pointer', borderColor: selectedProvider === method.provider ? '#087f75' : undefined, background: selectedProvider === method.provider ? '#e4f3f1' : 'white', color: '#102e3b' }}>
              <span className="module-number">{providerLabel[method.provider]}</span><h3>{method.accountNumber}</h3><p>Bénéficiaire : <strong>{method.accountName}</strong></p>{method.instructions && <p>{method.instructions}</p>}
            </button>)}
          </div>
          <p>Vérifiez le nom du bénéficiaire avant de confirmer le transfert. Envoyez exactement le montant indiqué et conservez le reçu.</p>
          <h2 style={{ marginTop: 24 }}>2. Envoyez votre justificatif</h2>
          <form className="form-stack" onSubmit={sendProof}>
            <label>Numéro depuis lequel vous avez envoyé l’argent<input type="tel" value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} pattern="03[0-9]{8}" maxLength={10} placeholder="0341234567" required /></label>
            <label>Référence de la transaction<input value={transactionReference} onChange={(e) => setTransactionReference(e.target.value)} minLength={2} maxLength={120} required placeholder="Référence visible sur le reçu" /></label>
            <label>Justificatif (JPG, PNG, WEBP ou PDF, 5 Mo maximum)<input id="payment-proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setProof(e.target.files?.[0] ?? null)} required /></label>
            <label>Note (facultatif)<textarea value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} maxLength={1000} rows={2} placeholder="Information utile pour rapprocher le paiement."/></label>
            <button className="primary-link" type="submit" disabled={sendingProof || !selectedProvider || !proof}>{sendingProof ? 'Envoi du justificatif…' : 'Transmettre le justificatif'}</button>
          </form>
          {proofError && <p role="alert">{proofError}</p>}
        </> : <p role="alert">Les moyens de paiement ne sont pas encore configurés. Contactez le responsable du portail avant d’envoyer de l’argent.</p>}
      </>}
      {submissionState && <div role="status"><h2>Justificatif transmis</h2><p>{submissionState.message}</p><p>Référence de commande : <strong>{order.reference}</strong></p><p>Le responsable vérifiera la transaction avant de valider le paiement.</p></div>}
      <p style={{ marginTop: 24 }}><a href={'/paiement/' + encodeURIComponent(order.reference)}>Consulter le statut du paiement</a></p>
      <p><strong>Un reçu téléversé ne valide pas automatiquement le paiement. L’accès Internet ne sera pas activé par le seul envoi du justificatif.</strong></p>
    </section>}
    {error && <p role="alert">{error}</p>}
    <p style={{ marginTop: 28 }}><a href="/">ZARAY</a></p>
  </section></main>;
}
