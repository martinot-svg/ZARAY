import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizeTenant } from '@/lib/tenant-context';
import { getDashboardData } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId') || '';
  const siteId = request.nextUrl.searchParams.get('siteId') || null;
  try {
    const client = await createClient();
    const access = await authorizeTenant(client, companyId, siteId);
    if (!access.ok) return fail(access.error, access.status);
    const data = await getDashboardData(client, companyId, siteId, access);
    return NextResponse.json(data, { headers: noStore });
  } catch {
    return fail('Impossible de charger le tableau de bord.', 503);
  }
}
