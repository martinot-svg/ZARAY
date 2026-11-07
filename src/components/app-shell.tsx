'use client';
import { fetchWorkspaceDirectory } from '@/lib/workspace-directory-request';
import { ZarayIcon, type ZarayIconName } from '@/components/ui/zaray-icon';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import SignOutButton from '@/components/sign-out-button';
import BrandLogo from '@/components/brand-logo';
import ThemeSwitch from '@/components/theme-switch';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const sections = [
  { label: 'GESTION', items: [['/tableau-de-bord', 'Tableau de bord'], ['/sites', 'Sites'], ['/notifications', 'Notifications'], ['/membres', 'Membres']] },
  { label: 'ACTIVITÉ', items: [['/clients', 'Clients'], ['/offres', 'Offres Internet'], ['/commandes', 'Commandes'], ['/abonnements', 'Abonnements résidentiels'], ['/tickets', 'Tickets Wi-Fi']] },
  { label: 'FINANCE & RÉSEAU', items: [['/paiements/verification', 'Paiements'], ['/parametres-paiement', 'Moyens de paiement'], ['/portail', 'Portail captif'], ['/gestion-reseau', 'Gestion réseau']] },
];

type FlyoutItem = { href: string; label: string; siteOnly?: boolean };
const flyoutSections: { label: string; icon: ZarayIconName; items: FlyoutItem[] }[] = [
  { label: 'Pilotage', icon: 'dashboard', items: [
    { href: '/tableau-de-bord', label: 'Vue générale' },
    { href: '/sites', label: 'Sites de l’entreprise' },
  ] },
  { label: 'Clients & abonnements', icon: 'customers', items: [
    { href: '/clients', label: 'Clients' },
    { href: '/abonnements', label: 'Abonnements résidentiels' },
    { href: '/offres', label: 'Offres Internet' },
  ] },
  { label: 'Ventes & commandes', icon: 'orders', items: [
    { href: '/commandes', label: 'Commandes' },
    { href: '/tickets', label: 'Tickets Wi-Fi' },
    { href: '/caisse', label: 'Caisse' },
  ] },
  { label: 'Finances', icon: 'finance', items: [
    { href: '/paiements/verification', label: 'Paiements' },
    { href: '/parametres-paiement', label: 'Moyens de paiement' },
    { href: '/parametres-paiement/fiveonepay', label: 'FiveOne Pay' },
  ] },
  { label: 'Portail & réseau', icon: 'network', items: [
    { href: '/portail', label: 'Portail captif' },
    { href: '/gestion-reseau', label: 'Gestion réseau' },
    { href: 'site-domain', label: 'Adresse du site', siteOnly: true },
  ] },
  { label: 'Administration', icon: 'settings', items: [
    { href: '/membres', label: 'Membres et autorisations' },
    { href: '/notifications', label: 'Notifications' },
    { href: 'site-notifications', label: 'Notifications du site', siteOnly: true },
    { href: '/sites', label: 'Paramètres des sites' },
  ] },
];

const mobileDockItems = [
  { href: '/tableau-de-bord', label: 'Accueil', icon: 'dashboard', scoped: false },
  { href: '/clients', label: 'Clients', icon: 'customers', scoped: true },
  { href: '/tickets', label: 'Tickets', icon: 'ticket', scoped: true },
  { href: '/sites', label: 'Sites', icon: 'site', scoped: false },
] as const;

const navigationIcons = {
  '/tableau-de-bord': 'dashboard', '/entreprises': 'company', '/sites': 'site', '/notifications': 'notifications',
  '/membres': 'members', '/clients': 'customers', '/offres': 'wifi',
  '/commandes': 'orders', '/abonnements': 'wifi', '/tickets': 'ticket', '/paiements/verification': 'payment',
  '/parametres-paiement': 'finance', '/parametres-paiement/fiveonepay': 'payment', '/caisse': 'cash',
  'site-dashboard': 'dashboard', 'site-domain': 'network', 'site-notifications': 'notifications',
  '/portail': 'network', '/gestion-reseau': 'network',
} as const;
const editorialChapters:Record<string,{accent:string}>={
  '/tableau-de-bord':{accent:'mint'},
  '/sites':{accent:'cyan'},
  '/membres':{accent:'violet'},
  '/clients':{accent:'violet'},
  '/offres':{accent:'amber'},
  '/commandes':{accent:'cyan'},
  '/abonnements':{accent:'violet'},
  '/tickets':{accent:'amber'},
  '/paiements/verification':{accent:'amber'},
  '/parametres-paiement':{accent:'amber'},
  '/portail':{accent:'mint'},
  '/gestion-reseau':{accent:'cyan'}
};
type WorkspaceCompany = { id:string; legal_name:string; role:string };
type WorkspaceSite = { id:string; company_id:string; name:string };
type AppShellProps = { children: ReactNode; activePath: string; companyId?:string; siteId?:string; title?: string; actions?: ReactNode };

export default function AppShell({ children, activePath, companyId, siteId, title, actions }: AppShellProps) {
  const router=useRouter();
  const [companies,setCompanies] = useState<WorkspaceCompany[]>([]);
  const [sites,setSites] = useState<WorkspaceSite[]>([]);
  const [activeCompany,setActiveCompany] = useState('');
  const [activeSite,setActiveSite] = useState('');
  const [contextError,setContextError] = useState('');
  useEffect(() => {
    let mounted=true;
    const params=new URLSearchParams(window.location.search);
    const requestedCompany=companyId || params.get('companyId') || '';
    const requestedSite=siteId || params.get('siteId') || '';
    (async()=>{
      try{
        const response=await fetchWorkspaceDirectory();
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||'Contexte indisponible.');
        if(!mounted)return;
        const members:WorkspaceCompany[]=data.companies??[];
        const accessibleSites:WorkspaceSite[]=data.sites??[];
        const chosen=requestedCompany || (requestedSite ? accessibleSites.find(s=>s.id===requestedSite)?.company_id : '') || members[0]?.id || '';
        if(chosen&&!members.some(c=>c.id===chosen))throw new Error('Entreprise inaccessible.');
        if(requestedSite&&!accessibleSites.some(s=>s.id===requestedSite&&s.company_id===chosen))throw new Error('Site inaccessible dans cette entreprise.');
        setCompanies(members);setSites(accessibleSites);
        setActiveCompany(chosen);setActiveSite(requestedSite);
      }catch(e){if(mounted)setContextError(e instanceof Error?e.message:'Contexte indisponible.');}
    })();
    return()=>{mounted=false};
  },[companyId,siteId]);
  const chapter=editorialChapters[activePath] ?? {accent:'mint'};
  const moduleTitle = title || (activePath.startsWith('/sites/')
    ? 'Tableau de bord'
    : sections.flatMap(section => section.items).find(([path]) => path === activePath)?.[1]) || 'Espace de travail';
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFlyout, setActiveFlyout] = useState<number | null>(null);
  const [siteOpen, setSiteOpen] = useState(false);
  const siteButton = useRef<HTMLButtonElement>(null);
  const siteContainer = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const firstMenuLink = useRef<HTMLAnchorElement>(null);
  const menuContainer = useRef<HTMLDivElement>(null);
  const hoverMenus = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  useEffect(() => {
    if (!menuOpen && !siteOpen) return;
    // Both icon menus remain keyboard accessible without hijacking toolbar focus.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (siteOpen) { setSiteOpen(false); siteButton.current?.focus(); }
        else if (activeFlyout !== null) { setActiveFlyout(null); menuButton.current?.focus(); }
        else { setMenuOpen(false); menuButton.current?.focus(); }
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (menuOpen && !menuContainer.current?.contains(event.target)) { setMenuOpen(false); setActiveFlyout(null); }
      if (siteOpen && !siteContainer.current?.contains(event.target)) setSiteOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    return () => { window.removeEventListener('keydown', closeOnEscape); document.removeEventListener('pointerdown', closeOutside); };
  }, [menuOpen, siteOpen, activeFlyout]);

  function selectSite(next: string) {
    setSiteOpen(false);
    if (!activeCompany) return;
    router.push(next
      ? '/sites/' + encodeURIComponent(next) + '?companyId=' + encodeURIComponent(activeCompany)
      : '/tableau-de-bord?companyId=' + encodeURIComponent(activeCompany));
  }
  function scopedHref(href: string) {
    if (href === 'site-dashboard' && activeCompany && activeSite)
      return '/sites/' + encodeURIComponent(activeSite) + '?companyId=' + encodeURIComponent(activeCompany);
    if (href === 'site-domain' && activeCompany && activeSite)
      return '/sites/' + encodeURIComponent(activeSite) + '/domaine?companyId=' + encodeURIComponent(activeCompany);
    if (href === 'site-notifications' && activeCompany && activeSite)
      return '/sites/' + encodeURIComponent(activeSite) + '/notifications?companyId=' + encodeURIComponent(activeCompany);
    const operational = ['/clients', '/commandes', '/abonnements', '/tickets', '/caisse', '/paiements/verification'];
    return activeCompany
      ? href + (href.includes('?') ? '&' : '?') + 'companyId=' + encodeURIComponent(activeCompany)
        + (activeSite && operational.includes(href) ? '&siteId=' + encodeURIComponent(activeSite) : '')
      : href;
  }
  return <div className="app-shell app-no-sidebar" data-workspace-chapter={chapter.accent} data-workspace-path={activePath}>
    <div className="app-main">
      <header className="app-topbar zaray-icon-topbar">
        <Link className="app-topbar-brand" href="/mon-compte" aria-label="ZARAY · Espace personnel"><BrandLogo /></Link>
        <h1 className="app-topbar-title" title={moduleTitle}>{moduleTitle}</h1>
        <div className="app-topbar-links">
        <div className="app-menu-container" ref={menuContainer}
          onMouseEnter={() => { if (hoverMenus()) { setMenuOpen(true); setSiteOpen(false); } }}
          onMouseLeave={() => { if (hoverMenus() && !menuContainer.current?.contains(document.activeElement)) { setMenuOpen(false); setActiveFlyout(null); } }}>
          <button ref={menuButton} className="app-menu-button" type="button"
            aria-controls="zaray-app-nav" aria-expanded={menuOpen}
            aria-label="Ouvrir la navigation de l’entreprise"
            onClick={() => { setMenuOpen(value => !value); setActiveFlyout(null); setSiteOpen(false); }}>
            <ZarayIcon name="menu" size={22} /><span className="topbar-icon-label">Menu</span>
          </button>
          <nav id="zaray-app-nav"
            className={'app-nav-dropdown' + (menuOpen ? ' is-open' : '')}
            aria-label="Navigation de l’entreprise" inert={!menuOpen} aria-hidden={!menuOpen}>
            <div className="app-nav-current-context" aria-label="Contexte de travail">
              <span className="app-nav-label">ENTREPRISE</span>
              <strong>{companies.find(c => c.id === activeCompany)?.legal_name ?? (contextError || 'Sélectionner une entreprise')}</strong>
              {activeSite && <span>{sites.find(site => site.id === activeSite)?.name ?? 'Site actif'}</span>}
            </div>
            <div className="app-nav-rail" aria-label="Rubriques principales">
              {flyoutSections.map((section, index) => {
                const items: FlyoutItem[] = section.label === 'Pilotage' && activeSite
                  ? [{ href: 'site-dashboard', label: 'Tableau de bord du site' }, ...section.items]
                  : section.items;
                return <div className="app-nav-flyout" key={section.label}
                  onMouseEnter={() => { if (hoverMenus()) setActiveFlyout(index); }}>
                  <button type="button"
                    className={'app-nav-flyout-trigger' + (activeFlyout === index ? ' is-active' : '')}
                    aria-controls={'zaray-nav-flyout-' + index} aria-expanded={activeFlyout === index}
                    onClick={() => setActiveFlyout(previous => previous === index ? null : index)}>
                    <ZarayIcon name={section.icon} size={19} />
                    <span>{section.label}</span>
                    <ZarayIcon name="next" size={16} />
                  </button>
                  <div id={'zaray-nav-flyout-' + index}
                    className={'app-nav-flyout-panel' + (activeFlyout === index ? ' is-open' : '')}
                    aria-hidden={activeFlyout !== index} inert={activeFlyout !== index || !menuOpen}>
                    <div className="app-nav-flyout-heading">{section.label}</div>
                    {items.filter(item => !item.siteOnly || activeSite).map(item => {
                      const href = scopedHref(item.href);
                      return <Link key={item.href} href={href}
                        ref={item.href === '/tableau-de-bord' ? firstMenuLink : undefined}
                        className={'app-nav-link' + (activePath === item.href ? ' active' : '')}
                        aria-current={activePath === item.href ? 'page' : undefined}
                        onClick={() => { setMenuOpen(false); setActiveFlyout(null); }}>
                        <ZarayIcon name={navigationIcons[item.href as keyof typeof navigationIcons] ?? 'next'} size={17} />
                        {item.label}
                      </Link>;
                    })}
                  </div>
                </div>;
              })}
            </div>
            <div className="app-nav-footer">
              <Link className="app-nav-link" href={scopedHref('/tableau-de-bord')} onClick={() => { setMenuOpen(false); setActiveFlyout(null); }}>
                <ZarayIcon name="dashboard" size={18} /> Vue générale
              </Link>
              <Link className="app-nav-link" href="/mon-compte" onClick={() => { setMenuOpen(false); setActiveFlyout(null); }}>
                <ZarayIcon name="profile" size={18} /> Mon compte
              </Link>
              <Link className="app-nav-link" href="/entreprises" onClick={() => { setMenuOpen(false); setActiveFlyout(null); }}>
                <ZarayIcon name="company" size={18} /> Changer d’entreprise
              </Link>
              <ThemeSwitch className="app-nav-theme-switch" />
              <SignOutButton />
            </div>
          </nav>
        </div>
        <div className="topbar-icon-group">
          <Link className="header-link"
            href={activeCompany?'/notifications?companyId='+encodeURIComponent(activeCompany)+(activeSite?'&siteId='+encodeURIComponent(activeSite):''):'/notifications'}
            aria-label="Centre de notifications" title="Notifications">
            <ZarayIcon name="notifications" size={22}/><span className="topbar-icon-label">Notifications</span>
          </Link>
        </div>
        <div className="app-site-container" ref={siteContainer}>
          <button ref={siteButton} type="button" className="app-site-button"
            aria-label={activeSite ? 'Changer de site : ' + (sites.find(s => s.id === activeSite)?.name ?? 'Site actif') : 'Choisir un site'}
            title="Changer de site" aria-controls="zaray-site-picker" aria-expanded={siteOpen}
            onClick={() => { setSiteOpen(value => !value); setMenuOpen(false); setActiveFlyout(null); }}>
            <ZarayIcon name="site" size={22} />
            {activeSite && <span className="app-site-active-indicator" aria-hidden="true" />}
          </button>
          <div id="zaray-site-picker" className={'app-site-dropdown' + (siteOpen ? ' is-open' : '')}
            role="group" aria-label="Choix du site" inert={!siteOpen} aria-hidden={!siteOpen}>
            <p className="app-site-heading">Site actif</p>
            {activeCompany ? <>
              <button type="button" className={'app-site-option' + (!activeSite ? ' is-active' : '')}
                aria-current={!activeSite ? 'page' : undefined} onClick={() => selectSite('')}>
                <ZarayIcon name="dashboard" size={18} /> Vue générale
              </button>
              {sites.filter(s => s.company_id === activeCompany).map(site => (
                <button key={site.id} type="button" className={'app-site-option' + (activeSite === site.id ? ' is-active' : '')}
                  aria-current={activeSite === site.id ? 'page' : undefined} onClick={() => selectSite(site.id)}>
                  <ZarayIcon name="site" size={18} /> {site.name}
                </button>
              ))}
            </> : <p className="app-site-feedback">{contextError || 'Aucune entreprise sélectionnée.'}</p>}
          </div>
        </div>

        </div>
      </header>
      <main className="app-content">
        {actions && <div className="workspace-page-actions" aria-label="Actions du module">{actions}</div>}
        {children}
      </main>
    </div>
    {activeCompany && <nav className="workspace-mobile-dock" aria-label="Navigation rapide de l’entreprise">
      {mobileDockItems.map(item => {
        const href = item.href + '?companyId=' + encodeURIComponent(activeCompany)
          + (item.scoped && activeSite ? '&siteId=' + encodeURIComponent(activeSite) : '');
        return <Link key={item.href} href={href}
          className={'workspace-mobile-dock-link' + (activePath === item.href ? ' is-active' : '')}
          aria-current={activePath === item.href ? 'page' : undefined}>
          <ZarayIcon name={item.icon} size={21} /><span>{item.label}</span>
        </Link>;
      })}
    </nav>}
  </div>;
}
