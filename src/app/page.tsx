const modules = [
  { number: '01', title: 'Entreprises', description: 'Comptes professionnels, sites et gestion des accès.' },
  { number: '02', title: 'Wi-Fi & réseau', description: 'Infrastructure MikroTik, RADIUS et portail captif.' },
  { number: '03', title: 'Tickets & paiements', description: 'Forfaits, tickets QR et paiements vérifiés.' },
  { number: '04', title: 'Finance', description: 'Comptabilité et suivi des opérations financières.' },
  { number: '05', title: 'Clients', description: 'Fiches clients, coordonnées et rattachement aux sites.' },
  { number: '06', title: 'Offres Internet', description: 'Forfaits, durée, validité, prix et nombre d’appareils.' },
];

export default function HomePage() {
  return (
    <main className="shell">
      <header className="header"><div className="wordmark">ZARAY<span className="dot">.</span></div><nav style={{ display: 'flex', gap: 18, alignItems: 'center' }}><a className="header-link" href="/tableau-de-bord">Tableau de bord</a><a className="header-link" href="/connexion">Se connecter <span aria-hidden="true">↗</span></a></nav></header>
      <section className="hero" aria-labelledby="hero-heading"><div className="eyebrow">ZARAY · VERSION 1.0</div><h1 id="hero-heading">Une plateforme.<br /><span>Cinq métiers connectés.</span></h1><p>Le socle Zaray utilise GitHub, Vercel et Supabase. Les entreprises et leurs sites peuvent être gérés depuis un espace administrateur sécurisé. Les paiements et services réseau seront activés progressivement.</p><a className="primary-link" href="/tableau-de-bord">Accéder au tableau de bord <span aria-hidden="true">→</span></a></section>
      <section className="modules" id="modules" aria-labelledby="modules-heading"><div className="section-head"><div><div className="eyebrow">ARCHITECTURE FONCTIONNELLE</div><h2 id="modules-heading">Les cinq modules Zaray</h2></div><span className="stage">Socle en construction</span></div><div className="module-grid">{modules.map(m => <article className="module" key={m.number}><span className="module-number">{m.number}</span><h3>{m.title}</h3><p>{m.description}</p><span className="module-status">{m.number === '01' ? 'Gestion des entreprises et sites disponible' : m.number === '05' ? 'Gestion des clients disponible' : m.number === '06' ? 'Gestion des offres disponible' : 'Spécifications validées · Implémentation progressive'}</span>{m.number === '01' && <a className="primary-link" href="/sites">Gérer les sites →</a>}{m.number === '05' && <a className="primary-link" href="/clients">Gérer les clients →</a>}{m.number === '06' && <a className="primary-link" href="/offres">Gérer les offres →</a>}</article>)}</div></section>
      <footer className="footer">Zaray V1.0 <span>·</span> Les paiements et connexions réseau ne sont pas encore activés.</footer>
    </main>
  );
}
