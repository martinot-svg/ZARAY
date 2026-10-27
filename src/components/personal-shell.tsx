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

type Props = {
  children: ReactNode;
  active: string;
  email: string | null;
  name: string | null;
  home?: boolean;
  inviteCompanyId?: string | null;
};

export default function PersonalShell({ children, active, email, name, home = false, inviteCompanyId = null }: Props) {
  const [open, setOpen] = useState(false);
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const [homeNavOpen, setHomeNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const displayName = name?.trim() || email?.split('@')[0] || 'Utilisateur ZARAY';

  const menuButton = useRef<HTMLButtonElement>(null);
  const spaceMenuButton = useRef<HTMLButtonElement>(null);
  const spaceMenuPanel = useRef<HTMLDivElement>(null);
  const homeNavButton = useRef<HTMLButtonElement>(null);
  const homeNavRef = useRef<HTMLDivElement>(null);
  const profileButton = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 901px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => { if (desktop) setOpen(false); }, [desktop]);
  useEffect(() => { if (open) spaceMenuButton.current?.focus(); }, [open]);

  // The menu must close outside, without interfering with other controls.
  useEffect(() => {
    if (!spaceMenuOpen && !homeNavOpen && !profileOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (spaceMenuOpen && !spaceMenuButton.current?.contains(event.target) &&
          !spaceMenuPanel.current?.contains(event.target)) setSpaceMenuOpen(false);
      if (homeNavOpen && !homeNavRef.current?.contains(event.target)) setHomeNavOpen(false);
      if (profileOpen && !profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [spaceMenuOpen, homeNavOpen, profileOpen]);

  useEffect(() => {
    if (!open && !spaceMenuOpen && !homeNavOpen && !profileOpen) return;
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (profileOpen) { setProfileOpen(false); profileButton.current?.focus(); }
      else if (homeNavOpen) { setHomeNavOpen(false); homeNavButton.current?.focus(); }
      else if (spaceMenuOpen) { setSpaceMenuOpen(false); spaceMenuButton.current?.focus(); }
      else if (open) { setOpen(false); menuButton.current?.focus(); }
    };
    window.addEventListener('keydown', closeEscape);
    return () => window.removeEventListener('keydown', closeEscape);
  }, [open, spaceMenuOpen, homeNavOpen, profileOpen]);

  return <div className={'personal-shell' + (home ? ' personal-home-shell' : '')}>
    {!home && <>
      <button type="button" className={'personal-menu-backdrop' + (open ? ' is-open' : '')}
        tabIndex={open ? 0 : -1} aria-label="Fermer le menu" onClick={() => setOpen(false)} />
      <nav id="personal-navigation" className={'personal-drawer' + (open ? ' is-open' : '')}
        aria-label="Navigation du compte personnel" inert={!desktop && !open}>
        <div className="personal-drawer-head">
          <button ref={spaceMenuButton} type="button" className="personal-space-toggle"
            aria-controls="personal-space-links" aria-expanded={spaceMenuOpen}
            onClick={() => setSpaceMenuOpen(value => !value)}>
            <ZarayIcon name="menu" size={20} /><span>Mon espace Zaray</span>
          </button>
          <button className="personal-drawer-close" type="button" onClick={() => { setOpen(false); menuButton.current?.focus(); }}>
            <ZarayIcon name="close" size={18} /> Fermer
          </button>
        </div>
        <div ref={spaceMenuPanel} id="personal-space-links"
          className={'personal-space-reveal' + (spaceMenuOpen ? ' is-open' : '')}
          inert={!spaceMenuOpen} aria-hidden={!spaceMenuOpen}>
          <div className="personal-space-reveal-inner">
            <div className="personal-space-links">
              {links.map(link => <Link key={link.href} href={link.href} prefetch={false}
                aria-current={active === link.href ? 'page' : undefined}
                className={'personal-nav-link' + (active === link.href ? ' active' : '')}
                onClick={() => { setSpaceMenuOpen(false); setOpen(false); }}>
                <ZarayIcon name={link.icon as ZarayIconName} size={19} /> {link.label}
              </Link>)}
            </div>
          </div>
        </div>
        <div className="personal-drawer-footer"><SignOutButton /></div>
      </nav>
    </>}
    <header className="personal-topbar">
      {home ? <div className="personal-home-nav-control" ref={homeNavRef}>
        <button ref={homeNavButton} type="button" className="personal-home-nav-toggle"
          aria-controls="personal-home-navigation-links" aria-expanded={homeNavOpen}
          onClick={() => { setHomeNavOpen(value => !value); setProfileOpen(false); }}>
          <ZarayIcon name="menu" size={20}/><span>Mon espace Zaray</span>
        </button>
        <nav id="personal-home-navigation-links" aria-label="Navigation du compte personnel"
          className={'personal-home-nav-menu' + (homeNavOpen ? ' is-open' : '')}
          inert={!homeNavOpen} aria-hidden={!homeNavOpen}>
          {links.map(link => <Link key={link.href} href={link.href} prefetch={false}
            aria-current={active === link.href ? 'page' : undefined}
            className={'personal-nav-link' + (active === link.href ? ' active' : '')}
            onClick={() => setHomeNavOpen(false)}>
            <ZarayIcon name={link.icon as ZarayIconName} size={19} /> {link.label}
          </Link>)}
        </nav>
      </div> : <button ref={menuButton} type="button"
        aria-label={open ? 'Fermer le menu personnel' : 'Ouvrir le menu personnel'}
        className="personal-menu-toggle" aria-controls="personal-navigation" aria-expanded={open}
        onClick={() => setOpen(value => !value)}>
        <ZarayIcon name="menu" size={20}/><span>Menu</span>
      </button>}
      <Link href="/mon-compte" className="personal-logo" aria-label="Accueil personnel ZARAY"><BrandLogo priority /></Link>
      <div className="personal-profile-control" ref={profileRef}>
        <button ref={profileButton} type="button" className="personal-topbar-profile"
          aria-label={'Options du profil de ' + displayName}
          aria-controls="personal-profile-actions" aria-expanded={profileOpen}
          onClick={() => { setProfileOpen(value => !value); setHomeNavOpen(false); }}>
          <span className="personal-profile-avatar" aria-hidden="true"><ZarayIcon name="profile" size={22}/></span>
          <span className="personal-profile-copy"><strong title={displayName}>{displayName}</strong><span>Espace personnel</span></span>
        </button>
        <div id="personal-profile-actions"
          className={'personal-profile-dropdown' + (profileOpen ? ' is-open' : '')}
          inert={!profileOpen} aria-hidden={!profileOpen}>
          {inviteCompanyId ?
            <Link href={'/membres?companyId=' + encodeURIComponent(inviteCompanyId)}
              className="personal-profile-action" onClick={() => setProfileOpen(false)}>
              <ZarayIcon name="members" size={18} /> Inviter un collaborateur
            </Link>
            : <span className="personal-profile-action is-disabled" aria-disabled="true"
                title="Cette action nécessite le rôle de propriétaire ou d’administrateur d’une entreprise.">
              <ZarayIcon name="members" size={18} /> Inviter un collaborateur
            </span>}
          <SignOutButton />
        </div>
      </div>
    </header>
    <main className="personal-content">
      {!home && email && <p className="personal-email">Compte : {email}</p>}
      {children}
    </main>
  </div>;
}
