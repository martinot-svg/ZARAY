'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function PersonalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('personal workspace failed', error.message); }, [error]);
  return <main className="form-shell"><section className="form-card">
    <p className="eyebrow">ESPACE PERSONNEL ZARAY</p>
    <h1>Impossible d’afficher cette page</h1>
    <p role="alert">Une erreur est survenue lors du chargement des informations. Aucune donnée de remplacement n'a été générée.</p>
    <div className="page-actions"><button className="primary-link" type="button" onClick={reset}>Réessayer</button>
      <Link className="header-link" href="/mon-compte">Accueil personnel</Link></div>
  </section></main>;
}
