import type { SupabaseClient, User } from '@supabase/supabase-js';

export type ManualPaymentAuth = {
  supabase: SupabaseClient;
  user: User;
  companyId: string;
  role: 'owner' | 'admin';
};

export async function authorizeManualPaymentAdmin(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ ok: true; user: User; role: 'owner' | 'admin' } | { ok: false; status: number; error: string }> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, status: 401, error: 'Connectez-vous pour continuer.' };
  if (!user.email_confirmed_at) return { ok: false, status: 403, error: 'Vérifiez votre adresse e-mail.' };
  const { data: member, error } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (error) return { ok: false, status: 503, error: 'Impossible de vérifier les autorisations.' };
  if (!member || !['owner', 'admin'].includes(member.role)) {
    return { ok: false, status: 403, error: 'Action réservée au dirigeant et aux administrateurs autorisés.' };
  }
  return { ok: true, user, role: member.role as 'owner' | 'admin' };
}
