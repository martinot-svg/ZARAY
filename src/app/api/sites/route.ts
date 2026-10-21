import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE_NAME = /^[\p{L}\p{N} .,'’()&-]{2,120}$/u;
const EDIT_ROLES = new Set(['owner', 'admin', 'site_manager']);
const STATUSES = new Set(['planned', 'active', 'suspended', 'archived']);

function json(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function sessionUser() {
  const result = await getAuth().getSession();
  return result.data?.user ?? null;
}

export async function GET() {
  try {
    const user = await sessionUser();
    if (!user?.id) return json('Connectez-vous avant de consulter les sites.', 401);
    if (!user.emailVerified) return json('Vérifiez votre adresse e-mail avant de continuer.', 403);

    const sql = getDb();
    const companies = await sql`
      SELECT c.id, c.legal_name, c.slug, m.role
      FROM public.companies c
      JOIN public.company_members m ON m.company_id = c.id
      WHERE m.user_id = ${user.id}::uuid AND m.status = 'active'
      ORDER BY c.legal_name
    `;
    const sites = await sql`
      SELECT s.id, s.company_id, c.legal_name AS company_name, c.slug AS company_slug,
             s.name, s.status, s.created_at
      FROM public.sites s
      JOIN public.companies c ON c.id = s.company_id
      JOIN public.company_members m ON m.company_id = s.company_id
      WHERE m.user_id = ${user.id}::uuid AND m.status = 'active'
      ORDER BY c.legal_name, s.name
    `;
    return NextResponse.json({ companies, sites }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('sites list failed', { code: (error as { code?: string }).code ?? 'unknown' });
    return json('Impossible de charger les entreprises et sites.', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await sessionUser();
    if (!user?.id) return json('Connectez-vous avant de créer un site.', 401);
    if (!user.emailVerified) return json('Vérifiez votre adresse e-mail avant de continuer.', 403);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return json('Données invalides.', 400);
    const input = body as Record<string, unknown>;
    const companyId = typeof input.companyId === 'string' ? input.companyId : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!companyId || !SITE_NAME.test(name)) return json('Entreprise ou nom de site invalide.', 400);

    const sql = getDb();
    const membership = await sql`
      SELECT role FROM public.company_members
      WHERE company_id = ${companyId}::uuid AND user_id = ${user.id}::uuid AND status = 'active'
      LIMIT 1
    `;
    if (!membership[0]) return json('Entreprise inaccessible.', 403);
    if (!EDIT_ROLES.has(String(membership[0].role))) return json('Vous n’avez pas la permission de créer un site.', 403);

    const rows = await sql`
      WITH new_site AS (
        INSERT INTO public.sites (company_id, name)
        VALUES (${companyId}::uuid, ${name})
        RETURNING id, company_id, name, status, created_at
      ), event AS (
        INSERT INTO public.audit_logs (company_id, actor_user_id, event, metadata)
        SELECT company_id, ${user.id}::uuid, 'site.created', jsonb_build_object('site_id', id, 'site_name', name)
        FROM new_site
        RETURNING id
      )
      SELECT id, company_id, name, status, created_at FROM new_site
      WHERE EXISTS (SELECT 1 FROM event)
    `;
    if (!rows[0]) return json('Création non confirmée.', 500);
    return NextResponse.json({ site: rows[0] }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === '23505' || String(error).includes('duplicate key')) return json('Ce nom de site existe déjà dans cette entreprise.', 409);
    if (pgError.code === '22P02') return json('Identifiant d’entreprise invalide.', 400);
    console.error('site creation failed', { code: pgError.code ?? 'unknown' });
    return json('Impossible de créer le site.', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await sessionUser();
    if (!user?.id) return json('Connectez-vous avant de modifier un site.', 401);
    if (!user.emailVerified) return json('Vérifiez votre adresse e-mail avant de continuer.', 403);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return json('Données invalides.', 400);
    const input = body as Record<string, unknown>;
    const siteId = typeof input.siteId === 'string' ? input.siteId : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const status = typeof input.status === 'string' ? input.status : '';
    if (!siteId || !SITE_NAME.test(name) || !STATUSES.has(status)) return json('Données de site invalides.', 400);

    const sql = getDb();
    const rows = await sql`
      WITH target AS (
        SELECT s.id, s.company_id, m.role
        FROM public.sites s
        JOIN public.company_members m ON m.company_id = s.company_id
        WHERE s.id = ${siteId}::uuid AND m.user_id = ${user.id}::uuid AND m.status = 'active'
        LIMIT 1
      ), updated AS (
        UPDATE public.sites s SET name = ${name}, status = ${status}
        FROM target t WHERE s.id = t.id AND t.role IN ('owner','admin','site_manager')
        RETURNING s.id, s.company_id, s.name, s.status, s.created_at
      ), event AS (
        INSERT INTO public.audit_logs (company_id, actor_user_id, event, metadata)
        SELECT company_id, ${user.id}::uuid, 'site.updated', jsonb_build_object('site_id', id, 'site_name', name, 'status', status)
        FROM updated RETURNING id
      ) SELECT id, company_id, name, status, created_at FROM updated WHERE EXISTS (SELECT 1 FROM event)
    `;
    if (!rows[0]) return json('Site inaccessible ou modification non autorisée.', 403);
    return NextResponse.json({ site: rows[0] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === '23505') return json('Ce nom de site existe déjà dans cette entreprise.', 409);
    if (pgError.code === '22P02') return json('Identifiant de site invalide.', 400);
    console.error('site update failed', { code: pgError.code ?? 'unknown' });
    return json('Impossible de modifier le site.', 500);
  }
}
