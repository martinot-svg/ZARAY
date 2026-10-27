import 'server-only';

import { unstable_cache } from 'next/cache';
import { frenchFallbackQuotes } from '@/data/quotations/french-fallbacks';
import { getDailyQuote } from '@/lib/daily-quote-library';

const TRANSLATION_ENDPOINT = 'https://api.mymemory.translated.net/get';
const ONE_WEEK = 7 * 24 * 60 * 60;

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’',
    lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', eacute: 'é',
  };
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    const key = entity.toLowerCase();
    if (key.startsWith('#')) {
      const number = key[1] === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
      return Number.isFinite(number) && number > 0 && number <= 0x10ffff &&
        !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : match;
    }
    return named[key] ?? match;
  });
}

async function translateQuoteToFrench(english: string): Promise<string> {
  // Send only a short public-domain quotation; no personal or account data.
  // MyMemory GET has a 500-byte limit per segment (all library entries fit).
  if (Buffer.byteLength(english, 'utf8') > 500) throw new Error('quote too long');
  const params = new URLSearchParams({ q: english, langpair: 'en|fr', mt: '1' });
  const response = await fetch(TRANSLATION_ENDPOINT + '?' + params.toString(), {
    signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) throw new Error('translation provider unavailable');
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('invalid translation response');
  const parsed = payload as {
    responseStatus?: number | string;
    responseData?: { translatedText?: unknown };
  };
  if (Number(parsed.responseStatus) !== 200 ||
      typeof parsed.responseData?.translatedText !== 'string') {
    throw new Error('translation refused');
  }
  const french = decodeEntities(parsed.responseData.translatedText).trim();
  if (french.length < 8 || french.length > 1200 ||
      french.localeCompare(english.trim(), undefined, { sensitivity: 'base' }) === 0 ||
      /mymemory warning|query length limit|maximum daily query/i.test(french)) {
    throw new Error('unusable French translation');
  }
  return french;
}

function originalFrenchFallback(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  const index = ((dayNumber % frenchFallbackQuotes.length) + frenchFallbackQuotes.length) % frenchFallbackQuotes.length;
  return {
    content: frenchFallbackQuotes[index],
    author: 'ZARAY',
    language: 'fr' as const,
    sourceTitle: 'Pensée originale ZARAY',
    sourceUrl: '',
    provenance: 'Texte français original de secours ; aucune attribution historique.',
    translatedFrom: null,
  };
}

const cachedFrenchDailyQuote = unstable_cache(async (localDate: string) => {
  const selected = getDailyQuote(localDate);
  if (!selected) return null;
  try {
    const french = await translateQuoteToFrench(selected.content);
    return {
      ...selected,
      content: french,
      language: 'fr' as const,
      translatedFrom: 'en' as const,
      provenance: 'Traduction française automatique ; attribution selon le recueil cité, sans vérification individuelle de la source première.',
    };
  } catch (error) {
    console.warn('daily quote: French translation unavailable; using original French fallback', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return originalFrenchFallback(localDate);
  }
}, ['zaray-fr-daily-quote-v1'], { revalidate: ONE_WEEK });

export async function getFrenchDailyQuote(localDate: string) {
  if (!getDailyQuote(localDate)) return null;
  return cachedFrenchDailyQuote(localDate);
}
