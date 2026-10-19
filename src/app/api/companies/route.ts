import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COMPANY_NAME = /^[\\p{L}\\p{N} .,'’()&-]{2,160}$/u;
const SLUG = /^[a-z0-9][a-z0-9-]{2,62}$/;
function json(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  let session;
  try {
    const result = await getAuth().getSession();
    session = result.data;
  } catch {
    return json('Le service d’authentification est indisponible.', 503);
  }
  if (!session?.user?.id) return json('Connectez-vous avant de créer une entreprise.', 401);
  if (!session.user.emailVerified) return json('Vérifiez votre adresse e-mail avant de continuer.', 403);

  let body: unknown;
  try { body = await request.json(); } catch { return json('Requête JSON invalide.', 400); }
  if (!body || typeof body !== 'object') return json('Données invalides.', 400);
  const input = body as Record<string, unknown>;
  const legalName = typeof input.legalName === 'string' ? input.legalName.trim() : '';
  const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
  if (!COMPANY_NAME.test(legalName) || !SLUG.test(slug)) return json('Nom ou identifiant de l’entreprise invalide.', 400);

  try {
    const sql = getDb();
    // One SQL statement: either company, owner and audit record are all committed, or none is.
    const rows = await sql`
      WITH new_company AS (
        INSERT INTO public.companies (legal_name, slug)
        VALUES (${legalName}, ${slug})
        RETURNING id, legal_name, slug, status, trial_ends_at
      ), new_owner AS (
        INSERT INTO public.company_members (company_id, user_id, role)
        SELECT id, ${session.user.id}::uuid, 'owner' FROM new_company
        RETURNING company_id
      ), event AS (
        INSERT INTO public.audit_logs (company_id, actor_user_id, event)
        SELECT company_id, ${session.user.id}::uuid, 'company.created' FROM new_owner
        RETURNING id
      )
      SELECT id, legal_name, slug, status, trial_ends_at FROM new_company
      WHERE EXISTS (SELECT 1 FROM new_owner) AND EXISTS (SELECT 1 FROM event)
    `;
    const company = rows[0];
    if (!company) return json('Création non confirmée.', 500);
    return NextResponse.json({ company }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === '23505' || String(error).includes('duplicate key')) return json('Cet identifiant d’entreprise est déjà utilisé.', 409);
    console.error('company creation failed', { code: pgError.code ?? 'unknown' });
    return json('Impossible de créer l’entreprise.', 500);
  }
}

export async function GET() {
  return json('Liste des entreprises non disponible sur cette route. Utilisez un endpoint authentifié et filtré.', 405);
}
