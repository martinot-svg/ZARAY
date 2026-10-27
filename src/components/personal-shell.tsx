'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import BrandLogo from '@/components/brand-logo';
import { ZarayIcon, type ZarayIconName } from '@/components/ui/zaray-icon';
import Link from 'next/link';
import SignOutButton from '@/components/sign-out-button';

const links = [
  { href: '/mon-compte', label: 'Tableau de bord', icon: 'dashboard' },
  { href: '/entreprises', label: 'Mes entreprises', icon: 'company' },
  { href: '/finance-globale', label: 'Finances des entreprises', icon: 'finance' },
];

export default function PersonalShell({ children, active, email, name }: { children: ReactNode; active: string; email: string | null; name: string | null }) {
  const [open, setOpen] = useState(false);
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const displayName = name?.trim() || email?.split('@')[0] || 'Utilisateur ZARAY';
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 901px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => { if (desktop) setOpen(false); }, [desktop]);
  const firstLink = useRef<HTMLAnchorElement>(null);
  const spaceMenuButton = useRef<HTMLButtonElement>(null);
  const spaceMenuPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) spaceMenuButton.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!spaceMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (spaceMenuButton.current?.contains(target) || spaceMenuPanel.current?.contains(target)) return;
      setSpaceMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [spaceMenuOpen]);
  useEffect(() => {
    if (!open && !spaceMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (spaceMenuOpen) {
        setSpaceMenuOpen(false);
        spaceMenuButton.current?.focus();
      } else if (open) {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, spaceMenuOpen]);
  return <div className="personal-shell">
    <button type="button" className={'personal-menu-backdrop' + (open ? ' is-open' : '')} tabIndex={open ? 0 : -1} aria-label="Fermer le menu" onClick={() => setOpen(false)} />
    <nav id="personal-navigation" className={'personal-drawer' + (open ? ' is-open' : '')} aria-label="Navigation du compte personnel" inert={!desktop && !open}>
      <div className="personal-drawer-head">
        <button ref={spaceMenuButton} type="button" className="personal-space-toggle"
          aria-controls="personal-space-links" aria-expanded={spaceMenuOpen}
          onClick={() => setSpaceMenuOpen(value => !value)}>
          <ZarayIcon name="menu" size={20} /><span>Mon espace Zaray</span>
        </button>
        <button className="personal-drawer-close" type="button" onClick={() => { setOpen(false); menuButton.current?.focus(); }}><ZarayIcon name="close" size={18} /> Fermer</button>
      </div>
      <div ref={spaceMenuPanel} id="personal-space-links"
        className={'personal-space-reveal' + (spaceMenuOpen ? ' is-open' : '')}
        inert={!spaceMenuOpen} aria-hidden={!spaceMenuOpen}>
        <div className="personal-space-reveal-inner">
          <div className="personal-space-links">
            {links.map((link, index) => <Link key={link.href} ref={index === 0 ? firstLink : undefined} href={link.href} prefetch={false} aria-current={active === link.href ? 'page' : undefined}
              className={'personal-nav-link' + (active === link.href ? ' active' : '')} onClick={() => { setSpaceMenuOpen(false); setOpen(false); }}><ZarayIcon name={link.icon as ZarayIconName} size={19} /> {link.label}</Link>)}
          </div>
        </div>
      </div>
      <div className="personal-drawer-footer"><SignOutButton /></div>
    </nav>
    <header className="personal-topbar">
      <button ref={menuButton} type="button" aria-label={open ? "Fermer le menu personnel" : "Ouvrir le menu personnel"} className="personal-menu-toggle" aria-controls="personal-navigation" aria-expanded={open} onClick={() => setOpen(v => !v)}><ZarayIcon name="menu" size={20} /><span>Menu</span></button>
      <a href="/mon-compte" className="personal-logo" aria-label="Accueil personnel ZARAY"><BrandLogo priority /></a>
      <div className="personal-topbar-profile" aria-label="Profil du compte connecté">
        <span className="personal-profile-avatar" aria-hidden="true"><ZarayIcon name="profile" size={22} /></span>
        <div className="personal-profile-copy"><strong title={displayName}>{displayName}</strong><span>Espace personnel</span></div>
      </div>
    </header>
    <main className="personal-content">{email && <p className="personal-email">Compte : {email}</p>}{children}</main>
  </div>;
}
