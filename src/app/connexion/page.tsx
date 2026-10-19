'use client';
import { useState, type FormEvent } from 'react';
import { createAuthClient } from '@neondatabase/auth/next';

const authClient = createAuthClient();
export default function ConnexionPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.email({email:String(data.get('email')),password:String(data.get('password'))});
      if (result.error) throw new Error(result.error.message || 'Connexion impossible.');
      window.location.assign('/entreprises/nouvelle');
    } catch(e) {setError(e instanceof Error ? e.message : 'Erreur de connexion.');} finally {setBusy(false);}
  }
  return <main className="form-shell"><section className="form-card"><p className="eyebrow">ZARAY · ACCÈS SÉCURISÉ</p><h1>Connexion administrateur</h1><form className="form-stack" onSubmit={submit}><label>E-mail<input name="email" type="email" autoComplete="email" required/></label><label>Mot de passe<input name="password" type="password" autoComplete="current-password" required/></label><button type="submit" disabled={busy} className="primary-link">{busy?'Connexion…':'Se connecter'}</button></form>{error&&<p role="alert">{error}</p>}<p><a href="/inscription">Créer un compte</a></p></section></main>;
}
