'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import BrandLogo from '@/components/brand-logo';
import ThemeSwitch from '@/components/theme-switch';
import { ZarayIcon, type ZarayIconName } from '@/components/ui/zaray-icon';
import Link from 'next/link';
import SignOutButton from '@/components/sign-out-button';

const links = [
  { href: '/mon-compte', label: 'Z’Accueil', icon: 'home' },
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
  dashboardCompanyId?: string | null;
};

export default function PersonalShell({
  children, active, email, name, home = false, inviteCompanyId = null, dashboardCompanyId = null,
}: Props) {
  const [homeNavOpen, setHomeNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const displayName = name?.trim() || email?.split('@')[0] || 'Utilisateur ZARAY';

  // The management dashboard requires an authorized enterprise context.
  const dashboardHref = dashboardCompanyId
    ? '/tableau-de-bord?companyId=' + encodeURIComponent(dashboardCompanyId)
    : '/tableau-de-bord';
  const navigationLinks = links.map(link =>
    link.href === '/tableau-de-bord' ? { ...link, href: dashboardHref } : link
  );

  const homeNavButton = useRef<HTMLButtonElement>(null);
  const homeNavRef = useRef<HTMLDivElement>(null);
  const profileButton = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  const hoverMenus = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Only anchored dropdowns: no permanent or off-canvas black sidebar.
  useEffect(() => {
    if (!homeNavOpen && !profileOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (homeNavOpen && !homeNavRef.current?.contains(event.target)) setHomeNavOpen(false);
      if (profileOpen && !profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [homeNavOpen, profileOpen]);

  useEffect(() => {
    if (!homeNavOpen && !profileOpen) return;
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (profileOpen) { setProfileOpen(false); profileButton.current?.focus(); }
      else { setHomeNavOpen(false); homeNavButton.current?.focus(); }
    };
    window.addEventListener('keydown', closeEscape);
    return () => window.removeEventListener('keydown', closeEscape);
  }, [homeNavOpen, profileOpen]);

  return <div className={'personal-shell personal-no-sidebar' + (home ? ' personal-home-shell' : '') + (['/mon-compte', '/entreprises', '/finance-globale'].includes(active) ? ' personal-sticky-topbar' : '')}>
    <header className="personal-topbar">
      <Link href="/mon-compte" className="personal-logo" aria-label="Accueil personnel ZARAY"><BrandLogo priority /></Link>
      <div className="personal-home-nav-control" ref={homeNavRef}
        onMouseEnter={() => { if (hoverMenus()) { setHomeNavOpen(true); setProfileOpen(false); } }}
        onMouseLeave={() => { if (hoverMenus()) setHomeNavOpen(false); }}>
        <button ref={homeNavButton} type="button" className="personal-home-nav-toggle"
          aria-controls="personal-home-navigation-links" aria-expanded={homeNavOpen}
          aria-label="Ouvrir la navigation de mon espace ZARAY" title="Mon espace ZARAY"
          onClick={() => { setHomeNavOpen(value => !value); setProfileOpen(false); }}>
          <ZarayIcon name="menu" size={22}/><span className="topbar-icon-label">Mon espace Zaray</span>
        </button>
        <nav id="personal-home-navigation-links" aria-label="Navigation du compte personnel"
          className={'personal-home-nav-menu' + (homeNavOpen ? ' is-open' : '')}
          inert={!homeNavOpen} aria-hidden={!homeNavOpen}>
          {navigationLinks.map(link => <Link key={link.href} href={link.href}
            aria-current={active === link.href.split('?')[0] ? 'page' : undefined}
            className={'personal-nav-link' + (active === link.href.split('?')[0] ? ' active' : '')}
            onClick={() => setHomeNavOpen(false)}>
            <ZarayIcon name={link.icon as ZarayIconName} size={19} /> {link.label}
          </Link>)}
        </nav>
      </div>
      <div className="personal-topbar-actions">
        <div className="topbar-icon-group topbar-theme-control">
          <ThemeSwitch buttonRef={themeButtonRef} />
          <div className="topbar-icon-curtain" aria-label="Thème de l'interface">
            <div className="topbar-icon-curtain-inner">
              <button type="button" className="topbar-icon-menu-action"
                onClick={() => themeButtonRef.current?.click()}>
                <ZarayIcon name="theme" size={18} /> Changer le thème
              </button>
            </div>
          </div>
        </div>
        {active === '/entreprises' && (
          <div className="topbar-icon-group topbar-create-control">
            <Link href="/entreprises/nouvelle" className="primary-link personal-topbar-create"
              aria-label="Créer une entreprise" title="Créer une entreprise">
              <ZarayIcon name="add" size={22} /><span className="topbar-icon-label">Créer une entreprise</span>
            </Link>
            <div className="topbar-icon-curtain" aria-label="Création d'entreprise">
              <div className="topbar-icon-curtain-inner">
                <Link className="topbar-icon-menu-action" href="/entreprises/nouvelle">
                  <ZarayIcon name="company" size={18} /> Créer une entreprise
                </Link>
              </div>
            </div>
          </div>
        )}
        <div className="personal-profile-control" ref={profileRef}
          onMouseEnter={() => { if (hoverMenus()) { setProfileOpen(true); setHomeNavOpen(false); } }}
          onMouseLeave={() => { if (hoverMenus()) setProfileOpen(false); }}>
        <button ref={profileButton} type="button" className="personal-topbar-profile"
          aria-label={'Options du profil de ' + displayName} title={'Profil de ' + displayName}
          aria-controls="personal-profile-actions" aria-expanded={profileOpen}
          onClick={() => { setProfileOpen(value => !value); setHomeNavOpen(false); }}>
          <span className="personal-profile-avatar" aria-hidden="true"><ZarayIcon name="profile" size={22}/></span>
          <span className="personal-profile-copy"><strong title={displayName}>{displayName}</strong><span>Espace personnel</span></span>
        </button>
        <div id="personal-profile-actions"
          className={'personal-profile-dropdown' + (profileOpen ? ' is-open' : '')}
          inert={!profileOpen} aria-hidden={!profileOpen}>
          {inviteCompanyId ?
            <Link href="/z-alliance"
              className="personal-profile-action" onClick={() => setProfileOpen(false)}>
              <ZarayIcon name="alliance" size={18} /> Z’Alliance
            </Link>
            : <span className="personal-profile-action is-disabled" aria-disabled="true"
                title="Cette action nécessite le rôle de propriétaire ou d’administrateur d’une entreprise.">
              <ZarayIcon name="alliance" size={18} /> Z’Alliance
            </span>}
          <SignOutButton profile />
        </div>
        </div>
      </div>
    </header>
    <main className="personal-content">
      {!home && email && active !== '/entreprises' && active !== '/finance-globale' && <p className="personal-email">Compte : {email}</p>}
      {children}
    </main>
    <nav className="personal-mobile-dock" aria-label="Navigation rapide du compte personnel">
      {links.map(item => <Link key={'mobile-' + item.href} href={item.href}
        className={'personal-mobile-dock-link' + (active === item.href ? ' is-active' : '')}
        aria-current={active === item.href ? 'page' : undefined}>
        <ZarayIcon name={item.icon as ZarayIconName} size={21}/><span>{item.label === 'Finances des entreprises' ? 'Finances' : item.label === 'Mes entreprises' ? 'Entreprises' : 'Accueil'}</span>
      </Link>)}
    </nav>
  </div>;
}
