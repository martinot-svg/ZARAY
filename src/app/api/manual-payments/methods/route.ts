import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { authorizeManualPaymentReviewer } from '@/lib/manual-payment-auth';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const PROVIDERS = new Set(['orange_money','mvola']);

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) return json({ error: 'Entreprise invalide.' }, 400);
  try {
    const session = await createClient();
    const authorization = await authorizeManualPaymentReviewer(session, companyId);
    if (!authorization.ok) return json({ error: authorization.error }, authorization.status);
    const service = createServiceClient();
    if (!service) return json({ error: 'Service indisponible.' }, 503);
    const { data, error } = await service.from('manual_payment_methods')
      .select('id,company_id,provider,account_number,account_name,instructions,is_active,updated_at')
      .eq('company_id', companyId).order('provider');
    if (error) return json({ error: 'Impossible de charger les moyens de paiement.' }, 503);
    return json({ methods: data ?? [] });
  } catch { return json({ error: 'Service indisponible.' }, 503); }
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const companyId = typeof body?.companyId === 'string' ? body.companyId : '';
  const provider = typeof body?.provider === 'string' ? body.provider : '';
  const accountNumber = typeof body?.accountNumber === 'string' ? body.accountNumber.trim() : '';
  const accountName = typeof body?.accountName === 'string' ? body.accountName.trim() : '';
  const instructions = typeof body?.instructions === 'string' ? body.instructions.trim() : '';
  const isActive = body?.isActive === true;
  if (!/^[0-9a-f-]{36}$/i.test(companyId) || !PROVIDERS.has(provider)) return json({ error: 'Entreprise ou moyen de paiement invalide.' }, 400);
  if (!/^03[0-9]{8}$/.test(accountNumber) || accountName.length < 2 || accountName.length > 120 || instructions.length > 1000) {
    return json({ error: 'Vérifiez le numéro (format 03XXXXXXXX), le nom du bénéficiaire et les instructions.' }, 400);
  }
  try {
    const session = await createClient();
    const authorization = await authorizeManualPaymentReviewer(session, companyId);
    if (!authorization.ok) return json({ error: authorization.error }, authorization.status);
    const service = createServiceClient();
    if (!service) return json({ error: 'Service indisponible.' }, 503);
    const { data, error } = await service.from('manual_payment_methods').upsert({
      company_id: companyId, provider, account_number: accountNumber, account_name: accountName,
      instructions, is_active: isActive, updated_by: authorization.user.id, created_by: authorization.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,provider' })
      .select('id,company_id,provider,account_number,account_name,instructions,is_active,updated_at').single();
    if (error) {
      console.error('manual payment method save failed', { code: error.code });
      return json({ error: 'Impossible d’enregistrer ce moyen de paiement.' }, 503);
    }
    return json({ method: data });
  } catch { return json({ error: 'Service indisponible.' }, 503); }
}
