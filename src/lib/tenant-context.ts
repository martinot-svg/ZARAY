import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Tenant membership is checked on every scoped API request, not inferred from a browser selection. */
export async function authorizeTenant(client: Client, companyId: string, siteId?: string | null) {
  if (!UUID.test(companyId) || (siteId && !UUID.test(siteId))) {
    return { ok: false as const, status: 400, error: 'Identifiant de contexte invalide.' };
  }
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { ok: false as const, status: 401, error: 'Connexion requise.' };
  if (!user.email_confirmed_at) return { ok: false as const, status: 403, error: 'Adresse e-mail non vérifiée.' };
  const { data: member, error: memberError } = await client.from('company_members')
    .select('company_id,role').eq('user_id', user.id).eq('company_id', companyId).eq('status', 'active').maybeSingle();
  if (memberError) return { ok: false as const, status: 503, error: 'Autorisations indisponibles.' };
  if (!member) return { ok: false as const, status: 403, error: 'Entreprise inaccessible.' };
  if (siteId) {
    const { data: site, error } = await client.from('sites')
      .select('id,company_id,name,status').eq('id',siteId).eq('company_id',companyId).maybeSingle();
    if (error) return { ok: false as const, status: 503, error: 'Site indisponible.' };
    if (!site) return { ok: false as const, status: 404, error: 'Site inaccessible pour cette entreprise.' };
    return { ok: true as const, user, member, site };
  }
  return { ok: true as const, user, member, site: null };
}
