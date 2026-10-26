import { ZarayIcon } from '@/components/ui/zaray-icon';
'use client';

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
      window.location.replace('/mon-compte');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de connexion.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="form-shell auth-motion"><section className="form-card">
    <div className="auth-brand"><a href="/" aria-label="ZARAY · Accueil"><BrandLogo priority /></a></div>
    <p className="eyebrow">ZARAY · ACCÈS SÉCURISÉ</p>
    <h1>Connexion à mon compte ZARAY</h1>
    <form className="form-stack" onSubmit={submit}>
      <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
      <label>Mot de passe<input name="password" type="password" autoComplete="current-password" required /></label>
      <p><a href="/mot-de-passe-oublie">Mot de passe oublié ?</a></p>
      <button type="submit" disabled={busy} className="primary-link"><ZarayIcon name="login" size={18} /> {busy ? 'Connexion…' : 'Se connecter'}</button>
    </form>
    <MotionFeedback message={error} kind="error" />
    <p><a href="/inscription"><ZarayIcon name="signup" size={18} /> Créer un compte</a></p>
  </section></main>;
}
