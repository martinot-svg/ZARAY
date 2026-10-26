'use client';
import BrandLogo from '@/components/brand-logo';
import { useEffect, useState } from 'react';
import WorkspaceBreadcrumb from '@/components/workspace-breadcrumb';
import { activeSiteId, scopedQuery, selectedCompany, switchCompany } from '@/lib/workspace-url';
import { MotionFeedback, MotionSkeleton } from '@/components/motion';
type Company = { id: string; legal_name: string; role: string };
type Order = { id: string; public_reference: string; customer_name: string; customer_email: string; customer_phone: string | null; offer_name: string; amount: number | string; currency: string; status: string; created_at: string; paid_at: string | null; activated_at: string | null };
type CashReceipt = {receipt_number:string;public_reference:string;customer_name:string;offer_name:string;amount:number|string;currency:string;paid_at:string;payment_method:string};
const statusLabel: Record<string, string> = { pending_payment: 'Paiement en attente', paid: 'Payée', cancelled: 'Annulée', expired: 'Expirée', activation_pending: 'Activation en attente', active: 'Active', failed: 'Échec' };

export default function OrdersPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [recordingId, setRecordingId] = useState('');
  const [receipt, setReceipt] = useState<CashReceipt | null>(null);
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
  useEffect(() => {
    if (!companyId) { setOrders([]); return; }
    let active = true; setBusy(true);
    (async () => {
      try {
        const response = await fetch('/api/subscription-orders?' + scopedQuery(companyId), { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Impossible de charger les commandes.');
        if (active) setOrders(data.orders ?? []);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Erreur.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [companyId]);

  async function collectCash(orderId: string) {
    if (!window.confirm('Confirmez-vous avoir réellement reçu le paiement en espèces de ce client ?')) return;
    setRecordingId(orderId); setError(''); setNotice(''); setReceipt(null);
    try {
      const r = await fetch('/api/subscription-orders', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({orderId}) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Encaissement impossible.');
      setReceipt(d.receipt as CashReceipt);
      setOrders(previous => previous.map(o => o.id === orderId ? {...o, status:'paid', paid_at:d.receipt.paid_at} : o));
      setNotice('Paiement en espèces enregistré. Reçu disponible ci-dessous.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Encaissement impossible.'); }
    finally { setRecordingId(''); }
  }

  return <main className="form-shell"><section className="form-card" style={{ maxWidth: 1100, width: 'min(100%,1100px)' }}>
      <div className="workspace-brand"><a href="/" aria-label="ZARAY · Accueil"><BrandLogo /></a></div>
    <WorkspaceBreadcrumb companyId={companyId}/><p className="eyebrow">ZARAY · MODULE 7 · SOUSCRIPTIONS</p><h1>Commandes du portail captif</h1>
    <p>Les commandes publiques sont enregistrées avec un montant et un forfait figés. Leur création ne vaut ni paiement confirmé ni activation Internet.</p>
    {companies.length > 0 && <label>Entreprise<select value={companyId} onChange={(e) => switchCompany('/commandes',e.target.value)}>{companies.map((c) => <option key={c.id} value={c.id}>{c.legal_name}</option>)}</select></label>}
    {companies.length === 0 && !busy && <p>Aucune entreprise accessible.</p>}
    {busy ? <MotionSkeleton rows={3}/> : orders.length ? <div className="module-grid" style={{ marginTop: 24 }}>
      {orders.map((o) => <article className="module" key={o.id}>
        <span className="module-number">{statusLabel[o.status] ?? o.status}</span><h3>{o.offer_name}</h3><p>Référence : <strong>{o.public_reference}</strong></p>
        <p>{o.customer_name} · {o.customer_email}</p>{o.customer_phone && <p>{o.customer_phone}</p>}
        <p style={{ marginTop: 10 }}>{Number(o.amount).toLocaleString('fr-FR')} {o.currency}</p>
        <span className="module-status">Créée le {new Date(o.created_at).toLocaleString('fr-FR')}</span>
        {o.status === 'pending_payment' && <><p style={{ marginTop: 12 }}><strong>Pas de ticket : paiement non confirmé.</strong></p>{companies.find(c => c.id === companyId && (c.role === 'owner' || c.role === 'admin')) && <button type="button" className="primary-link" disabled={!!recordingId} onClick={() => collectCash(o.id)} style={{marginTop:12}}>{recordingId === o.id ? 'Enregistrement…' : 'Encaisser en espèces et créer le reçu'}</button>}</>}
        {o.status === 'paid' && !o.activated_at && <p style={{ marginTop: 12 }}>Paiement confirmé. Le ticket peut être émis ; l’accès réseau n’est pas encore activé.</p>}
        {o.activated_at && <p style={{ marginTop: 12 }}>Activation enregistrée le {new Date(o.activated_at).toLocaleString('fr-FR')}</p>}
      </article>)}
    </div> : !busy ? <p>Aucune commande pour cette entreprise. Le portail public sera accessible via <code>/portail/identifiant-entreprise</code>.</p> : null}
    <MotionFeedback message={error || notice} kind={error ? 'error' : 'success'}/>
    {receipt && <section id="cash-receipt" className="module" style={{minHeight:0,maxWidth:460,marginTop:22}}>
      <p className="eyebrow">REÇU DE PAIEMENT D’ABONNEMENT · ESPÈCES</p>
      <h2>ZARAY · Reçu</h2>
      <p>Référence reçu : <strong>{receipt.receipt_number}</strong></p>
      <p>Commande : {receipt.public_reference}</p>
      <p>Client : {receipt.customer_name}</p>
      <p>Abonnement : {receipt.offer_name}</p>
      <h2>{Number(receipt.amount).toLocaleString('fr-FR')} {receipt.currency}</h2>
      <p>Payé en espèces le {new Date(receipt.paid_at).toLocaleString('fr-FR')}</p>
      <p>Ce reçu atteste du règlement de l'abonnement. Il ne constitue pas un identifiant Wi-Fi ni une activation du réseau.</p>
      <button type="button" className="primary-link receipt-print-button" style={{marginTop:18}} onClick={() => window.print()}>Imprimer le reçu d'abonnement</button>
    </section>}
    
    <p style={{ marginTop: 28 }}><a href="/tickets">Gestion des tickets Wi-Fi →</a> · <a href="/offres">Offres</a> · <a href="/tableau-de-bord">Tableau de bord</a></p>
  </section><style jsx global>{`@media print{body *{visibility:hidden!important}#cash-receipt,#cash-receipt *{visibility:visible!important}#cash-receipt{position:absolute!important;top:0;left:0;width:80mm;max-width:80mm;box-shadow:none;border:0;padding:4mm}.receipt-print-button{display:none!important}@page{size:80mm auto;margin:5mm}}`}</style></main>;
}
