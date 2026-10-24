'use client';
import { useEffect, useState } from 'react';
type Company = { id: string; legal_name: string; slug: string; role: string };
type Site = { id: string; company_id: string; company_name: string; name: string; status: string; created_at: string };
const statusLabels: Record<string, string> = { planned: 'Planifié', active: 'Actif', suspended: 'Suspendu', archived: 'Archivé' };

export default function DashboardPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch('/api/sites', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Impossible de charger le tableau de bord.');
        if (active) { setCompanies(data.companies || []); setSites(data.sites || []); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Une erreur est survenue.'); }
      finally { if (active) setBusy(false); }
    }
    load(); return () => { active = false; };
  }, []);

  return <main className="form-shell"><section className="form-card" style={{ width: 'min(100%, 1000px)' }}>
    <p className="eyebrow">ZARAY · ESPACE ADMINISTRATEUR</p><h1>Tableau de bord</h1>
    <p>Vue d’ensemble de vos entreprises et de leurs sites. Les données affichées proviennent de votre session et de vos autorisations.</p>
    {busy ? <p role="status">Chargement de votre espace…</p> : error ? <p role="alert">{error}</p> : <>
      <div className="module-grid" style={{ margin: '26px 0' }}>
        <article className="module"><span className="module-number">01 · ENTREPRISES</span><h3>{companies.length}</h3><p>Entreprise(s) accessible(s)</p></article>
        <article className="module"><span className="module-number">02 · SITES</span><h3>{sites.length}</h3><p>Site(s) enregistré(s)</p></article>
        <article className="module"><span className="module-number">03 · COMPTE</span><h3>Actif</h3><p>Session authentifiée requise</p></article>
      </div>
      <div className="section-head"><div><div className="eyebrow">VOTRE ORGANISATION</div><h2>Entreprises</h2></div><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><a className="primary-link" href="/entreprises/nouvelle">Ajouter une entreprise →</a><a className="primary-link" href="/membres">Gérer les membres →</a></div></div>
      {companies.length ? <div className="module-grid">{companies.map((company) => <article className="module" key={company.id}>
        <span className="module-number">{company.role || 'Membre'}</span><h3>{company.legal_name}</h3><p>Identifiant : {company.slug}</p><span className="module-status">Accès autorisé</span>
        <p style={{ marginTop: 16 }}><a href={'/portail/' + encodeURIComponent(company.slug)}>Ouvrir le portail public →</a></p>
      </article>)}</div> : <p>Aucune entreprise liée à ce compte. Créez votre première entreprise pour commencer.</p>}
      <div className="section-head" style={{ marginTop: 36 }}><div><div className="eyebrow">IMPLANTATIONS</div><h2>Sites</h2></div><a className="primary-link" href="/sites">Gérer les sites →</a></div>
      {sites.length ? <div className="module-grid">{sites.map((site) => <article className="module" key={site.id}><span className="module-number">SITE</span><h3>{site.name}</h3><p>{site.company_name}</p><span className="module-status">{statusLabels[site.status] || site.status}</span></article>)}</div> : <p>Aucun site enregistré pour le moment.</p>}
      <div className="section-head" style={{ marginTop: 36 }}><div><div className="eyebrow">PARCOURS WI-FI</div><h2>Souscriptions et tickets</h2></div></div>
      <div className="module-grid">
        <article className="module"><span className="module-number">07 · PORTAIL CAPTIF</span><h3>Commandes</h3><p>Suivre les souscriptions et les paiements en attente.</p><p style={{ marginTop: 18 }}><a href="/commandes">Ouvrir les commandes →</a></p></article>
        <article className="module"><span className="module-number">08 · TICKETS WI-FI</span><h3>Tickets</h3><p>Émission sécurisée après confirmation du paiement et révocation des codes inutilisés.</p><p style={{ marginTop: 18 }}><a href="/tickets">Gérer les tickets →</a></p></article>
        <article className="module"><span className="module-number">RÈGLE DE SÉCURITÉ</span><h3>Activation contrôlée</h3><p>Aucune commande ni offre active n’active Internet automatiquement. Les intégrations paiement et réseau restent à finaliser.</p></article>
      </div>
    </>}
    <p style={{ marginTop: 32 }}><a href="/">← Accueil</a> · <a href="/sites">Sites</a> · <a href="/membres">Membres</a> · <a href="/clients">Clients</a> · <a href="/offres">Offres Internet</a> · <a href="/commandes">Commandes</a> · <a href="/tickets">Tickets Wi-Fi</a></p>
  </section></main>;
}
