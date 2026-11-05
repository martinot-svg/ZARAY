import PersonalShell from '@/components/personal-shell';
import NotificationInbox from '@/components/notification-inbox';
import {loadPersonalContext} from '@/lib/personal-context';
export const dynamic='force-dynamic';
export default async function GeneralNotifications(){
 const {identity,companies,error}=await loadPersonalContext();
 const ownerCompany=companies.find(c=>['owner','admin'].includes(c.role));
 return <PersonalShell active="/notifications-generales" email={identity.email} name={identity.name}
  inviteCompanyId={ownerCompany?.id??null} dashboardCompanyId={companies[0]?.id??null}>
  <section className="panel" style={{maxWidth:1050,margin:'0 auto'}}>
   {error?<p role="alert">{error}</p>:<NotificationInbox kind="staff"/>}
  </section>
 </PersonalShell>;
}
