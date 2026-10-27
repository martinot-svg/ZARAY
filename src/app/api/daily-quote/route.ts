import { NextRequest, NextResponse } from 'next/server';
import { getDailyQuote, quoteLibrary } from '@/lib/daily-quote-library';
import { getFrenchDailyQuote } from '@/lib/french-daily-quote';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? '';
  if (!getDailyQuote(date)) return NextResponse.json(
    { error: 'Date locale invalide.' },
    { status: 400, headers: { 'Cache-Control': 'no-store' } },
  );
  // Users' local date can be one calendar day ahead of or behind server UTC.
  // Do not let the public endpoint exhaust the translation provider on arbitrary dates.
  const [year, month, day] = date.split('-').map(Number);
  const requestedDay = Date.UTC(year, month - 1, day);
  const today = new Date();
  const currentUtcDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (Math.abs(requestedDay - currentUtcDay) > 2 * 86400000) {
    return NextResponse.json({ error: 'Date locale hors plage autorisée.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const quote = await getFrenchDailyQuote(date);
  if (!quote) return NextResponse.json({ error: 'Citation indisponible.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(
    { quote, total: quoteLibrary.length },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
