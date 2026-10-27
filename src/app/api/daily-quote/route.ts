import { NextRequest, NextResponse } from 'next/server';
import { getDailyQuote, quoteLibrary } from '@/lib/daily-quote-library';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? '';
  const quote = getDailyQuote(date);
  if (!quote) return NextResponse.json(
    { error: 'Date locale invalide.' },
    { status: 400, headers: { 'Cache-Control': 'no-store' } },
  );
  return NextResponse.json(
    { quote, total: quoteLibrary.length },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
