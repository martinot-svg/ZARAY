'use client';
import { useState, type FormEvent } from 'react';
import { createAuthClient } from '@neondatabase/auth/next';

const authClient = createAuthClient();

export default function InscriptionPage() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setMessage('');
    try {
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim();
      const password = String(data.get('password') || '');
      if (name.length < 2 || password.length < 12) throw new Error('Nom requis et mot de passe de 12 caractères minimum.');
      const result = await authClient.signUp.email({ name, email, password });
      if (result.error) throw new Error(result.error.message || 'Inscription impossible');
      setMessage('Compte créé. Vérifiez votre e-mail si demandé, puis connectez-vous.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Une erreur est survenue.'); }
    finally { setBusy(false); }
  }
  return <main className="form-shell"><section className="form-card"><p className="eyebrow">ZARAY · MODULE 1</p><h1>Créer un compte administrateur</h1><p>Votre identité sera enregistrée dans Neon Auth. Après connexion et vérification de votre e-mail, vous pourrez inscrire votre entreprise.</p>
    <form onSubmit={submit} className="form-stack"><label>Nom complet<input name="name" autoComplete="name" required minLength={2} maxLength={120}/></label><label>Adresse e-mail<input name="email" type="email" autoComplete="email" required/></label><label>Mot de passe<input name="password" type="password" autoComplete="new-password" required minLength={12}/></label><button disabled={busy} className="primary-link" type="submit">{busy?'Création…':'Créer mon compte'}</button></form>
    {message&&<p role="status">{message}</p>}<p><a href="/connexion">Déjà inscrit ? Se connecter</a></p></section></main>;
}
