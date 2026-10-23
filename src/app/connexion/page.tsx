'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

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
      window.location.assign('/tableau-de-bord');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de connexion.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="form-shell"><section className="form-card">
    <p className="eyebrow">ZARAY · ACCÈS SÉCURISÉ</p>
    <h1>Connexion administrateur</h1>
    <form className="form-stack" onSubmit={submit}>
      <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
      <label>Mot de passe<input name="password" type="password" autoComplete="current-password" required /></label>
      <button type="submit" disabled={busy} className="primary-link">{busy ? 'Connexion…' : 'Se connecter'}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <p><a href="/inscription">Créer un compte</a></p>
  </section></main>;
}
