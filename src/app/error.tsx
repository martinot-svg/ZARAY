'use client';
import { ZarayIcon } from '@/components/ui/zaray-icon';

import BrandLogo from '@/components/brand-logo';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="module-error-screen">
    <section className="module-error-card" role="alert">
      <div className="module-error-brand"><BrandLogo /></div>
      <p className="landing-label">CHARGEMENT INTERROMPU</p>
      <h1>Impossible d’ouvrir cette page</h1>
      <p>Une erreur est survenue pendant le chargement. Aucune donnée de remplacement n’a été affichée.</p>
      <div className="module-error-actions">
        <button type="button" className="landing-button landing-button-primary" onClick={() => reset()}><ZarayIcon name="refresh" size={18} /> Réessayer</button>
        <a className="landing-button landing-button-outline" href="/mon-compte"><ZarayIcon name="back" size={18} /> Retour à mon compte</a>
      </div>
    </section>
  </main>;
}
