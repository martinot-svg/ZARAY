'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import SignOutButton from '@/components/sign-out-button';
import BrandLogo from '@/components/brand-logo';
import Link from 'next/link';

const sections = [
  { label: 'GESTION', items: [['/tableau-de-bord', 'Tableau de bord'], ['/entreprises', 'Entreprises'], ['/sites', 'Sites'], ['/membres', 'Membres']] },
  { label: 'ACTIVITÉ', items: [['/clients', 'Clients'], ['/offres', 'Offres Internet'], ['/commandes', 'Commandes'], ['/tickets', 'Tickets Wi-Fi']] },
  { label: 'FINANCE & RÉSEAU', items: [['/paiements/verification', 'Paiements'], ['/parametres-paiement', 'Moyens de paiement'], ['/portail', 'Portail captif']] },
];

type WorkspaceCompany = { id:string; legal_name:string; role:string };
type WorkspaceSite = { id:string; company_id:string; name:string };
type AppShellProps = { children: ReactNode; activePath: string; companyId?:string; siteId?:string; eyebrow?: string; title?: string; description?: string; actions?: ReactNode };

export default function AppShell({ children, activePath, companyId, siteId, eyebrow, title, description, actions }: AppShellProps) {
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
  useEffect(() => {
    if (!menuOpen) return;
    firstMenuLink.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);
  return <div className="app-shell">
    <button type="button" className={`app-nav-scrim${menuOpen ? ' is-open' : ''}`}
      aria-label="Fermer la navigation" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)} />
    <aside id="zaray-app-nav" className={`app-nav${menuOpen ? ' is-open' : ''}`} aria-label="Navigation de l’entreprise" inert={!menuOpen}>
      <div className="app-nav-mobile-head"><strong>Gestion de l'entreprise</strong><button type="button" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }}>Fermer</button></div>
      <a className="app-brand" href="/" aria-label="ZARAY · Accueil"><BrandLogo priority /></a>
      {activeSite && activeCompany && <div className="app-nav-group"><span className="app-nav-label">SITE ACTIF</span><a className="app-nav-link" href={'/sites/'+encodeURIComponent(activeSite)+'?companyId='+encodeURIComponent(activeCompany)}>Tableau de bord du site</a></div>}
      {sections.map((section) => <div className="app-nav-group" key={section.label}>
        <span className="app-nav-label">{section.label}</span>
        {section.items.map(([href, label]) => {
          const siteOperational = ['/clients','/commandes','/tickets','/paiements/verification'].includes(href);
          const scoped=href === '/entreprises' ? href : activeCompany ? href+(href.includes('?')?'&':'?')+'companyId='+encodeURIComponent(activeCompany)+(activeSite && siteOperational ? '&siteId='+encodeURIComponent(activeSite) : '') : href;
          return <Link key={href} ref={href === '/tableau-de-bord' ? firstMenuLink : undefined} className={'app-nav-link' + (activePath === href ? ' active' : '')} href={scoped} prefetch={false} aria-current={activePath === href ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{label}</Link>;
        })}
      </div>)}
      <div className="app-nav-footer"><a className="app-nav-link" href="/mon-compte">Retour au compte personnel</a><a className="app-nav-link" href="/entreprises">Mes entreprises</a><SignOutButton /></div>
    </aside>
    <div className="app-main">
      <header className="app-topbar">
        <button ref={menuButton} className="app-menu-button" type="button" aria-controls="zaray-app-nav" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>☰ Menu</button>
        <a className="app-topbar-brand" href="/mon-compte" aria-label="ZARAY · Espace personnel"><BrandLogo /></a>
        <div className="workspace-context">
          <strong>Compte ZARAY</strong><span className="muted"> / </span>
          {companies.length>0 && activeCompany ? <>
            <label>Entreprise <select aria-label="Entreprise active" value={activeCompany} onChange={e=>window.location.assign('/tableau-de-bord?companyId='+encodeURIComponent(e.target.value))}>
              {companies.map(c=><option key={c.id} value={c.id}>{c.legal_name}</option>)}
            </select></label>
            <label>Site <select aria-label="Site actif" value={activeSite} onChange={e=>{
              const next=e.target.value;
              window.location.assign(next?'/sites/'+encodeURIComponent(next)+'?companyId='+encodeURIComponent(activeCompany):'/tableau-de-bord?companyId='+encodeURIComponent(activeCompany));
            }}>
              <option value="">Vue générale</option>{sites.filter(s=>s.company_id===activeCompany).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
          </>:<span className="muted">{contextError||'Chargement du contexte…'}</span>}
        </div>
        <div className="app-topbar-links"><a className="header-link" href="/mon-compte">Mon compte</a><a className="header-link" href={activeCompany?'/tableau-de-bord?companyId='+encodeURIComponent(activeCompany):'/entreprises'}>Vue générale</a></div>
      </header>
      <main className="app-content">
        {(eyebrow || title || description || actions) && <header className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}{title && <h1 className="app-title">{title}</h1>}{description && <p className="app-subtitle">{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>}
        {children}
      </main>
    </div>
  </div>;
}
