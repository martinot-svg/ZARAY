'use client';
import { ZarayIcon } from '@/components/ui/zaray-icon';

import BrandLogo from '@/components/brand-logo';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MotionFeedback } from '@/components/motion';

export default function ConnexionPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: String(data.get('email')).trim().toLowerCase(),
        password: String(data.get('password')),
      });
      if (signInError) throw new Error('E-mail ou mot de passe incorrect, ou adresse non vérifiée.');
      if (sessionStorage.getItem('zaray:pending-alliance-invitation')) {
        window.location.replace('/z-alliance/accepter');
        return;
      }
      window.location.replace('/mon-compte');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de connexion.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="form-shell auth-motion login-shell">
    <div className="login-brand">
      <a href="/" aria-label="ZARAY · Accueil">
        <BrandLogo priority surface="dark" />
      </a>
    </div>
    <section className="form-card login-card" aria-labelledby="login-title">
      <h1 id="login-title">Votre univers vous attend</h1>
      <form className="form-stack" onSubmit={submit}>
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label>Mot de passe<input name="password" type="password" autoComplete="current-password" required /></label>
        <button type="submit" disabled={busy} className="primary-link"><ZarayIcon name="login" size={18} /> {busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
      <MotionFeedback message={error} kind="error" />
      <nav className="login-footer-links" aria-label="Navigation du compte">
        <a href="/mot-de-passe-oublie">Mot de passe oublié ?</a>
        <a href="/inscription">Créer un compte</a>
      </nav>
    </section>
  </main>;
}
