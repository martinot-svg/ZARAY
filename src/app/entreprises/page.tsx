import Link from 'next/link';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import PersonalShell from '@/components/personal-shell';
import { loadPersonalContext } from '@/lib/personal-context';

export const dynamic = 'force-dynamic';

export default async function EnterprisesPage() {
  const { identity, companies, error } = await loadPersonalContext();
  return <PersonalShell active="/entreprises" email={identity.email} name={identity.name}
    inviteCompanyId={companies.find(company => company.role === 'owner' || company.role === 'admin')?.id ?? null} dashboardCompanyId={companies[0]?.id ?? null}>
    <div className="personal-page-heading"><p className="eyebrow">ESPACE PERSONNEL</p><h1>Mes entreprises</h1>
      <p>Uniquement les organisations auxquelles votre compte est rattaché.</p>
    </div>
    <a className="primary-link" href="/entreprises/nouvelle"><ZarayIcon name="add" size={18} /> + Créer une entreprise</a>
    {error ? <div className="alert alert-error" role="alert">{error}</div> : companies.length
      ? <section className="personal-business-list" aria-label="Entreprises accessibles">
        {companies.map(company => <article className="panel personal-business-card" key={company.id}>
          <div><p className="eyebrow">ENTREPRISE</p><h2>{company.legal_name}</h2><p className="muted">{company.slug}</p>
            <span className="status-pill">Rôle : {company.role}</span></div>
          <Link className="primary-link" href={'/tableau-de-bord?companyId=' + encodeURIComponent(company.id)}><ZarayIcon name="company" size={18} /> Ouvrir l'entreprise</Link>
        </article>)}
      </section>
      : <section className="empty-state"><strong>Aucune entreprise accessible</strong><p>Créez votre première entreprise pour commencer.</p>
        <a className="primary-link" href="/entreprises/nouvelle"><ZarayIcon name="add" size={18} /> Créer une entreprise</a></section>}
  </PersonalShell>;
}
