'use client';
import { fetchWorkspaceDirectory } from '@/lib/workspace-directory-request';
import { ZarayIcon } from '@/components/ui/zaray-icon';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import SignOutButton from '@/components/sign-out-button';
import BrandLogo from '@/components/brand-logo';
import ThemeSwitch from '@/components/theme-switch';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const sections = [
  { label: 'GESTION', items: [['/tableau-de-bord', 'Tableau de bord'], ['/sites', 'Sites'], ['/membres', 'Membres'], ['/notifications', 'Notifications']] },
  { label: 'ACTIVITÉ', items: [['/clients', 'Clients'], ['/offres', 'Offres Internet'], ['/commandes', 'Commandes'], ['/abonnements', 'Abonnements résidentiels'], ['/tickets', 'Tickets Wi-Fi']] },
  { label: 'FINANCE & RÉSEAU', items: [['/paiements/verification', 'Paiements'], ['/parametres-paiement', 'Moyens de paiement'], ['/portail', 'Portail captif'], ['/gestion-reseau', 'Gestion réseau']] },
];

const mobileDockItems = [
  { href: '/tableau-de-bord', label: 'Accueil', icon: 'dashboard', scoped: false },
  { href: '/clients', label: 'Clients', icon: 'customers', scoped: true },
  { href: '/tickets', label: 'Tickets', icon: 'ticket', scoped: true },
  { href: '/sites', label: 'Sites', icon: 'site', scoped: false },
] as const;

const navigationIcons = {
  '/tableau-de-bord': 'dashboard', '/entreprises': 'company', '/sites': 'site',
  '/membres': 'members', '/clients': 'customers', '/offres': 'wifi',
  '/commandes': 'orders', '/abonnements': 'wifi', '/tickets': 'ticket', '/paiements/verification': 'payment',
  '/parametres-paiement': 'finance', '/portail': 'network', '/gestion-reseau': 'network', '/notifications': 'notifications',
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
  '/gestion-reseau':{accent:'cyan'},
  '/notifications':{accent:'mint'}
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
  const [siteOpen, setSiteOpen] = useState(false);
  const siteButton = useRef<HTMLButtonElement>(null);
  const siteContainer = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const firstMenuLink = useRef<HTMLAnchorElement>(null);
  const menuContainer = useRef<HTMLDivElement>(null);
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  const hoverMenus = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  useEffect(() => {
    if (!menuOpen && !siteOpen) return;
    // Both icon menus remain keyboard accessible without hijacking toolbar focus.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (siteOpen) { setSiteOpen(false); siteButton.current?.focus(); }
        else { setMenuOpen(false); menuButton.current?.focus(); }
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (menuOpen && !menuContainer.current?.contains(event.target)) setMenuOpen(false);
      if (siteOpen && !siteContainer.current?.contains(event.target)) setSiteOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    return () => { window.removeEventListener('keydown', closeOnEscape); document.removeEventListener('pointerdown', closeOutside); };
  }, [menuOpen, siteOpen]);

  function selectSite(next: string) {
    setSiteOpen(false);
    if (!activeCompany) return;
    router.push(next
      ? '/sites/' + encodeURIComponent(next) + '?companyId=' + encodeURIComponent(activeCompany)
      : '/tableau-de-bord?companyId=' + encodeURIComponent(activeCompany));
  }
  return <div className="app-shell app-no-sidebar" data-workspace-chapter={chapter.accent} data-workspace-path={activePath}>
    <div className="app-main">
      <header className="app-topbar zaray-icon-topbar">
        <Link className="app-topbar-brand" href="/mon-compte" aria-label="ZARAY · Espace personnel"><BrandLogo /></Link>
        <h1 className="app-topbar-title" title={moduleTitle}>{moduleTitle}</h1>
        <div className="app-topbar-links">
        <div className="app-menu-container" ref={menuContainer}
          onMouseEnter={() => { if (hoverMenus()) { setMenuOpen(true); setSiteOpen(false); } }}
          onMouseLeave={() => { if (hoverMenus() && !menuContainer.current?.contains(document.activeElement)) setMenuOpen(false); }}>
          <button ref={menuButton} className="app-menu-button" type="button"
            aria-controls="zaray-app-nav" aria-expanded={menuOpen}
            aria-label="Ouvrir la navigation de l’entreprise"
            onClick={() => { setMenuOpen(value => !value); setSiteOpen(false); }}>
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
            {activeSite && activeCompany && <div className="app-nav-group">
              <span className="app-nav-label">SITE ACTIF</span>
              <Link className="app-nav-link" href={'/sites/'+encodeURIComponent(activeSite)+'?companyId='+encodeURIComponent(activeCompany)}
                onClick={() => setMenuOpen(false)}>
                <ZarayIcon name="dashboard" size={18} /> Tableau de bord du site
              </Link>
            </div>}
            {sections.map(section => <div className="app-nav-group" key={section.label}>
              <span className="app-nav-label">{section.label}</span>
              {section.items.map(([href, label]) => {
                const siteOperational = ['/clients','/commandes','/abonnements','/tickets','/paiements/verification'].includes(href);
                const scoped=href === '/entreprises' ? href : activeCompany
                  ? href+(href.includes('?')?'&':'?')+'companyId='+encodeURIComponent(activeCompany)+(activeSite && siteOperational ? '&siteId='+encodeURIComponent(activeSite) : '')
                  : href;
                return <Link key={href}
                  ref={href === '/tableau-de-bord' ? firstMenuLink : undefined}
                  href={scoped}
                  className={'app-nav-link' + (activePath === href ? ' active' : '')}
                  aria-current={activePath === href ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}>
                  <ZarayIcon name={navigationIcons[href as keyof typeof navigationIcons] ?? 'next'} size={18} /> {label}
                </Link>;
              })}
            </div>)}
            <div className="app-nav-footer">
              <Link className="app-nav-link" href="/mon-compte" onClick={() => setMenuOpen(false)}>
                <ZarayIcon name="back" size={18} /> Retour au compte personnel
              </Link>
              <Link className="app-nav-link" href="/entreprises" onClick={() => setMenuOpen(false)}>
                <ZarayIcon name="company" size={18} /> Changer d’entreprise
              </Link>
              <SignOutButton />
            </div>
          </nav>
        </div>
        <div className="app-site-container" ref={siteContainer}>
          <button ref={siteButton} type="button" className="app-site-button"
            aria-label={activeSite ? 'Changer de site : ' + (sites.find(s => s.id === activeSite)?.name ?? 'Site actif') : 'Choisir un site'}
            title="Changer de site" aria-controls="zaray-site-picker" aria-expanded={siteOpen}
            onClick={() => { setSiteOpen(value => !value); setMenuOpen(false); }}>
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
          <div className="topbar-icon-group topbar-theme-control">
            <ThemeSwitch buttonRef={themeButtonRef} hideNativeTitle />
            <div className="topbar-icon-curtain" aria-label="Thème de l'interface">
              <div className="topbar-icon-curtain-inner">
                <button type="button" className="topbar-icon-menu-action"
                  onClick={() => themeButtonRef.current?.click()}>
                  <ZarayIcon name="settings" size={18} /> Changer le thème
                </button>
              </div>
            </div>
          </div>
          <div className="topbar-icon-group">
            <Link className="header-link" href="/mon-compte" aria-label="Mon compte">
              <ZarayIcon name="profile" size={22} /><span className="topbar-icon-label">Mon compte</span>
            </Link>
            <div className="topbar-icon-curtain" aria-label="Mon compte">
              <div className="topbar-icon-curtain-inner">
                <Link className="topbar-icon-menu-action" href="/mon-compte">
                  <ZarayIcon name="profile" size={18} /> Retour au compte personnel
                </Link>
              </div>
            </div>
          </div>
          <div className="topbar-icon-group">
            <Link className="header-link"
              href={activeCompany ? '/tableau-de-bord?companyId=' + encodeURIComponent(activeCompany) : '/entreprises'}
              aria-label="Vue générale">
              <ZarayIcon name="dashboard" size={22} /><span className="topbar-icon-label">Vue générale</span>
            </Link>
            <div className="topbar-icon-curtain" aria-label="Vue générale">
              <div className="topbar-icon-curtain-inner">
                <Link className="topbar-icon-menu-action"
                  href={activeCompany ? '/tableau-de-bord?companyId=' + encodeURIComponent(activeCompany) : '/entreprises'}>
                  <ZarayIcon name="dashboard" size={18} /> Vue générale
                </Link>
              </div>
            </div>
          </div>
          <div className="topbar-icon-group">
            <Link className="header-link"
              href={'/notifications'+(activeCompany?'?companyId='+encodeURIComponent(activeCompany)+(activeSite?'&siteId='+encodeURIComponent(activeSite):''):'')}
              aria-label="Notifications du site" title="Notifications du site">
              <ZarayIcon name="notifications" size={22}/>
            </Link>
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
