'use client';

import { useEffect, useState, type FormEvent } from 'react';

type Site = { id: string; company_id: string; company_name: string; company_slug: string; name: string; status: string; created_at: string };
type CompanyOption = { id: string; legal_name: string; slug: string };

const statusLabels: Record<string, string> = { planned: 'Planifié', active: 'Actif', suspended: 'Suspendu', archived: 'Archivé' };
const statusOptions = [
  { value: 'planned', label: 'Planifié' },
  { value: 'active', label: 'Actif' },
  { value: 'suspended', label: 'Suspendu' },
  { value: 'archived', label: 'Archivé' },
];

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');

  async function load(showLoading = true) {
    if (showLoading) setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/sites', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de charger les entreprises et sites.');
      setCompanies(data.companies || []);
      setSites(data.sites || []);
      if (!companyId && data.companies?.[0]) setCompanyId(data.companies[0].id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Erreur de chargement.');
    } finally {
      if (showLoading) setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    if (!companyId) { setNotice('Aucune entreprise accessible.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Création impossible.');
      setName('');
      await load(false);
      setNotice('Site créé avec succès.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function saveSite(site: Site, nextName: string, status: string) {
    setNotice('');
    setBusy(true);
    try {
      const response = await fetch('/api/sites', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId: site.id, name: nextName, status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Modification impossible.');
      await load(false);
      setNotice('Site mis à jour.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Modification impossible.');
    } finally {
      setBusy(false);
    }
  }

  function renameSite(site: Site) {
    const nextName = window.prompt('Nouveau nom du site', site.name)?.trim();
    if (nextName && nextName !== site.name) void saveSite(site, nextName, site.status);
  }

  return <main className="form-shell"><section className="form-card" style={{ maxWidth: 920 }}>
    <p className="eyebrow">ZARAY · MODULE 1</p>
    <h1>Entreprise & sites</h1>
    <p>Gérez les sites rattachés à vos entreprises. Les opérations sont limitées aux entreprises dont vous êtes membre et aux rôles autorisés.</p>

    <h2>Nouveau site</h2>
    {companies.length === 0 && !busy && <p>Vous devez d’abord enregistrer une entreprise.</p>}
    <form onSubmit={createSite} className="form-stack">
      <label>Entreprise<select value={companyId} onChange={e => setCompanyId(e.target.value)} required><option value="">Sélectionner</option>{companies.map(c => <option key={c.id} value={c.id}>{c.legal_name}</option>)}</select></label>
      <label>Nom du site<input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={120} placeholder="Ex. Antananarivo Centre" /></label>
      <button className="primary-link" type="submit" disabled={busy || !companyId}>{busy ? 'Traitement…' : 'Créer le site'}</button>
    </form>

    <h2 style={{ marginTop: 32 }}>Sites accessibles</h2>
    {busy && !sites.length ? <p>Chargement…</p> : sites.length ? <div className="module-grid">{sites.map(site => <article className="module" key={site.id}>
      <span className="module-number">SITE</span><h3>{site.name}</h3><p>{site.company_name}</p>
      <label style={{ display: 'grid', gap: 8, marginTop: 18, fontSize: 13 }}>Statut
        <select aria-label={'Statut de ' + site.name} value={site.status} disabled={busy} onChange={e => void saveSite(site, site.name, e.target.value)}>
          {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <span className="module-status">{statusLabels[site.status] || site.status}</span>
      <button type="button" onClick={() => renameSite(site)} disabled={busy} style={{ marginTop: 16 }}>Renommer le site</button>
    </article>)}</div> : <p>Aucun site n’est encore enregistré.</p>}
    {notice && <p role="status" aria-live="polite">{notice}</p>}
    <p><a href="/tableau-de-bord">Tableau de bord</a> · <a href="/">Accueil</a> · <a href="/connexion">Se connecter</a></p>
  </section></main>;
}
