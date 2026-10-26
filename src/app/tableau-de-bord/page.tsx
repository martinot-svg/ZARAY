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
        if (!response.ok) throw new Error(data.error || 'Impossible de charger votre espace.');
        if (active) { setCompanies(data.companies || []); setSites(data.sites || []); }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
      } finally { if (active) setBusy(false); }
    }
    load();
    return () => { active = false; };
  }, []);

  if (busy) return <main className="form-shell"><section className="form-card"><p className="eyebrow">ZARAY · ESPACE ADMINISTRATEUR</p><h1>Chargement de votre espace</h1><p role="status">Nous récupérons vos entreprises et vos sites…</p></section></main>;
  if (error) return <main className="form-shell"><section className="form-card"><p className="eyebrow">ZARAY · ESPACE ADMINISTRATEUR</p><h1>Impossible de charger le tableau de bord</h1><p role="alert">{error}</p><p><a href="/connexion">Retour à la connexion →</a></p></section></main>;

  return (
    <div className="app-shell">
      <aside className="app-nav" aria-label="Navigation ZARAY">
        <a className="app-brand" href="/">ZARAY<span>.</span></a>
        <div className="app-nav-group">
          <span className="app-nav-label">ESPACE</span>
          <a className="app-nav-link active" href="/tableau-de-bord">Tableau de bord</a>
          <a className="app-nav-link" href="/entreprises/nouvelle">Entreprises</a>
          <a className="app-nav-link" href="/sites">Sites</a>
          <a className="app-nav-link" href="/membres">Membres</a>
        </div>
        <div className="app-nav-group">
          <span className="app-nav-label">ACTIVITÉ</span>
          <a className="app-nav-link" href="/clients">Clients</a>
          <a className="app-nav-link" href="/offres">Offres Internet</a>
          <a className="app-nav-link" href="/commandes">Commandes</a>
          <a className="app-nav-link" href="/tickets">Tickets Wi-Fi</a>
        </div>
        <div className="app-nav-group">
          <span className="app-nav-label">FINANCE & RÉSEAU</span>
          <a className="app-nav-link" href="/paiements/verification">Paiements</a>
          <a className="app-nav-link" href="/parametres-paiement">Moyens de paiement</a>
          <a className="app-nav-link" href="/portail">Portail captif</a>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div><strong>ZARAY</strong><span className="muted"> · Administration</span></div>
          <a className="header-link" href="/connexion">Compte · Se déconnecter</a>
        </header>

        <main className="app-content">
          <header>
            <p className="eyebrow">VUE D’ENSEMBLE</p>
            <h1 className="app-title">Tableau de bord</h1>
            <p className="app-subtitle">Pilotez vos organisations et vos opérations Wi-Fi depuis un seul espace.</p>
          </header>

          <section className="kpi-grid" aria-label="Indicateurs">
            <article className="kpi"><div className="kpi-label">ENTREPRISES</div><div className="kpi-value">{companies.length}</div><div className="kpi-note">Accès autorisés</div></article>
            <article className="kpi"><div className="kpi-label">SITES</div><div className="kpi-value">{sites.length}</div><div className="kpi-note">Tous statuts confondus</div></article>
            <article className="kpi"><div className="kpi-label">SITES ACTIFS</div><div className="kpi-value">{sites.filter(s => s.status === 'active').length}</div><div className="kpi-note">Statut opérationnel</div></article>
            <article className="kpi"><div className="kpi-label">SESSION</div><div className="kpi-value">OK</div><div className="kpi-note">Compte authentifié</div></article>
          </section>

          <section className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head"><div><div className="panel-title">Actions rapides</div><div className="muted">Accédez directement aux tâches principales.</div></div></div>
            <div className="quick-grid">
              <a className="quick-action" href="/entreprises/nouvelle"><strong>Créer une entreprise</strong><div className="muted">Ajouter une organisation</div></a>
              <a className="quick-action" href="/sites"><strong>Gérer les sites</strong><div className="muted">Créer, renommer ou changer le statut</div></a>
              <a className="quick-action" href="/clients"><strong>Ajouter un client</strong><div className="muted">Créer une fiche CRM</div></a>
              <a className="quick-action" href="/offres"><strong>Créer une offre</strong><div className="muted">Définir un forfait Internet</div></a>
              <a className="quick-action" href="/commandes"><strong>Suivre les commandes</strong><div className="muted">Voir les souscriptions</div></a>
              <a className="quick-action" href="/paiements/verification"><strong>Vérifier les paiements</strong><div className="muted">Traiter les justificatifs</div></a>
            </div>
          </section>

          <div className="module-grid">
            <section className="panel" style={{ minHeight: 280 }}>
              <div className="panel-head"><div className="panel-title">Entreprises accessibles</div><a className="header-link" href="/entreprises/nouvelle">+ Ajouter</a></div>
              {companies.length ? <div className="data-list">{companies.map(company => <div className="data-row" key={company.id}><div><strong>{company.legal_name}</strong><div className="muted">{company.slug}</div></div><span className="status-pill">{company.role || 'Membre'}</span></div>)}</div> : <p className="muted">Aucune entreprise. Créez votre première organisation pour commencer.</p>}
            </section>
            <section className="panel" style={{ minHeight: 280 }}>
              <div className="panel-head"><div className="panel-title">Sites récents</div><a className="header-link" href="/sites">Gérer</a></div>
              {sites.length ? <div className="data-list">{sites.slice(0, 6).map(site => <div className="data-row" key={site.id}><div><strong>{site.name}</strong><div className="muted">{site.company_name}</div></div><span className="status-pill">{statusLabels[site.status] || site.status}</span></div>)}</div> : <p className="muted">Aucun site enregistré.</p>}
            </section>
          </div>

          <section className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head"><div><div className="panel-title">État des modules</div><div className="muted">ZARAY affiche uniquement des capacités réellement disponibles.</div></div></div>
            <div className="data-list">
              <div className="data-row"><span>Entreprises, sites et membres</span><span className="status-pill">Actif</span></div>
              <div className="data-row"><span>Clients et offres Internet</span><span className="status-pill">Actif</span></div>
              <div className="data-row"><span>Commandes, tickets et paiements vérifiés</span><span className="status-pill">Actif</span></div>
              <div className="data-row"><span>Activation réseau / RADIUS</span><span className="muted">Intégration progressive</span></div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
