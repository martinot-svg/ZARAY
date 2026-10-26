import 'server-only';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type PersonalCompany = { id: string; legal_name: string; slug: string; role: string };
export async function loadPersonalContext() {
  const client = await createClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user || !user.email_confirmed_at) redirect('/connexion');

  const rawName: unknown = user.user_metadata?.full_name;
  const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null;
  const identity = { name, email: user.email ?? null };
  const { data: memberships, error: membershipError } = await client.from('company_members')
    .select('company_id,role').eq('user_id', user.id).eq('status', 'active');

  if (membershipError) return { client, identity, companies: [] as PersonalCompany[], error: 'Impossible de vérifier vos autorisations.' };
  const roleById = new Map((memberships ?? []).map(m => [m.company_id, m.role]));
  const ids = [...roleById.keys()];
  if (!ids.length) return { client, identity, companies: [] as PersonalCompany[], error: null };
  const { data: companies, error: companiesError } = await client.from('companies')
    .select('id,legal_name,slug').in('id', ids).order('legal_name');
  if (companiesError) return { client, identity, companies: [] as PersonalCompany[], error: 'Impossible de charger vos entreprises.' };
  return { client, identity, companies: (companies ?? []).map(c => ({ ...c, role: roleById.get(c.id) ?? '' })), error: null };
}
