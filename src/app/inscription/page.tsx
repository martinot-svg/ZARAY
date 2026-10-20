'use client';
import { useState, type FormEvent } from 'react';
import { createAuthClient } from '@neondatabase/auth/next';

const authClient = createAuthClient();

export default function InscriptionPage() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<'register' | 'verify'>('register');
  const [email, setEmail] = useState('');

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      const name = String(data.get('name') || '').trim();
      const address = String(data.get('email') || '').trim().toLowerCase();
      const password = String(data.get('password') || '');
      if (name.length < 2 || password.length < 12) {
        throw new Error('Nom requis et mot de passe de 12 caractères minimum.');
      }
      const result = await authClient.signUp.email({ name, email: address, password });
      if (result.error) throw new Error(result.error.message || 'Inscription impossible.');
      setEmail(address);
      if (result.data?.user?.emailVerified) {
        setMessage('Compte créé et adresse vérifiée. Vous pouvez vous connecter.');
        return;
      }
      setStep('verify');
      setMessage('Un code de vérification a été envoyé à votre adresse e-mail. Il expire après 15 minutes.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const data = new FormData(event.currentTarget);
    const otp = String(data.get('otp') || '').trim();
    if (!/^\\d{6}$/.test(otp)) {
      setMessage('Saisissez le code numérique à 6 chiffres reçu par e-mail.');
      setBusy(false);
      return;
    }
    try {
      const result = await authClient.emailOtp.verifyEmail({ email, otp });
      if (result.error) throw new Error(result.error.message || 'Code invalide ou expiré.');
      window.location.assign('/connexion');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Vérification impossible.');
      setBusy(false);
    }
  }

  async function resend() {
    if (busy || !email) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' });
      if (result.error) throw new Error(result.error.message || 'Envoi impossible.');
      setMessage('Un nouveau code a été demandé. Vérifiez votre boîte e-mail.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de renvoyer le code.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="form-shell"><section className="form-card">
    <p className="eyebrow">ZARAY · MODULE 1</p>
    {step === 'register' ? <>
      <h1>Créer un compte administrateur</h1>
      <p>Créez votre compte, puis confirmez votre adresse e-mail à l'aide d'un code à 6 chiffres avant d'inscrire votre entreprise.</p>
      <form onSubmit={register} className="form-stack">
        <label>Nom complet<input name="name" autoComplete="name" required minLength={2} maxLength={120}/></label>
        <label>Adresse e-mail<input name="email" type="email" autoComplete="email" required/></label>
        <label>Mot de passe<input name="password" type="password" autoComplete="new-password" required minLength={12}/></label>
        <button disabled={busy} className="primary-link" type="submit">{busy ? 'Création…' : 'Créer mon compte'}</button>
      </form>
    </> : <>
      <h1>Vérifiez votre adresse e-mail</h1>
      <p>Entrez le code numérique envoyé à <strong>{email}</strong>. Ce code expire après 15 minutes.</p>
      <form onSubmit={verify} className="form-stack">
        <label>Code de vérification<input name="otp" type="text" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" placeholder="000000" maxLength={6} minLength={6} required/></label>
        <button disabled={busy} className="primary-link" type="submit">{busy ? 'Vérification…' : 'Vérifier mon e-mail'}</button>
      </form>
      <button type="button" disabled={busy} onClick={resend}>Renvoyer un code</button>
    </>}
    {message && <p role="status" aria-live="polite">{message}</p>}
    <p><a href="/connexion">Déjà inscrit ? Se connecter</a></p>
  </section></main>;
}
