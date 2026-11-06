import Link from 'next/link';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import PersonalShell from '@/components/personal-shell';
import CompanyLifecyclePanel from '@/components/company-lifecycle-panel';
import { loadPersonalContext } from '@/lib/personal-context';

export const dynamic = 'force-dynamic';

export default async function EnterprisesPage() {
  const { identity, companies, error } = await loadPersonalContext();
  return <PersonalShell active="/entreprises" email={identity.email} name={identity.name}
    inviteCompanyId={companies.find(company => company.role === 'owner' || company.role === 'admin')?.id ?? null} dashboardCompanyId={companies[0]?.id ?? null}>
    
    {error ? <div className="alert alert-error" role="alert">{error}</div> : companies.length
      ? <section className="personal-business-list" aria-label="Entreprises accessibles">
        {companies.map(company => <article className="panel personal-business-card" key={company.id}>
          <div><p className="eyebrow">ENTREPRISE</p><h2>{company.legal_name}</h2><p className="muted">{company.slug}</p>
            <span className="status-pill">Rôle : {company.role}</span> <span className="status-pill">Statut : {company.status==='trial'?'Essai':company.status==='active'?'Active':company.status==='suspended'?'Suspendue':company.status==='grace'?'Grâce':company.status}</span></div>
          <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}}>
           <Link prefetch={true} className="primary-link" href={'/tableau-de-bord?companyId=' + encodeURIComponent(company.id)}><ZarayIcon name="company" size={18} /> Ouvrir l'entreprise</Link>
           {['owner','admin'].includes(company.role)&&<Link className="header-link" href={'/sites?companyId='+encodeURIComponent(company.id)}><ZarayIcon name="settings" size={18} /> Gérer les sites</Link>}
          </div>
          {['owner','admin'].includes(company.role)&&<CompanyLifecyclePanel company={company}/>}
        </article>)}
      </section>
      : <section className="empty-state"><strong>Aucune entreprise accessible</strong><p>Créez votre première entreprise pour commencer.</p></section>}
  </PersonalShell>;
}
