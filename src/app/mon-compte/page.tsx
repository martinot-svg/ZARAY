import PersonalShell from '@/components/personal-shell';
import DailyInspiration from '@/components/daily-inspiration';
import Link from 'next/link';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import { loadPersonalContext } from '@/lib/personal-context';

export const dynamic = 'force-dynamic';

export default async function PersonalHomePage() {
  const { identity, companies, error } = await loadPersonalContext();
  const companyForInvitations = companies.find(company => company.role === 'owner' || company.role === 'admin');

  return <PersonalShell home active="/mon-compte" email={identity.email} name={identity.name}
    inviteCompanyId={companyForInvitations?.id ?? null} dashboardCompanyId={companies[0]?.id ?? null}>
    <section className="personal-home-stage" aria-labelledby="personal-welcome-title">
      <div className="personal-home-welcome">
        <h1 id="personal-welcome-title">
          {identity.name ? 'Bonjour, ' + identity.name : 'Bonjour'}
        </h1>
        <DailyInspiration />
        <div className="personal-home-commandline" aria-label="Accès rapide à ZARAY">
          <Link href="/entreprises" className="personal-command-card">
            <span className="personal-command-card-top"><ZarayIcon name="company" size={21} /><span className="personal-command-arrow"><ZarayIcon name="next" size={19} /></span></span>
            <span className="personal-command-card-label">MES ENTREPRISES</span>
            <strong>{companies.length.toLocaleString('fr-FR')}</strong>
            <small>Entreprises auxquelles vous avez accès</small>
          </Link>
          <Link href="/finance-globale" className="personal-command-card">
            <span className="personal-command-card-top"><ZarayIcon name="finance" size={21} /><span className="personal-command-arrow"><ZarayIcon name="next" size={19} /></span></span>
            <span className="personal-command-card-label">PILOTAGE FINANCIER</span>
            <strong>Finance globale</strong>
            <small>Paiements confirmés et périmètres autorisés</small>
          </Link>
          {companyForInvitations && <Link href="/z-alliance" className="personal-command-card">
            <span className="personal-command-card-top"><ZarayIcon name="alliance" size={21} /><span className="personal-command-arrow"><ZarayIcon name="next" size={19} /></span></span>
            <span className="personal-command-card-label">COLLABORATION</span>
            <strong>Z’Alliance</strong>
            <small>Gestion des invitations et des accès</small>
          </Link>}
        </div>
        {error && <p className="personal-home-error" role="alert">{error}</p>}
      </div>
    </section>
  </PersonalShell>;
}
