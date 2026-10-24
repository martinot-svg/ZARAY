import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

async function auth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, response: json('Connectez-vous pour continuer.', 401) };
  if (!user.email_confirmed_at) return { supabase, user: null, response: json('Vérifiez votre adresse e-mail avant de continuer.', 403) };
  return { supabase, user, response: null };
}

function rpcError(error: { code?: string; message?: string }) {
  if (error.code === '42501') return json('Action non autorisée pour ce rôle ou cette entreprise.', 403);
  if (error.code === '23505') return json('Ce membre existe déjà ou une invitation est déjà en attente.', 409);
  if (error.code === '22023') return json('Les données envoyées sont invalides.', 400);
  if (error.code === 'P0002') return json('Membre introuvable.', 404);
  console.error('company member operation failed', { code: error.code ?? 'unknown' });
  return json('Opération impossible pour le moment.', 500);
}

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId') ?? '';
  if (!companyId) return json('Identifiant d’entreprise requis.', 400);
  try {
    const { supabase, response } = await auth();
    if (response) return response;
    const { data, error } = await supabase.rpc('list_company_members', { p_company_id: companyId });
    if (error) return rpcError(error);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return json('Service temporairement indisponible.', 503); }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.companyId !== 'string' || typeof body.email !== 'string' || typeof body.role !== 'string') {
    return json('Entreprise, e-mail et rôle sont requis.', 400);
  }
  const email = body.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json('Adresse e-mail invalide.', 400);
  const allowed = ['admin', 'site_manager', 'support', 'technician', 'sales', 'finance'];
  if (!allowed.includes(body.role)) return json('Rôle invalide.', 400);
  try {
    const { supabase, response } = await auth();
    if (response) return response;
    const { data, error } = await supabase.rpc('create_company_invitation', {
      p_company_id: body.companyId, p_email: email, p_role: body.role,
    });
    if (error) return rpcError(error);
    return NextResponse.json({ invitation: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch { return json('Service temporairement indisponible.', 503); }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.companyId !== 'string' || typeof body.userId !== 'string' || typeof body.role !== 'string' || typeof body.status !== 'string') {
    return json('Entreprise, membre, rôle et statut sont requis.', 400);
  }
  try {
    const { supabase, response } = await auth();
    if (response) return response;
    const { data, error } = await supabase.rpc('update_company_member', {
      p_company_id: body.companyId, p_member_user_id: body.userId, p_role: body.role, p_status: body.status,
    });
    if (error) return rpcError(error);
    return NextResponse.json({ member: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return json('Service temporairement indisponible.', 503); }
}
