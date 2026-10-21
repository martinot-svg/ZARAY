'use client';

import { useEffect, useState, type FormEvent } from 'react';

type Site = { id: string; company_id: string; company_name: string; company_slug: string; name: string; status: string; created_at: string };

type CompanyOption = { id: string; legal_name: string; slug: string };

const statusLabels: Record<string, string> = { planned: 'Planifié', active: 'Actif', suspended: 'Suspendu', archived: 'Archivé' };

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');

  async function load() {
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/sites', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de charger les sites.');
      setSites(data.sites || []);
      if (!companyId && data.sites?.[0]) setCompanyId(data.sites[0].company_id);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Erreur de chargement.'); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);

  const companies: CompanyOption[] = Array.from(new Map(sites.map(s => [s.company_id, { id: s.company_id, legal_name: s.company_name, slug: s.company_slug }])).values());

  async function createSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice('');
    if (!companyId) { setNotice('Aucune entreprise accessible.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Création impossible.');
      setName('');
      await load();
      setNotice('Site créé avec succès.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Création impossible.'); setBusy(false); }
  }

  async function updateSite(site: Site, status: string) {
    setNotice('');
    const nextName = window.prompt('Nom du site', site.name)?.trim();
    if (!nextName) return;
    setBusy(true);
    try {
      const response = await fetch('/api/sites', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId: site.id, name: nextName, status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Modification impossible.');
      await load();
      setNotice('Site mis à jour.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Modification impossible.'); setBusy(false); }
  }

  return <main className="form-shell"><section className="form-card" style={{ maxWidth: 920 }}>
    <p className="eyebrow">ZARAY · MODULE 2</p>
    <h1>Entreprise & sites</h1>
    <p>Gérez les sites rattachés à vos entreprises. Chaque requête est filtrée par votre appartenance à l’entreprise et les rôles autorisés.</p>

    <h2>Nouveau site</h2>
    <form onSubmit={createSite} className="form-stack">
      <label>Entreprise<select value={companyId} onChange={e => setCompanyId(e.target.value)} required><option value="">Sélectionner</option>{companies.map(c => <option key={c.id} value={c.id}>{c.legal_name}</option>)}</select></label>
      <label>Nom du site<input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={120} placeholder="Ex. Antananarivo Centre" /></label>
      <button className="primary-link" type="submit" disabled={busy || !companyId}>{busy ? 'Traitement…' : 'Créer le site'}</button>
    </form>

    <h2 style={{ marginTop: 32 }}>Sites accessibles</h2>
    {busy && !sites.length ? <p>Chargement…</p> : sites.length ? <div className="module-grid">{sites.map(site => <article className="module" key={site.id}><span className="module-number">SITE</span><h3>{site.name}</h3><p>{site.company_name}</p><span className="module-status">{statusLabels[site.status] || site.status}</span><button type="button" onClick={() => updateSite(site, site.status)} disabled={busy}>Modifier</button></article>)}</div> : <p>Aucun site n’est encore enregistré.</p>}
    {notice && <p role="status" aria-live="polite">{notice}</p>}
    <p><a href="/">← Accueil</a> · <a href="/connexion">Se connecter</a></p>
  </section></main>;
}
