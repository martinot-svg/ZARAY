import Link from 'next/link';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import PersonalShell from '@/components/personal-shell';
import { loadPersonalContext } from '@/lib/personal-context';

export const dynamic = 'force-dynamic';

export default async function EnterprisesPage() {
  const { identity, companies, error } = await loadPersonalContext();
  return <PersonalShell active="/entreprises" email={identity.email} name={identity.name}
    inviteCompanyId={companies.find(company => company.role === 'owner' || company.role === 'admin')?.id ?? null} dashboardCompanyId={companies[0]?.id ?? null}>
    <div className="personal-page-heading personal-enterprises-heading"><h1>Mes entreprises</h1></div>
    {error ? <div className="alert alert-error" role="alert">{error}</div> : companies.length
      ? <section className="personal-business-list" aria-label="Entreprises accessibles">
        {companies.map(company => <article className="panel personal-business-card" key={company.id}>
          <div><p className="eyebrow">ENTREPRISE</p><h2>{company.legal_name}</h2><p className="muted">{company.slug}</p>
            <span className="status-pill">Rôle : {company.role}</span></div>
          <Link prefetch={true} className="primary-link" href={'/tableau-de-bord?companyId=' + encodeURIComponent(company.id)}><ZarayIcon name="company" size={18} /> Ouvrir l'entreprise</Link>
        </article>)}
      </section>
      : <section className="empty-state"><strong>Aucune entreprise accessible</strong><p>Créez votre première entreprise pour commencer.</p></section>}
  </PersonalShell>;
}
