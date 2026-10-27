'use client';

import { useEffect, useState } from 'react';

type DailyQuote = {
  content: string;
  author: string;
  language: string;
  sourceTitle: string;
  sourceUrl: string;
  provenance: string;
  translatedFrom: 'en' | null;
};

function currentLocalDate(): string {
  const now = new Date();
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return [year, month, day].join('-');
}

export default function DailyInspiration() {
  const [daily, setDaily] = useState<{ date: string; quote: DailyQuote } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let requestedDate = '';
    let controller: AbortController | null = null;

    const syncLocalDate = async () => {
      if (document.visibilityState === 'hidden') return;
      const date = currentLocalDate();
      if (requestedDate === date) return;
      requestedDate = date;
      controller?.abort();
      const pending = new AbortController();
      controller = pending;
      try {
        const response = await fetch('/api/daily-quote?date=' + encodeURIComponent(date), {
          cache: 'no-store',
          signal: pending.signal,
        });
        if (!response.ok) throw new Error('La citation quotidienne est indisponible.');
        const data = await response.json() as { quote: DailyQuote };
        if (active && controller === pending) {
          setDaily({ date, quote: data.quote });
          setError('');
        }
      } catch {
        if (active && controller === pending) {
          requestedDate = '';
          setError('La citation du jour est momentanément indisponible.');
        }
      }
    };
    void syncLocalDate();
    const interval = window.setInterval(() => { void syncLocalDate(); }, 60_000);
    const visibility = () => { void syncLocalDate(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', visibility);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', visibility);
    };
  }, []);

  return <div className="personal-home-quote-zone" aria-live="polite">
    {daily && <figure className="personal-home-inspiration" key={daily.date}>
      <blockquote className="personal-home-quote" lang="fr">« {daily.quote.content} »</blockquote>
      <figcaption className="personal-home-quote-author">
        — {daily.quote.author}
        {daily.quote.sourceUrl && <a className="personal-quote-source" href={daily.quote.sourceUrl}
          target="_blank" rel="noopener noreferrer" title={daily.quote.provenance}>
          Consulter le recueil
        </a>}
      </figcaption>
      <p className="personal-quote-provenance">
        {daily.quote.translatedFrom === 'en'
          ? 'Source : ' + daily.quote.sourceTitle
          : 'Pensée originale · ZARAY'}
      </p>
    </figure>}
    {!daily && error && <p role="status" className="personal-quote-unavailable">{error}</p>}
  </div>;
}
