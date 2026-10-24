import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId') ?? '';
  if (!companyId) return json('Identifiant d’entreprise requis.', 400);
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json('Connexion requise.', 401);
    if (!user.email_confirmed_at) return json('Vérifiez votre e-mail.', 403);
    const { data, error } = await supabase.from('payments')
      .select('id,company_id,order_id,provider,provider_payment_id,amount,currency,status,confirmed_at,created_at')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(200);
    if (error) { console.error('payments list failed', { code: error.code }); return json('Impossible de charger les paiements.', error.code === '42501' ? 403 : 500); }
    return NextResponse.json({ payments: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return json('Service indisponible.', 503); }
}
