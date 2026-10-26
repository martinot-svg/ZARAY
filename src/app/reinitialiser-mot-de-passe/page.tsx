'use client';
import { ZarayIcon } from '@/components/ui/zaray-icon';

import BrandLogo from '@/components/brand-logo';

import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ReinitialiserMotDePassePage() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function prepareSession() {
      try {
        const supabase = createClient();
        const params = new URLSearchParams(window.location.search);
        const authError = params.get('error_description') || params.get('error');
        if (authError) {
          if (active) setError('Le lien de réinitialisation est invalide ou expiré. Demandez un nouveau lien.');
          return;
        }
        const code = params.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session) {
          if (active) setError('Le lien est invalide ou expiré. Demandez un nouveau lien de réinitialisation.');
          return;
        }
        if (active) setReady(true);
      } catch {
        if (active) setError('Le lien est invalide ou expiré. Demandez un nouveau lien de réinitialisation.');
      }
    }
    void prepareSession();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    const confirmation = String(data.get('confirmation') ?? '');
    if (password.length < 12) {
      setError('Le mot de passe doit contenir au moins 12 caractères.');
      setBusy(false);
      return;
    }
    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      setBusy(false);
      return;
    }
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error('Impossible de modifier le mot de passe. Le lien a peut-être expiré : demandez-en un nouveau.');
      setMessage('Mot de passe mis à jour. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.');
      await supabase.auth.signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="form-shell auth-motion"><section className="form-card">
    <div className="auth-brand"><a href="/" aria-label="ZARAY · Accueil"><BrandLogo priority surface="light" /></a></div>
    <p className="eyebrow">ZARAY · SÉCURITÉ DU COMPTE</p>
    <h1>Créer un nouveau mot de passe</h1>
    {!ready && !error && <p>Vérification du lien sécurisé…</p>}
    {ready && !message && <form className="form-stack" onSubmit={submit}>
      <label>Nouveau mot de passe<input name="password" type="password" autoComplete="new-password" minLength={12} required /></label>
      <label>Confirmer le mot de passe<input name="confirmation" type="password" autoComplete="new-password" minLength={12} required /></label>
      <p>Utilisez au moins 12 caractères.</p>
      <button type="submit" disabled={busy} className="primary-link"><ZarayIcon name="save" size={18} /> {busy ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}</button>
    </form>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {error && <p><a href="/mot-de-passe-oublie"><ZarayIcon name="login" size={18} /> Demander un nouveau lien</a></p>}
    <p><a href="/connexion"><ZarayIcon name="login" size={18} /> Retour à la connexion</a></p>
  </section></main>;
}
