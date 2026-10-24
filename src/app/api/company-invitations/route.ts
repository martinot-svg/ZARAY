import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json('Connectez-vous pour consulter vos invitations.', 401);
    if (!user.email_confirmed_at) return json('Vérifiez votre adresse e-mail.', 403);
    const { data, error } = await supabase.rpc('list_my_company_invitations');
    if (error) return json(error.code === '42501' ? 'Accès non autorisé.' : 'Impossible de charger les invitations.', error.code === '42501' ? 403 : 500);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return json('Service temporairement indisponible.', 503); }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.invitationId !== 'string') return json('Invitation invalide.', 400);
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json('Connectez-vous pour accepter cette invitation.', 401);
    if (!user.email_confirmed_at) return json('Vérifiez votre adresse e-mail.', 403);
    const { data, error } = await supabase.rpc('accept_company_invitation', { p_invitation_id: body.invitationId });
    if (error) {
      if (error.code === '42501') return json('Invitation invalide, expirée ou destinée à une autre adresse e-mail.', 403);
      if (error.code === '23505') return json('Vous êtes déjà membre de cette entreprise.', 409);
      console.error('invitation acceptance failed', { code: error.code ?? 'unknown' });
      return json('Impossible d’accepter cette invitation.', 500);
    }
    return NextResponse.json({ membership: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return json('Service temporairement indisponible.', 503); }
}
