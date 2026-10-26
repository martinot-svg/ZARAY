'use client';
import { ZarayIcon } from '@/components/ui/zaray-icon';

import { useEffect, useState } from 'react';
import AppShell from '@/components/app-shell';
import { MotionFeedback, MotionSkeleton } from '@/components/motion';
import { activeSiteId,scopedQuery,selectedCompany,switchCompany } from '@/lib/workspace-url';

type Company = { id: string; legal_name: string; role: string };
type Site = { id: string; company_id: string; name: string; status: string };
type Offer = { id: string; company_id: string; name: string; description: string; duration_minutes: number; validity_days: number; price_amount: number | string; currency: string; max_devices: number; status: string };
type Sale = { id: string; site_id: string | null; receipt_number: string; ticket_code_prefix: string; customer_name: string; customer_phone: string | null; offer_name: string; amount: number | string; currency: string; duration_minutes: number; validity_days: number; max_devices: number; payment_method: string; ticket_status: string; valid_from: string; valid_until: string; created_at: string };

const paymentLabels: Record<string, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement',
  card: 'Carte',
  other: 'Autre',
};

const statusLabels: Record<string, string> = { issued: 'Émis', redeemed: 'Utilisé', expired: 'Expiré', revoked: 'Révoqué' };

export default function CaissePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [siteId, setSiteId] = useState('');
  const [offerId, setOfferId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [sales, setSales] = useState<Sale[]>([]);
  const [generatedCode, setGeneratedCode] = useState('');
  const [generatedSale, setGeneratedSale] = useState<Sale | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadCompanyData(id: string) {
    if (!id) return;
    const [sitesResponse, offersResponse, salesResponse] = await Promise.all([
      fetch('/api/sites?companyId=' + encodeURIComponent(id), { cache: 'no-store' }),
      fetch('/api/offers?' + scopedQuery(id), { cache: 'no-store' }),
      fetch('/api/caisse?' + scopedQuery(id), { cache: 'no-store' }),
    ]);
    const [sitesData, offersData, salesData] = await Promise.all([sitesResponse.json(), offersResponse.json(), salesResponse.json()]);
    if (!sitesResponse.ok) throw new Error(sitesData.error || 'Impossible de charger les sites.');
    if (!offersResponse.ok) throw new Error(offersData.error || 'Impossible de charger les offres.');
    if (!salesResponse.ok) throw new Error(salesData.error || 'Impossible de charger les ventes.');
    setSites((sitesData.sites ?? []).filter((site: Site) => site.status === 'active' && site.company_id===id && (!activeSiteId()||site.id===activeSiteId())));
    if(activeSiteId())setSiteId(activeSiteId()||'');
    setOffers((offersData.offers ?? []).filter((offer: Offer) => offer.status === 'active'));
    setSales(salesData.sales ?? []);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/sites', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Impossible de charger votre espace.');
        if (!active) return;
        setCompanies(data.companies ?? []);
        
        setCompanyId(selectedCompany(data.companies??[],data.sites??[]));
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement.');
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    setBusy(true);
    (async () => {
      try {
        await loadCompanyData(companyId);
        if (!active) return;
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement.');
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => { active = false; };
  }, [companyId]);

  const selectedOffer = offers.find((offer) => offer.id === offerId) ?? null;
  const selectedSite = sites.find((site) => site.id === siteId) ?? null;

  async function generateTicket() {
    setError('');
    setNotice('');
    setGeneratedCode('');
    setGeneratedSale(null);
    if (!companyId || !siteId || !offerId || !customerName.trim()) {
      setError('Choisissez un site actif, une offre et renseignez le nom du client occasionnel.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/caisse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, siteId, offerId, customerName: customerName.trim(), customerPhone: customerPhone.trim() || null, paymentMethod: 'cash' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Génération impossible.');
      const sale = data.sale as Sale;
      setGeneratedSale(sale);
      setGeneratedCode(data.code as string);
      setNotice('Paiement enregistré et ticket Wi-Fi généré. Le code ci-dessous est affiché une seule fois.');
      setCustomerName('');
      setCustomerPhone('');
      await loadCompanyData(companyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Génération impossible.');
    } finally {
      setSaving(false);
    }
  }

  function printDocument(kind: 'receipt' | 'ticket') {
    document.body.dataset.zarayPrint = kind;
    window.addEventListener('afterprint', () => { delete document.body.dataset.zarayPrint; }, {once: true});
    window.print();
  }

  return (
    <>
      <div className="screen-only">
        <AppShell activePath="/caisse" eyebrow="VENTE RAPIDE · CLIENTS OCCASIONNELS" title="Caisse & tickets" description="Encaissez un client de passage, générez immédiatement son reçu et son ticket Wi-Fi imprimable.">
          {companies.length > 1 && <label>Entreprise<select value={companyId} onChange={(e) => switchCompany('/caisse',e.target.value)}>{companies.map((company) => <option key={company.id} value={company.id}>{company.legal_name}</option>)}</select></label>}

          <section className="module-grid" style={{ alignItems: 'start' }}>
            <article className="panel">
              <div className="panel-head"><div><div className="panel-title">Nouvelle vente</div><div className="muted">Client occasionnel · paiement immédiat · ticket Wi-Fi</div></div><span className="status-pill">Caisse</span></div>
              <div className="form-grid">
                <label>Nom du client<input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ex. Rakoto Jean" autoComplete="off" /></label>
                <label>Téléphone <span className="muted">(facultatif)</span><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="03x xx xxx xx" inputMode="tel" /></label>
                <label>Site actif<select value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!!activeSiteId()}><option value="">Choisir un site actif…</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
                <label>Offre Wi-Fi<select value={offerId} onChange={(e) => setOfferId(e.target.value)}><option value="">Choisir une offre…</option>{offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.name} · {Number(offer.price_amount).toLocaleString('fr-FR')} {offer.currency}</option>)}</select></label>
                <label>Mode de paiement<select value="cash" disabled><option value="cash">Espèces · encaissé au comptoir</option></select></label>
              </div>
              {selectedOffer && <div className="module" style={{ marginTop: 18, minHeight: 0 }}><div className="module-number">OFFRE SÉLECTIONNÉE</div><h3>{selectedOffer.name}</h3><p>{selectedOffer.description}</p><p><strong>{Number(selectedOffer.price_amount).toLocaleString('fr-FR')} {selectedOffer.currency}</strong> · {selectedOffer.duration_minutes} min · {selectedOffer.max_devices} appareil(s) · validité {selectedOffer.validity_days} jour(s)</p>{selectedSite && <p>Site : {selectedSite.name}</p>}</div>}
              <button className="primary-link" type="button" onClick={generateTicket} disabled={saving || busy || !siteId || !offerId || !customerName.trim()} style={{ marginTop: 18 }}><ZarayIcon name="ticket" size={18} /> {saving ? 'Génération…' : 'Encaisser & générer le ticket'}</button>
              <MotionFeedback message={error || notice} kind={error ? 'error' : 'success'}/>
            </article>

            <article className="panel">
              <div className="panel-head"><div><div className="panel-title">Dernier ticket</div><div className="muted">Prêt à imprimer ou à remettre au client.</div></div></div>
              {generatedSale && generatedCode ? <div className="receipt-preview"><div id="receipt-print">
                <div className="receipt-brand">ZARAY<span>.</span></div>
                <div className="receipt-label">REÇU DE PAIEMENT · TICKET WI-FI</div>
                <div className="receipt-row"><span>Référence</span><strong>{generatedSale.receipt_number}</strong></div>
                <div className="receipt-row"><span>Client</span><strong>{generatedSale.customer_name}</strong></div>
                {generatedSale.customer_phone && <div className="receipt-row"><span>Téléphone</span><strong>{generatedSale.customer_phone}</strong></div>}
                <div className="receipt-row"><span>Offre</span><strong>{generatedSale.offer_name}</strong></div>
                <div className="receipt-row"><span>Paiement</span><strong>{paymentLabels[generatedSale.payment_method] ?? generatedSale.payment_method}</strong></div>
                <div className="receipt-total"><span>TOTAL ENCAISSÉ</span><strong>{Number(generatedSale.amount).toLocaleString('fr-FR')} {generatedSale.currency}</strong></div>
                <p className="receipt-note">Reçu d'encaissement en espèces. Le ticket d'accès est un document distinct.</p>
                </div>
                <div id="ticket-print">
                <div className="receipt-label">TICKET WI-FI · CLIENT OCCASIONNEL</div>
                <div className="receipt-row"><span>Client</span><strong>{generatedSale.customer_name}</strong></div>
                <div className="receipt-row"><span>Offre</span><strong>{generatedSale.offer_name}</strong></div>
                <div className="wifi-code-label">CODE DE TICKET À USAGE UNIQUE</div>
                <div className="wifi-code">{generatedCode}</div>
                <div className="receipt-row"><span>Validité</span><strong>{generatedSale.validity_days} jour(s)</strong></div>
                <div className="receipt-row"><span>Appareils</span><strong>{generatedSale.max_devices}</strong></div>
                <p className="receipt-note">Conservez ce code. La connexion n'est possible qu'après configuration effective du réseau MikroTik/RADIUS.</p>
                </div>
                <div className="screen-only" style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}>
                  <button type="button" onClick={() => printDocument('receipt')} className="primary-link"><ZarayIcon name="print" size={18} /> Imprimer le reçu de caisse</button>
                  <button type="button" onClick={() => printDocument('ticket')} className="primary-link"><ZarayIcon name="print" size={18} /> Imprimer le ticket Wi-Fi</button>
                </div>
              </div> : <div className="empty-state"><strong>Aucun ticket généré dans cette session</strong><p>Une fois la vente enregistrée, le reçu et le code Wi-Fi apparaîtront ici.</p></div>}
            </article>
          </section>

          <section className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head"><div><div className="panel-title">Ventes récentes</div><div className="muted">Historique des tickets générés pour les clients occasionnels.</div></div></div>
            {busy ? <MotionSkeleton rows={3}/> : sales.length ? <div className="data-list">{sales.slice(0, 20).map((sale) => <div className="data-row" key={sale.id}><div><strong>{sale.receipt_number}</strong><div className="muted">{sale.customer_name} · {sale.offer_name} · {paymentLabels[sale.payment_method] ?? sale.payment_method}</div></div><div style={{ textAlign: 'right' }}><strong>{Number(sale.amount).toLocaleString('fr-FR')} {sale.currency}</strong><div className="muted">{statusLabels[sale.ticket_status] ?? sale.ticket_status}</div></div></div>)}</div> : <div className="empty-state"><strong>Aucune vente occasionnelle</strong><p>Les encaissements réalisés depuis cette caisse apparaîtront ici.</p></div>}
          </section>
        </AppShell>
      </div>
      <style jsx global>{`
        .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}.form-grid label{display:grid;gap:7px;font-weight:650}.receipt-preview{background:#fff;color:#111;border:1px dashed #999;padding:24px;max-width:430px;margin:0 auto}.receipt-brand{font-size:28px;font-weight:900;letter-spacing:-.06em}.receipt-brand span{color:#777}.receipt-label{font-size:11px;letter-spacing:.12em;margin:14px 0 18px}.receipt-row{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #eee;font-size:13px}.receipt-total{display:flex;justify-content:space-between;padding:16px 0;font-size:18px}.wifi-code-label{font-size:11px;letter-spacing:.16em;text-align:center;margin-top:10px}.wifi-code{font:800 23px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center;padding:14px 8px;border:2px dashed #222;letter-spacing:.08em;margin:8px 0 14px}.receipt-note{font-size:11px;line-height:1.5;margin:16px 0}.screen-only{display:block}@media(max-width:760px){.form-grid{grid-template-columns:1fr}}@media print{body{background:#fff!important}body *{visibility:hidden!important}body[data-zaray-print="receipt"] #receipt-print,body[data-zaray-print="receipt"] #receipt-print *,body[data-zaray-print="ticket"] #ticket-print,body[data-zaray-print="ticket"] #ticket-print *{visibility:visible!important}#receipt-print,#ticket-print{position:absolute!important;left:0;top:0;width:80mm;max-width:80mm;background:#fff;padding:0;box-shadow:none}@page{size:80mm auto;margin:5mm}}
      `}</style>
    </>
  );
}
