'use client';
import { ZarayIcon } from '@/components/ui/zaray-icon';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import SignOutButton from '@/components/sign-out-button';
import BrandLogo from '@/components/brand-logo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const sections = [
  { label: 'GESTION', items: [['/tableau-de-bord', 'Tableau de bord'], ['/sites', 'Sites'], ['/membres', 'Membres']] },
  { label: 'ACTIVITÉ', items: [['/clients', 'Clients'], ['/offres', 'Offres Internet'], ['/commandes', 'Commandes'], ['/tickets', 'Tickets Wi-Fi']] },
  { label: 'FINANCE & RÉSEAU', items: [['/paiements/verification', 'Paiements'], ['/parametres-paiement', 'Moyens de paiement'], ['/portail', 'Portail captif']] },
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
  '/commandes': 'orders', '/tickets': 'ticket', '/paiements/verification': 'payment',
  '/parametres-paiement': 'finance', '/portail': 'network',
} as const;
type WorkspaceCompany = { id:string; legal_name:string; role:string };
type WorkspaceSite = { id:string; company_id:string; name:string };
type AppShellProps = { children: ReactNode; activePath: string; companyId?:string; siteId?:string; eyebrow?: string; title?: string; description?: string; actions?: ReactNode };

export default function AppShell({ children, activePath, companyId, siteId, eyebrow, title, description, actions }: AppShellProps) {
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
        const response=await fetch('/api/sites',{cache:'no-store'});
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const firstMenuLink = useRef<HTMLAnchorElement>(null);
  const menuContainer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    firstMenuLink.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); } };
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuContainer.current?.contains(event.target)) setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    return () => { window.removeEventListener('keydown', closeOnEscape); document.removeEventListener('pointerdown', closeOutside); };
  }, [menuOpen]);
  return <div className="app-shell app-no-sidebar">
    <div className="app-main">
      <header className="app-topbar">
        <div className="app-menu-container" ref={menuContainer}>
          <button ref={menuButton} className="app-menu-button" type="button"
            aria-controls="zaray-app-nav" aria-expanded={menuOpen}
            onClick={() => setMenuOpen(value => !value)}>
            <ZarayIcon name="menu" size={18} /> Menu
          </button>
          <nav id="zaray-app-nav"
            className={'app-nav-dropdown' + (menuOpen ? ' is-open' : '')}
            aria-label="Navigation de l’entreprise" inert={!menuOpen} aria-hidden={!menuOpen}>
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
                const siteOperational = ['/clients','/commandes','/tickets','/paiements/verification'].includes(href);
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
        <Link className="app-topbar-brand" href="/mon-compte" aria-label="ZARAY · Espace personnel"><BrandLogo /></Link>
        <div className="workspace-context">
          <strong>Compte ZARAY</strong><span className="muted"> / </span>
          {companies.length>0 && activeCompany ? <>
            <strong aria-label="Entreprise active">{companies.find(c=>c.id===activeCompany)?.legal_name ?? 'Entreprise'}</strong>
            <label>Site <select aria-label="Site actif" value={activeSite} onChange={e=>{
              const next=e.target.value;
              router.push(next?'/sites/'+encodeURIComponent(next)+'?companyId='+encodeURIComponent(activeCompany):'/tableau-de-bord?companyId='+encodeURIComponent(activeCompany));
            }}>
              <option value="">Vue générale</option>{sites.filter(s=>s.company_id===activeCompany).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
          </>:<span className="muted">{contextError||null}</span>}
        </div>
        <div className="app-topbar-links"><Link className="header-link" href="/mon-compte"><ZarayIcon name="profile" size={18} /> Mon compte</Link><Link className="header-link" href={activeCompany?'/tableau-de-bord?companyId='+encodeURIComponent(activeCompany):'/entreprises'}><ZarayIcon name="dashboard" size={18} /> Vue générale</Link></div>
      </header>
      <main className="app-content">
        {(eyebrow || title || description || actions) && <header className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}{title && <h1 className="app-title">{title}</h1>}{description && <p className="app-subtitle">{description}</p>}<span className="workspace-hero-release"><ZarayIcon name="permissions" size={14} /> ZARAY EXPERIENCE · 2026</span></div>{actions && <div className="page-actions">{actions}</div>}</header>}
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
