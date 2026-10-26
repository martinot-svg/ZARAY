import { redirect } from 'next/navigation';
import DashboardWorkspace from '@/components/dashboard-workspace';
import { createClient } from '@/lib/supabase/server';
import { authorizeTenant } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

export default async function TableauDeBord({ searchParams }: { searchParams: Promise<{ companyId?: string }> }) {
  const { companyId } = await searchParams;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || !user.email_confirmed_at) redirect('/connexion');
  if (!companyId) redirect('/entreprises');

  const permission = await authorizeTenant(client, companyId);
  if (!permission.ok) {
    return <main className="form-shell"><section className="form-card">
      <h1>Accès à l’entreprise refusé</h1>
      <p role="alert">{permission.error}</p>
      <a className="primary-link" href="/entreprises">Revenir à mes entreprises</a>
    </section></main>;
  }
  return <DashboardWorkspace />;
}
