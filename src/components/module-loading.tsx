import BrandLogo from '@/components/brand-logo';

type ModuleLoadingProps = {
  title: string;
  kind?: 'table' | 'dashboard' | 'form' | 'cards';
};

/** Real route/data transition: no fake content or artificial waiting period. */
export default function ModuleLoading({ title, kind = 'table' }: ModuleLoadingProps) {
  return <div className="module-loading-screen" role="status" aria-live="polite" aria-busy="true">
    <header className="module-loading-bar">
      <span className="module-loading-menu" aria-hidden="true"><i/><i/><i/></span>
      <span className="module-loading-logo"><BrandLogo /></span>
      <span className="module-loading-bar-text">ZARAY · ESPACE DE GESTION</span>
    </header>
    <main className="module-loading-content">
      <div className="module-loading-title">
        <p className="landing-label">CHARGEMENT DU MODULE</p>
        <h1>{title}</h1>
        <p>Récupération des informations autorisées…</p>
      </div>
      {kind === 'dashboard'
        ? <div className="module-loading-kpis" aria-hidden="true">{Array.from({ length: 4 }, (_, i) => <span key={i} />)}</div>
        : <div className="module-loading-toolbar" aria-hidden="true"><span/><span/><span/></div>}
      <section className={'module-loading-panel module-loading-' + kind} aria-hidden="true">
        <div className="module-loading-panel-title"/>
        <div className="module-loading-rows">
          {Array.from({ length: kind === 'form' ? 3 : 4 }, (_, i) => <span key={i} />)}
        </div>
      </section>
      <p className="module-loading-note">Si le chargement échoue, une explication et la possibilité de réessayer s’afficheront.</p>
    </main>
  </div>;
}
