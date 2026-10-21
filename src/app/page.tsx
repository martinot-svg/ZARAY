const modules = [
  { number: '01', title: 'Entreprises', description: 'Comptes professionnels, sites et gestion des accès.' },
  { number: '02', title: 'Wi-Fi & réseau', description: 'Infrastructure MikroTik, RADIUS et portail captif.' },
  { number: '03', title: 'Tickets & paiements', description: 'Forfaits, tickets QR et paiements vérifiés.' },
  { number: '04', title: 'Finance', description: 'Comptabilité et suivi des opérations financières.' },
  { number: '05', title: 'CRM', description: 'Clients, support, interventions et fidélisation.' },
];

export default function HomePage() {
  return (
    <main className="shell">
      <header className="header"><div className="wordmark">ZARAY<span className="dot">.</span></div><a className="header-link" href="/connexion">Se connecter <span aria-hidden="true">↗</span></a></header>
      <section className="hero" aria-labelledby="hero-heading"><div className="eyebrow">ZARAY · VERSION 1.0</div><h1 id="hero-heading">Une plateforme.<br /><span>Cinq métiers connectés.</span></h1><p>La fondation technique de Zaray est en place. Les fonctions métiers seront développées et vérifiées progressivement, conformément aux 135 règles approuvées.</p><a className="primary-link" href="#modules">Explorer le périmètre <span aria-hidden="true">→</span></a></section>
      <section className="modules" id="modules" aria-labelledby="modules-heading"><div className="section-head"><div><div className="eyebrow">ARCHITECTURE FONCTIONNELLE</div><h2 id="modules-heading">Les cinq modules Zaray</h2></div><span className="stage">Socle en construction</span></div><div className="module-grid">{modules.map(m => <article className="module" key={m.number}><span className="module-number">{m.number}</span><h3>{m.title}</h3><p>{m.description}</p><span className="module-status">Spécifications validées · Implémentation à venir</span>{m.number === '01' && <a className="primary-link" href="/sites">Gérer les sites →</a>}</article>)}</div></section>
      <footer className="footer">Zaray V1.0 <span>·</span> Fondation applicative — aucune transaction ni connexion réseau n'est encore active.</footer>
    </main>
  );
}
