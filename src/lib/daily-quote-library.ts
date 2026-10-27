import 'server-only';

import group1 from '@/data/quotations/collection-1.json';
import group2 from '@/data/quotations/collection-2.json';
import group3 from '@/data/quotations/collection-3.json';
import group4 from '@/data/quotations/collection-4.json';
import group5 from '@/data/quotations/collection-5.json';

type Entry = [content: string, author: string, sourceId: number];
export const quoteLibrary: Entry[] = [
  ...(group1 as Entry[]),
  ...(group2 as Entry[]),
  ...(group3 as Entry[]),
  ...(group4 as Entry[]),
  ...(group5 as Entry[]),
];

const sourceReferences = [
  {
    sourceTitle: 'Dictionary of Quotations — James Wood (1893)',
    sourceUrl: 'https://www.gutenberg.org/ebooks/48105',
  },
  {
    sourceTitle: 'Familiar Quotations — John Bartlett',
    sourceUrl: 'https://www.gutenberg.org/ebooks/16732',
  },
] as const;

export function getDailyQuote(localDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null;
  const [year, month, day] = localDate.split('-').map(Number);
  if (year < 2000 || year > 3000) return null;
  const stamp = Date.UTC(year, month - 1, day);
  const check = new Date(stamp);
  if (!Number.isFinite(stamp) ||
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day) return null;
  if (!quoteLibrary.length) return null;

  const dayNumber = Math.floor(stamp / 86_400_000);
  const index = ((dayNumber % quoteLibrary.length) + quoteLibrary.length) % quoteLibrary.length;
  const [content, author, sourceId] = quoteLibrary[index];
  const source = sourceReferences[sourceId];
  if (!source) return null;
  return {
    content, author, language: 'en',
    ...source,
    provenance: 'Attribution figurant dans un recueil historique ; source première non vérifiée individuellement.',
  };
}
