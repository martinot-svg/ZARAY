'use client';

import BrandLogo from '@/components/brand-logo';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function MotDePasseOubliePage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim().toLowerCase();

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
      });
      if (resetError) throw new Error('Impossible de demander la réinitialisation. Vérifiez la configuration des redirections Supabase puis réessayez.');
      setMessage('Si cette adresse correspond à un compte, un e-mail de réinitialisation sera envoyé. Vérifiez aussi les courriers indésirables.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="form-shell auth-motion"><section className="form-card">
    <div className="auth-brand"><a href="/" aria-label="ZARAY · Accueil"><BrandLogo priority /></a></div>
    <p className="eyebrow">ZARAY · RÉCUPÉRATION DU COMPTE</p>
    <h1>Mot de passe oublié</h1>
    <p>Indiquez l’adresse e-mail associée à votre compte pour recevoir un lien de réinitialisation.</p>
    <form className="form-stack" onSubmit={submit}>
      <label>Adresse e-mail<input name="email" type="email" autoComplete="email" required /></label>
      <button type="submit" disabled={busy} className="primary-link">{busy ? 'Envoi en cours…' : 'Recevoir le lien'}</button>
    </form>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    <p><a href="/connexion">Retour à la connexion</a></p>
  </section></main>;
}
