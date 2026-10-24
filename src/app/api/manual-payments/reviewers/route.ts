import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

async function getSession() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: json({ error: 'Connectez-vous pour continuer.' }, 401) } as const;
  if (!user.email_confirmed_at) return { error: json({ error: 'Vérifiez votre adresse e-mail.' }, 403) } as const;
  return { supabase, user } as const;
}

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) return json({ error: 'Entreprise invalide.' }, 400);
  try {
    const session = await getSession();
    if ('error' in session) return session.error;
    const { data, error } = await session.supabase.rpc('list_manual_payment_reviewers', { p_company_id: companyId });
    if (error) {
      if (error.code === '42501') return json({ error: 'Seul le dirigeant peut gérer les validateurs.' }, 403);
      console.error('manual payment reviewer list failed', { code: error.code });
      return json({ error: 'Impossible de charger les autorisations.' }, 503);
    }
    return json(data ?? { reviewers: [] });
  } catch { return json({ error: 'Service indisponible.' }, 503); }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const companyId = typeof body?.companyId === 'string' ? body.companyId : '';
  const userId = typeof body?.userId === 'string' ? body.userId : '';
  const authorized = body?.authorized;
  if (!/^[0-9a-f-]{36}$/i.test(companyId) || !/^[0-9a-f-]{36}$/i.test(userId) || typeof authorized !== 'boolean') {
    return json({ error: 'Données d’autorisation invalides.' }, 400);
  }
  try {
    const session = await getSession();
    if ('error' in session) return session.error;
    const { data, error } = await session.supabase.rpc('set_manual_payment_reviewer', {
      p_company_id: companyId, p_user_id: userId, p_authorized: authorized,
    });
    if (error) {
      if (error.code === '42501') return json({ error: 'Seul le dirigeant peut gérer les validateurs.' }, 403);
      if (error.code === '22023') return json({ error: 'Le validateur doit être un administrateur actif de cette entreprise.' }, 409);
      console.error('manual payment reviewer update failed', { code: error.code });
      return json({ error: 'Impossible de modifier cette autorisation.' }, 503);
    }
    return json({ result: data });
  } catch { return json({ error: 'Service indisponible.' }, 503); }
}
