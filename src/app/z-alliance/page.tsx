import PersonalShell from '@/components/personal-shell';
import ZAllianceWorkspace from '@/components/z-alliance-workspace';
import { loadPersonalContext } from '@/lib/personal-context';

export const dynamic = 'force-dynamic';

export default async function ZAlliancePage() {
  const { identity, companies, error } = await loadPersonalContext();
  const invitationCompany = companies.find(company => company.role === 'owner' || company.role === 'admin');
  return <PersonalShell home active="/z-alliance" email={identity.email} name={identity.name}
    inviteCompanyId={invitationCompany?.id ?? null} dashboardCompanyId={companies[0]?.id ?? null}>
    <ZAllianceWorkspace companies={companies} actorEmail={identity.email} contextError={error} />
  </PersonalShell>;
}
