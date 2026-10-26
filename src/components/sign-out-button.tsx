'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setBusy(true);
    setError('');
    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) throw signOutError;
      window.location.replace('/connexion');
    } catch {
      setError('Déconnexion impossible. Réessayez.');
      setBusy(false);
    }
  }
  return <div className="account-signout"><button type="button" onClick={signOut} disabled={busy}>{busy ? 'Déconnexion…' : 'Se déconnecter'}</button>{error && <p role="alert">{error}</p>}</div>;
}
