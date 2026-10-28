import 'server-only';

import { getDailyQuote } from '@/lib/daily-quote-library';

/**
 * All daily entries are edited directly in French and carry their own
 * verifiable provenance. No runtime translation service is involved:
 * translation failures can no longer replace the verified attribution
 * with an unrelated anonymous fallback.
 */
export async function getFrenchDailyQuote(localDate: string) {
  return getDailyQuote(localDate);
}
