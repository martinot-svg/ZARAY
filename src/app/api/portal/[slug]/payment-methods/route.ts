import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!/^[a-z0-9-]{2,80}$/i.test(slug)) return json({ error: 'Portail introuvable.' }, 404);
  try {
    // Only public recipient details are returned by this narrowly scoped RPC.
    // This endpoint must not depend on a service-role credential.
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_public_manual_payment_methods', { p_company_slug: slug.toLowerCase() });
    if (error) {
      console.error('public manual payment methods failed', { code: error.code });
      return json({ error: 'Impossible de charger les moyens de paiement.' }, 503);
    }
    return json({ methods: (data ?? []).map((method: { provider: string; account_number: string; account_name: string; instructions: string }) => ({
      provider: method.provider,
      accountNumber: method.account_number,
      accountName: method.account_name,
      instructions: method.instructions,
    })) });
  } catch {
    return json({ error: 'Impossible de charger les moyens de paiement.' }, 503);
  }
}
