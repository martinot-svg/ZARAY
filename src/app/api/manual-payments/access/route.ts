import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizeManualPaymentReviewer } from '@/lib/manual-payment-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) {
    return NextResponse.json({ error: 'Entreprise invalide.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const session = await createClient();
    const result = await authorizeManualPaymentReviewer(session, companyId);
    if (result.ok) return NextResponse.json({ canReview: true }, { headers: { 'Cache-Control': 'no-store' } });
    if (result.status === 403) return NextResponse.json({ canReview: false }, { headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ error: result.error }, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
