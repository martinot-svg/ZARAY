import { ZarayIcon } from '@/components/ui/zaray-icon';
import PersonalShell from '@/components/personal-shell';
import PersonalFinanceOverview from '@/components/personal-finance-overview';
import { loadPersonalContext } from '@/lib/personal-context';

export const dynamic = 'force-dynamic';

export default async function PersonalHomePage({ searchParams }: { searchParams: Promise<{ financeCompanyId?: string; currency?: string }> }) {
  const { financeCompanyId, currency } = await searchParams;
  const { client, identity, companies, error } = await loadPersonalContext();
  return <PersonalShell active="/mon-compte" email={identity.email} name={identity.name}>
    <header className="personal-page-heading">
      <p className="eyebrow">MON COMPTE ZARAY</p>
      <h1>{identity.name ? `Bonjour, ${identity.name}` : 'Bonjour'}</h1>
      <p>Votre accueil personnel. Choisissez une entreprise pour ouvrir son espace de gestion.</p>
    </header>
    {error ? <div className="alert alert-error" role="alert">{error}</div> : <>
      <PersonalFinanceOverview client={client} companies={companies} requestedCompanyId={financeCompanyId} requestedCurrency={currency} />
      {companies.length ? <section className="panel">
        <div className="panel-head"><h2 className="panel-title">Mes entreprises</h2><a className="header-link" href="/entreprises"><ZarayIcon name="show" size={18} /> Voir toutes mes entreprises</a></div>
        <div className="personal-business-list">{companies.map(company => <a key={company.id} className="personal-business-item" href={'/tableau-de-bord?companyId=' + encodeURIComponent(company.id)}><ZarayIcon name="next" size={18} /> 
          <span><strong>{company.legal_name}</strong><small>{company.slug}</small></span><span className="status-pill">{company.role}</span>
        </a>)}</div>
      </section> : <section className="empty-state"><strong>Aucune entreprise accessible</strong>
        <p>Votre compte personnel est prêt. Vous pouvez créer votre première entreprise.</p>
        <a className="primary-link" href="/entreprises/nouvelle"><ZarayIcon name="add" size={18} /> + Créer une entreprise</a>
      </section>}
      <div className="personal-quick-actions">
        <a href="/entreprises" className="quick-action"><ZarayIcon name="payment" size={18} /> Mes entreprises</a>
        <a href="/finance-globale" className="quick-action"><ZarayIcon name="payment" size={18} /> Finance globale autorisée</a>
      </div>
    </>}
  </PersonalShell>;
}
