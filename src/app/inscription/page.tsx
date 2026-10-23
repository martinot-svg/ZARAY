'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function InscriptionPage() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim().toLowerCase();
      const password = String(data.get('password') || '');
      if (name.length < 2 || password.length < 12) throw new Error('Nom requis et mot de passe de 12 caractères minimum.');

      const supabase = createClient();
      const { data: result, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://zaray.vercel.app'}/connexion`,
          data: { full_name: name },
        },
      });
      if (error) throw new Error(error.message);
      if (result.user?.email_confirmed_at) {
        setMessage('Compte créé et adresse déjà vérifiée. Vous pouvez vous connecter.');
      } else {
        setRegisteredEmail(email);
        setMessage('Un e-mail de confirmation a été envoyé. Ouvrez son lien pour confirmer votre adresse, puis connectez-vous.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy || !registeredEmail) return;
    setBusy(true);
    setMessage('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: registeredEmail,
        options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://zaray.vercel.app'}/connexion` },
      });
      if (error) throw new Error(error.message);
      setMessage('Un nouvel e-mail de confirmation a été demandé. Vérifiez votre boîte de réception.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de renvoyer l’e-mail.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="form-shell"><section className="form-card">
    <p className="eyebrow">ZARAY · MODULE 1</p>
    <h1>Créer un compte administrateur</h1>
    <p>Créez votre compte, puis confirmez votre adresse e-mail avant d’inscrire votre entreprise.</p>
    <form onSubmit={register} className="form-stack">
      <label>Nom complet<input name="name" autoComplete="name" required minLength={2} maxLength={120} /></label>
      <label>Adresse e-mail<input name="email" type="email" autoComplete="email" required /></label>
      <label>Mot de passe<input name="password" type="password" autoComplete="new-password" required minLength={12} /></label>
      <button disabled={busy} className="primary-link" type="submit">{busy ? 'Création…' : 'Créer mon compte'}</button>
    </form>
    {message && <p role="status" aria-live="polite">{message}</p>}
    {registeredEmail && <button type="button" disabled={busy} onClick={resend}>Renvoyer l’e-mail de confirmation</button>}
    <p><a href="/connexion">Déjà inscrit ? Se connecter</a></p>
  </section></main>;
}
