import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const COMPANY_NAME = /^[\p{L}\p{N} .,'’()&-]{2,160}$/u;
const SLUG = /^[a-z0-9][a-z0-9-]{2,62}$/;

function json(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return json('Requête JSON invalide.', 400); }
  if (!body || typeof body !== 'object') return json('Données invalides.', 400);

  const input = body as Record<string, unknown>;
  const legalName = typeof input.legalName === 'string' ? input.legalName.trim() : '';
  const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
  if (!COMPANY_NAME.test(legalName) || !SLUG.test(slug)) return json('Nom ou identifiant de l’entreprise invalide.', 400);

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json('Connectez-vous avant de créer une entreprise.', 401);
    if (!user.email_confirmed_at) return json('Vérifiez votre adresse e-mail avant de continuer.', 403);

    // Forward the verified session JWT explicitly to PostgREST. This keeps auth.uid()
    // consistent between Auth.getUser() and the RLS/trigger checks on the database.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session || session.user.id !== user.id) {
      return json('Votre session a expiré. Déconnectez-vous puis reconnectez-vous.', 401);
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) return json('Configuration du service indisponible.', 503);
    const databaseClient = createSupabaseClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: 'Bearer ' + session.access_token } },
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    const { data: company, error } = await databaseClient
      .from('companies')
      .insert({ legal_name: legalName, slug, owner_user_id: user.id })
      .select('id, legal_name, slug, status, trial_ends_at')
      .single();

    if (error) {
      if (error.code === '23505') return json('Cet identifiant d’entreprise est déjà utilisé.', 409);
      if (error.code === '42501') {
        console.warn('company creation authorization rejected', { code: error.code, userId: user.id });
        return json('La base de données a refusé la création avec cette session. Déconnectez-vous, reconnectez-vous, puis réessayez.', 403);
      }
      console.error('company creation failed', { code: error.code });
      return json('Impossible de créer l’entreprise.', 500);
    }
    return NextResponse.json({ company }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return json('Le service de données ou d’authentification est indisponible.', 503);
  }
}

export async function GET() {
  return json('Liste des entreprises non disponible sur cette route. Utilisez un endpoint authentifié et filtré.', 405);
}
