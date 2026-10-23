import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const COMPANY_NAME = /^[\p{L}\p{N} .,'’()&-]{2,160}$/u;
const SLUG = /^[a-z0-9][a-z0-9-]{2,62}$/;

function json(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  let supabase;
  try {
    supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json('Connectez-vous avant de créer une entreprise.', 401);
    if (!user.email_confirmed_at) return json('Vérifiez votre adresse e-mail avant de continuer.', 403);
  } catch {
    return json('Le service d’authentification est indisponible.', 503);
  }

  let body: unknown;
  try { body = await request.json(); } catch { return json('Requête JSON invalide.', 400); }
  if (!body || typeof body !== 'object') return json('Données invalides.', 400);
  const input = body as Record<string, unknown>;
  const legalName = typeof input.legalName === 'string' ? input.legalName.trim() : '';
  const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
  if (!COMPANY_NAME.test(legalName) || !SLUG.test(slug)) return json('Nom ou identifiant de l’entreprise invalide.', 400);

  const { data, error } = await supabase.rpc('create_company_for_current_user', {
    p_legal_name: legalName,
    p_slug: slug,
  });
  if (error) {
    if (error.code === '23505') return json('Cet identifiant d’entreprise est déjà utilisé.', 409);
    if (error.code === '42501') return json('Vérifiez votre adresse e-mail avant de continuer.', 403);
    if (error.code === '22023') return json('Nom ou identifiant de l’entreprise invalide.', 400);
    console.error('company creation failed', { code: error.code });
    return json('Impossible de créer l’entreprise.', 500);
  }
  return NextResponse.json({ company: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  return json('Liste des entreprises non disponible sur cette route. Utilisez un endpoint authentifié et filtré.', 405);
}
