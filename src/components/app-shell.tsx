'use client';

import { useEffect, useState, type ReactNode } from 'react';
import BrandLogo from '@/components/brand-logo';

const sections = [
  { label: 'ESPACE', items: [['/tableau-de-bord', 'Tableau de bord'], ['/entreprises/nouvelle', 'Entreprises'], ['/sites', 'Sites'], ['/membres', 'Membres']] },
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
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);
  return <div className="app-shell">
    <button type="button" className={`app-nav-scrim${menuOpen ? ' is-open' : ''}`}
      aria-label="Fermer la navigation" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)} />
    <aside id="zaray-app-nav" className={`app-nav${menuOpen ? ' is-open' : ''}`} aria-label="Navigation ZARAY">
      <div className="app-nav-mobile-head"><strong>Navigation</strong><button type="button" onClick={() => setMenuOpen(false)}>Fermer</button></div>
      <a className="app-brand" href="/" aria-label="ZARAY · Accueil"><BrandLogo priority /></a>
      {activeSite && activeCompany && <div className="app-nav-group"><span className="app-nav-label">SITE ACTIF</span><a className="app-nav-link" href={'/sites/'+encodeURIComponent(activeSite)+'?companyId='+encodeURIComponent(activeCompany)}>Tableau de bord du site</a></div>}
      {sections.map((section) => <div className="app-nav-group" key={section.label}>
        <span className="app-nav-label">{section.label}</span>
        {section.items.map(([href, label]) => {
          const scoped=activeCompany ? href+(href.includes('?')?'&':'?')+'companyId='+encodeURIComponent(activeCompany)+(activeSite && href !== '/tableau-de-bord' ? '&siteId='+encodeURIComponent(activeSite) : '') : href;
          return <a key={href} className={'app-nav-link' + (activePath === href ? ' active' : '')} href={scoped} aria-current={activePath === href ? 'page' : undefined}>{label}</a>;
        })}
      </div>)}
      <div className="app-nav-footer"><a className="app-nav-link" href="/">Voir le site public</a><a className="app-nav-link" href="/connexion">Compte · Déconnexion</a></div>
    </aside>
    <div className="app-main">
      <header className="app-topbar">
        <button className="app-menu-button" type="button" aria-controls="zaray-app-nav" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>Menu</button>
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
        <a className="header-link" href={activeCompany?'/tableau-de-bord?companyId='+encodeURIComponent(activeCompany):'/tableau-de-bord'}>Vue générale</a>
      </header>
      <main className="app-content">
        {(eyebrow || title || description || actions) && <header className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}{title && <h1 className="app-title">{title}</h1>}{description && <p className="app-subtitle">{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>}
        {children}
      </main>
    </div>
  </div>;
}
