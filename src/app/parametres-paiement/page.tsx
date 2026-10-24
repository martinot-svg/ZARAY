'use client';
import { useEffect, useState, type FormEvent } from 'react';

type Company = { id: string; legal_name: string; role: string };
type Provider = 'orange_money' | 'mvola';
type Method = { id?: string; company_id?: string; provider: Provider; account_number: string; account_name: string; instructions: string; is_active: boolean; updated_at?: string };
const providers: { id: Provider; label: string; help: string }[] = [
  { id: 'orange_money', label: 'Orange Money', help: 'Numéro Orange Money qui reçoit les paiements des clients.' },
  { id: 'mvola', label: 'MVola', help: 'Numéro MVola qui reçoit les paiements des clients.' },
];
const emptyMethod = (provider: Provider): Method => ({ provider, account_number: '', account_name: '', instructions: '', is_active: false });

export default function ParametresPaiementPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [methods, setMethods] = useState<Record<Provider, Method>>({ orange_money: emptyMethod('orange_money'), mvola: emptyMethod('mvola') });
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState<Provider | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function loadMethods(id: string) {
    if (!id) return;
    const response = await fetch('/api/manual-payments/methods?companyId=' + encodeURIComponent(id), { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible de charger les coordonnées de paiement.');
    const next = { orange_money: emptyMethod('orange_money'), mvola: emptyMethod('mvola') };
    for (const method of (data.methods ?? []) as Method[]) next[method.provider] = { ...method };
    setMethods(next);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/sites', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Impossible de charger les entreprises.');
        if (!active) return;
        setCompanies(data.companies ?? []);
        if (data.companies?.[0]) setCompanyId(data.companies[0].id);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    setBusy(true); setError(''); setNotice('');
    loadMethods(companyId).catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Erreur de chargement.'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [companyId]);

  function change(provider: Provider, field: 'account_number' | 'account_name' | 'instructions' | 'is_active', value: string | boolean) {
    setMethods((current) => ({ ...current, [provider]: { ...current[provider], [field]: value } }));
  }

  async function save(event: FormEvent<HTMLFormElement>, provider: Provider) {
    event.preventDefault(); setError(''); setNotice(''); setSaving(provider);
    const method = methods[provider];
    try {
      const response = await fetch('/api/manual-payments/methods', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, provider, accountNumber: method.account_number, accountName: method.account_name, instructions: method.instructions, isActive: method.is_active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Enregistrement impossible.');
      setMethods((current) => ({ ...current, [provider]: { ...data.method } }));
      setNotice(providers.find((item) => item.id === provider)?.label + ' enregistré.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); }
    finally { setSaving(null); }
  }

  return <main className="form-shell"><section className="form-card" style={{ maxWidth: 1000, width: 'min(100%,1000px)' }}>
    <p className="eyebrow">ZARAY · CONFIGURATION</p><h1>Moyens de paiement manuels</h1>
    <p>Configure les numéros sur lesquels les clients doivent envoyer l’argent. Seuls le dirigeant et les administrateurs autorisés peuvent enregistrer ces coordonnées.</p>
    {companies.length > 0 && <label>Entreprise<select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>{companies.map((company) => <option key={company.id} value={company.id}>{company.legal_name} · {company.role}</option>)}</select></label>}
    {companies.length === 0 && !busy && <p>Aucune entreprise accessible.</p>}
    {providers.map((provider) => {
      const method = methods[provider.id];
      return <article className="module" key={provider.id} style={{ marginTop: 24, minHeight: 0 }}>
        <h2>{provider.label}</h2><p>{provider.help}</p>
        <form className="form-stack" onSubmit={(event) => save(event, provider.id)}>
          <label>Numéro bénéficiaire<input type="tel" value={method.account_number} onChange={(e) => change(provider.id, 'account_number', e.target.value)} placeholder="0341234567" pattern="03[0-9]{8}" maxLength={10} required /></label>
          <label>Nom affiché du bénéficiaire<input value={method.account_name} onChange={(e) => change(provider.id, 'account_name', e.target.value)} minLength={2} maxLength={120} required /></label>
          <label>Instructions au client (facultatif)<textarea value={method.instructions} onChange={(e) => change(provider.id, 'instructions', e.target.value)} maxLength={1000} rows={3} placeholder="Ex. Indiquez la référence de commande dans le motif du transfert."/></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}><input type="checkbox" checked={method.is_active} onChange={(e) => change(provider.id, 'is_active', e.target.checked)} /> Activer ce moyen de paiement sur le portail</label>
          <button className="primary-link" type="submit" disabled={busy || saving !== null || !companyId}>{saving === provider.id ? 'Enregistrement…' : 'Enregistrer ' + provider.label}</button>
          {method.updated_at && <small>Mis à jour le {new Date(method.updated_at).toLocaleString('fr-FR')}</small>}
        </form>
      </article>;
    })}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    <p style={{ marginTop: 28 }}><a href="/paiements/verification">Vérifier les paiements →</a> · <a href="/tableau-de-bord">Tableau de bord</a></p>
  </section></main>;
}
