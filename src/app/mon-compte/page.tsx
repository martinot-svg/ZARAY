import PersonalShell from '@/components/personal-shell';
import DailyInspiration from '@/components/daily-inspiration';
import { loadPersonalContext } from '@/lib/personal-context';

export const dynamic = 'force-dynamic';

export default async function PersonalHomePage() {
  const { identity, companies, error } = await loadPersonalContext();
  const companyForInvitations = companies.find(company => company.role === 'owner' || company.role === 'admin');

  return <PersonalShell home active="/mon-compte" email={identity.email} name={identity.name}
    inviteCompanyId={companyForInvitations?.id ?? null}>
    <section className="personal-home-stage" aria-labelledby="personal-welcome-title">
      <div className="personal-home-welcome">
        <h1 id="personal-welcome-title">
          {identity.name ? 'Bonjour, ' + identity.name : 'Bonjour'}
        </h1>
        <DailyInspiration />
        {error && <p className="personal-home-error" role="alert">{error}</p>}
      </div>
    </section>
  </PersonalShell>;
}
