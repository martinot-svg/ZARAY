'use client';

import type { ReactNode } from 'react';

const sections = [
  { label: 'ESPACE', items: [['/tableau-de-bord', 'Tableau de bord'], ['/entreprises/nouvelle', 'Entreprises'], ['/sites', 'Sites'], ['/membres', 'Membres']] },
  { label: 'ACTIVITÉ', items: [['/clients', 'Clients'], ['/offres', 'Offres Internet'], ['/commandes', 'Commandes'], ['/tickets', 'Tickets Wi-Fi']] },
  { label: 'FINANCE & RÉSEAU', items: [['/paiements/verification', 'Paiements'], ['/parametres-paiement', 'Moyens de paiement'], ['/portail', 'Portail captif']] },
];

type AppShellProps = { children: ReactNode; activePath: string; eyebrow?: string; title?: string; description?: string; actions?: ReactNode };

export default function AppShell({ children, activePath, eyebrow, title, description, actions }: AppShellProps) {
  return <div className="app-shell">
    <aside className="app-nav" aria-label="Navigation ZARAY">
      <a className="app-brand" href="/">ZARAY<span>.</span></a>
      {sections.map((section) => <div className="app-nav-group" key={section.label}>
        <span className="app-nav-label">{section.label}</span>
        {section.items.map(([href, label]) => <a key={href} className={'app-nav-link' + (activePath === href ? ' active' : '')} href={href} aria-current={activePath === href ? 'page' : undefined}>{label}</a>)}
      </div>)}
      <div className="app-nav-footer"><a className="app-nav-link" href="/">Voir le site public</a><a className="app-nav-link" href="/connexion">Compte · Déconnexion</a></div>
    </aside>
    <div className="app-main">
      <header className="app-topbar"><div><strong>ZARAY</strong><span className="muted"> · Administration</span></div><a className="header-link" href="/tableau-de-bord">Tableau de bord</a></header>
      <main className="app-content">
        {(eyebrow || title || description || actions) && <header className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}{title && <h1 className="app-title">{title}</h1>}{description && <p className="app-subtitle">{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>}
        {children}
      </main>
    </div>
  </div>;
}
