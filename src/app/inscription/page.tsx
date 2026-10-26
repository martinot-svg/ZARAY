'use client';

import BrandLogo from '@/components/brand-logo';
import ThemeSelector from '@/components/theme-selector';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function InscriptionPage() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [verified, setVerified] = useState(false);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim().toLowerCase();
      const password = String(data.get('password') || '');
      if (name.length < 2 || password.length < 12) {
        throw new Error('Nom requis et mot de passe de 12 caractères minimum.');
      }

      const supabase = createClient();
      const { data: result, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw new Error(error.message);

      if (result.user?.email_confirmed_at) {
        setVerified(true);
        setMessage('Compte créé et adresse déjà vérifiée. Vous pouvez vous connecter.');
      } else {
        setRegisteredEmail(email);
        setMessage('Demande traitée. Si cette adresse nécessite une confirmation, un code pourra être envoyé. Si vous avez déjà un compte confirmé, connectez-vous.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!registeredEmail || busy) return;
    const data = new FormData(event.currentTarget);
    const token = String(data.get('token') || '').replace(/\\s/g, '');
    if (!/^\\d{6}$/.test(token)) {
      setMessage('Saisissez le code à 6 chiffres reçu par e-mail.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: registeredEmail,
        token,
        type: 'signup',
      });
      if (error) throw new Error('Code invalide ou expiré. Vérifiez le message reçu ou demandez un nouveau code.');
      setVerified(true);
      setMessage('Adresse e-mail confirmée avec succès. Vous pouvez maintenant vous connecter.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de vérifier le code.');
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
      const { error } = await supabase.auth.resend({ type: 'signup', email: registeredEmail });
      if (error) throw new Error(error.message);
      setMessage('Demande traitée. Si un code de confirmation est nécessaire, vérifiez votre boîte de réception et vos courriers indésirables. Si votre compte est déjà confirmé, connectez-vous.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de renvoyer le code.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="form-shell auth-motion"><section className="form-card">
    <div className="auth-brand"><a href="/" aria-label="ZARAY · Accueil"><BrandLogo priority /></a><ThemeSelector /></div>
    <p className="eyebrow">ZARAY · MODULE 1</p>
    <h1>Créer un compte administrateur</h1>
    <p>Créez votre compte, puis confirmez votre adresse e-mail avant d’inscrire votre entreprise.</p>

    {!registeredEmail && !verified && <form onSubmit={register} className="form-stack">
      <label>Nom complet<input name="name" autoComplete="name" required minLength={2} maxLength={120} /></label>
      <label>Adresse e-mail<input name="email" type="email" autoComplete="email" required /></label>
      <label>Mot de passe<input name="password" type="password" autoComplete="new-password" required minLength={12} /></label>
      <button disabled={busy} className="primary-link" type="submit">{busy ? 'Création…' : 'Créer mon compte'}</button>
    </form>}

    {registeredEmail && !verified && <form onSubmit={verifyCode} className="form-stack">
      <p>Adresse concernée : <strong>{registeredEmail}</strong>.</p>
      <label>Code de confirmation à 6 chiffres
        <input name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required placeholder="123456" />
      </label>
      <button disabled={busy} className="primary-link" type="submit">{busy ? 'Vérification…' : 'Confirmer mon adresse e-mail'}</button>
      <button type="button" disabled={busy} onClick={resend}>Demander un nouveau code</button>
    </form>}

    {message && <p role="status" aria-live="polite">{message}</p>}
    {verified && <p><a className="primary-link" href="/connexion">Continuer vers la connexion</a></p>}
    {!verified && <p><a href="/connexion">Déjà inscrit ou adresse déjà confirmée ? Se connecter</a></p>}
  </section></main>;
}
