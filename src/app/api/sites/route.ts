import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const SITE_NAME = /^[\p{L}\p{N} .,'’()&-]{2,120}$/u;
const STATUSES = new Set(['planned', 'active', 'suspended', 'archived']);

function json(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function verifiedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, response: json('Connectez-vous avant de continuer.', 401) };
  if (!user.email_confirmed_at) return { supabase, user: null, response: json('Vérifiez votre adresse e-mail avant de continuer.', 403) };
  return { supabase, user, response: null };
}

export async function GET() {
  try {
    const { supabase, user, response } = await verifiedClient();
    if (response || !user) return response ?? json('Authentification requise.', 401);

    const { data: memberships, error: membershipsError } = await supabase
      .from('company_members').select('company_id, role').eq('user_id', user.id).eq('status', 'active');
    if (membershipsError) throw membershipsError;

    const companyIds = (memberships ?? []).map((membership) => membership.company_id);
    if (!companyIds.length) {
      return NextResponse.json({ companies: [], sites: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const [{ data: companies, error: companiesError }, { data: sites, error: sitesError }] = await Promise.all([
      supabase.from('companies').select('id, legal_name, slug').in('id', companyIds).order('legal_name'),
      supabase.from('sites').select('id, company_id, name, status, created_at').in('company_id', companyIds).order('name'),
    ]);
    if (companiesError) throw companiesError;
    if (sitesError) throw sitesError;

    const companyById = new Map((companies ?? []).map((company) => [company.id, company]));
    const roleByCompany = new Map((memberships ?? []).map((membership) => [membership.company_id, membership.role]));
    return NextResponse.json({
      companies: (companies ?? []).map((company) => ({ ...company, role: roleByCompany.get(company.id) })),
      sites: (sites ?? []).map((site) => {
        const company = companyById.get(site.company_id);
        return { ...site, company_name: company?.legal_name ?? '', company_slug: company?.slug ?? '' };
      }),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('sites list failed', { code: (error as { code?: string }).code ?? 'unknown' });
    return json('Impossible de charger les entreprises et sites.', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, response } = await verifiedClient();
    if (response || !user) return response ?? json('Authentification requise.', 401);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return json('Données invalides.', 400);
    const input = body as Record<string, unknown>;
    const companyId = typeof input.companyId === 'string' ? input.companyId : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!companyId || !SITE_NAME.test(name)) return json('Entreprise ou nom de site invalide.', 400);

    const { data, error } = await supabase.rpc('create_site_for_current_user', { p_company_id: companyId, p_name: name });
    if (error) {
      if (error.code === '23505') return json('Ce nom de site existe déjà dans cette entreprise.', 409);
      if (error.code === '42501') return json('Entreprise inaccessible ou permission insuffisante.', 403);
      if (error.code === '22P02' || error.code === '22023') return json('Entreprise ou nom de site invalide.', 400);
      console.error('site creation failed', { code: error.code });
      return json('Impossible de créer le site.', 500);
    }
    return NextResponse.json({ site: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('site creation failed', { code: (error as { code?: string }).code ?? 'unknown' });
    return json('Impossible de créer le site.', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user, response } = await verifiedClient();
    if (response || !user) return response ?? json('Authentification requise.', 401);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return json('Données invalides.', 400);
    const input = body as Record<string, unknown>;
    const siteId = typeof input.siteId === 'string' ? input.siteId : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const status = typeof input.status === 'string' ? input.status : '';
    if (!siteId || !SITE_NAME.test(name) || !STATUSES.has(status)) return json('Données de site invalides.', 400);

    const { data, error } = await supabase.rpc('update_site_for_current_user', { p_site_id: siteId, p_name: name, p_status: status });
    if (error) {
      if (error.code === '23505') return json('Ce nom de site existe déjà dans cette entreprise.', 409);
      if (error.code === '42501') return json('Site inaccessible ou modification non autorisée.', 403);
      if (error.code === '22P02' || error.code === '22023') return json('Identifiant ou données de site invalides.', 400);
      console.error('site update failed', { code: error.code });
      return json('Impossible de modifier le site.', 500);
    }
    return NextResponse.json({ site: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('site update failed', { code: (error as { code?: string }).code ?? 'unknown' });
    return json('Impossible de modifier le site.', 500);
  }
}
