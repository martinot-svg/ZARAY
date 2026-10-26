const modules = [
  { number: '01', title: 'Entreprises & sites', description: 'Organisations, sites, membres et permissions multi-entreprises.', status: 'Disponible', href: '/sites', action: 'Gérer les sites' },
  { number: '02', title: 'Clients', description: 'Fiches clients, coordonnées et rattachement à un site.', status: 'Disponible', href: '/clients', action: 'Gérer les clients' },
  { number: '03', title: 'Offres Internet', description: 'Forfaits, durée, validité, prix et nombre d’appareils.', status: 'Disponible', href: '/offres', action: 'Gérer les offres' },
  { number: '04', title: 'Commandes & tickets', description: 'Parcours de souscription et émission de tickets Wi-Fi.', status: 'Opérationnel', href: '/commandes', action: 'Voir les commandes' },
  { number: '05', title: 'Paiements', description: 'Configuration, justificatifs et vérification des paiements.', status: 'Opérationnel', href: '/paiements/verification', action: 'Vérifier les paiements' },
  { number: '06', title: 'Réseau & portail', description: 'Portail captif et intégration réseau préparés pour l’exploitation.', status: 'En intégration', href: '/portail', action: 'Voir le portail' },
];

export default function HomePage() {
  return (
    <main className="shell">
      <header className="header">
        <div className="wordmark">ZARAY<span className="dot">.</span></div>
        <nav style={{ display: 'flex', gap: 18, alignItems: 'center' }} aria-label="Navigation principale">
          <a className="header-link" href="/tableau-de-bord">Tableau de bord</a>
          <a className="header-link" href="/connexion">Se connecter <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-heading">
        <div className="eyebrow">PLATEFORME SAAS · GESTION WI-FI</div>
        <h1 id="hero-heading">Votre réseau.<br /><span>Votre activité. Un seul espace.</span></h1>
        <p>ZARAY centralise la gestion de vos entreprises, sites, clients, offres, commandes et paiements dans une plateforme multi-entreprises conçue pour les opérateurs Wi-Fi.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a className="primary-link" href="/tableau-de-bord">Ouvrir le tableau de bord <span aria-hidden="true">→</span></a>
          <a className="header-link" href="/inscription" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 8px' }}>Créer un compte</a>
        </div>
      </section>

      <section className="modules" id="modules" aria-labelledby="modules-heading">
        <div className="section-head">
          <div><div className="eyebrow">VOTRE ESPACE DE GESTION</div><h2 id="modules-heading">Les modules ZARAY</h2></div>
          <span className="stage">V1.0 · en évolution</span>
        </div>
        <div className="module-grid">
          {modules.map((m) => (
            <article className="module" key={m.number}>
              <span className="module-number">{m.number}</span>
              <h3>{m.title}</h3>
              <p>{m.description}</p>
              <span className="module-status">{m.status}</span>
              <p style={{ marginTop: 14 }}><a className="header-link" href={m.href}>{m.action} →</a></p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">ZARAY · Gestion multi-entreprises Wi-Fi · GitHub · Vercel · Supabase</footer>
    </main>
  );
}
