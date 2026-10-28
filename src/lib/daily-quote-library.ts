import 'server-only';

import { curatedQuotes, quoteCategories, type CuratedQuote } from '@/data/quotations/curated';

/** Only the four user-approved, source-checked editorial universes are active.
 * The previous generic historic collection is no longer part of daily rotation.
 */
export const quoteLibrary: CuratedQuote[] = curatedQuotes;

export function getDailyQuote(localDate: string): CuratedQuote | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null;
  const [year, month, day] = localDate.split('-').map(Number);
  if (year < 2000 || year > 3000) return null;

  const stamp = Date.UTC(year, month - 1, day);
  const check = new Date(stamp);
  if (!Number.isFinite(stamp) ||
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day) return null;

  // Daily, balanced rotation across all four universes, honoring each
  // visitor's local date (submitted by the client).
  const dayNumber = Math.floor(stamp / 86_400_000);
  const categoryIndex = ((dayNumber % quoteCategories.length) + quoteCategories.length) % quoteCategories.length;
  const category = quoteCategories[categoryIndex];
  const inCategory = quoteLibrary.filter(quote => quote.category === category);
  if (inCategory.length === 0) return null;
  const cycle = Math.floor(dayNumber / quoteCategories.length);
  const itemIndex = ((cycle % inCategory.length) + inCategory.length) % inCategory.length;
  return inCategory[itemIndex];
}
