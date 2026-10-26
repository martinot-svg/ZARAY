'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import BrandLogo from '@/components/brand-logo';
import ThemeSelector from '@/components/theme-selector';
import Link from 'next/link';
import SignOutButton from '@/components/sign-out-button';

const links = [
  { href: '/mon-compte', label: 'Tableau de bord' },
  { href: '/entreprises', label: 'Entreprises' },
  { href: '/finance-globale', label: 'Finance globale' },
];

export default function PersonalShell({ children, active, email }: { children: ReactNode; active: string; email: string | null }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open]);
  return <div className="personal-shell">
    <button type="button" className={'personal-menu-backdrop' + (open ? ' is-open' : '')} tabIndex={open ? 0 : -1} aria-label="Fermer le menu" onClick={() => setOpen(false)} />
    <nav id="personal-navigation" className={'personal-drawer' + (open ? ' is-open' : '')} aria-label="Navigation du compte personnel" inert={!open}>
      <div className="personal-drawer-head"><strong>Mon compte ZARAY</strong><button type="button" onClick={() => { setOpen(false); menuButton.current?.focus(); }}>Fermer</button></div>
      {links.map((link, index) => <Link key={link.href} ref={index === 0 ? firstLink : undefined} href={link.href} prefetch={false} aria-current={active === link.href ? 'page' : undefined}
        className={'personal-nav-link' + (active === link.href ? ' active' : '')} onClick={() => setOpen(false)}>{link.label}</Link>)}
      <div className="personal-drawer-footer"><SignOutButton /></div>
    </nav>
    <header className="personal-topbar">
      <button ref={menuButton} type="button" className="personal-menu-toggle" aria-controls="personal-navigation" aria-expanded={open} onClick={() => setOpen(v => !v)}>☰ <span>Menu</span></button>
      <a href="/mon-compte" className="personal-logo" aria-label="Accueil personnel ZARAY"><BrandLogo priority /></a>
      <ThemeSelector /><span className="personal-topbar-label">Espace personnel</span>
    </header>
    <main className="personal-content">{email && <p className="personal-email">Compte : {email}</p>}{children}</main>
  </div>;
}
