import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId') ?? '';
  if (!companyId) return NextResponse.json({ error: 'Identifiant d’entreprise requis.' }, { status: 400 });
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
    if (!user.email_confirmed_at) return NextResponse.json({ error: 'E-mail non vérifié.' }, { status: 403 });
    const { data, error } = await supabase.rpc('list_company_audit_logs', { p_company_id: companyId, p_limit: 50 });
    if (error) return NextResponse.json({ error: error.code === '42501' ? 'Accès réservé aux rôles autorisés.' : 'Impossible de charger le journal.' }, { status: error.code === '42501' ? 403 : 500, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Service temporairement indisponible.' }, { status: 503 }); }
}
