'use client';
import { ZarayIcon } from '@/components/ui/zaray-icon';

import BrandLogo from '@/components/brand-logo';

import { useState, type FormEvent } from 'react';

export default function NouvelleEntreprise() {
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id:string; legal_name: string; slug: string; status: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legalName: String(form.get('legalName') || '').trim(), slug: String(form.get('slug') || '').trim().toLowerCase() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Échec de création');
      setCreated(data.company);
      if (typeof data.company?.id === 'string') window.location.replace('/tableau-de-bord?companyId='+encodeURIComponent(data.company.id));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="form-shell auth-motion"><section className="form-card">
    <div className="auth-brand"><a href="/" aria-label="ZARAY · Accueil"><BrandLogo priority /></a></div>
    <p className="eyebrow">ZARAY · GESTION DES ENTREPRISES</p>
    <h1>Enregistrer mon entreprise</h1>
    <p>Votre entreprise est enregistrée dans Supabase après vérification de la session et de l’adresse e-mail. La période d’essai est de 31 jours.</p>
    {created ? <div role="status">
      <h2>Entreprise créée</h2>
      <p>{created.legal_name} · {created.slug} · {created.status}</p>
      <p>Votre compte est maintenant propriétaire de cette entreprise. Vous pouvez ouvrir le tableau de bord ou créer votre premier site.</p>
      <p><a className="primary-link" href={'/tableau-de-bord?companyId='+encodeURIComponent(created.id)}><ZarayIcon name="add" size={18} /> Ouvrir le tableau de bord →</a></p>
      <p><a href={'/sites?companyId='+encodeURIComponent(created.id)}><ZarayIcon name="add" size={18} /> Créer ou gérer un site</a></p>
    </div> : <form onSubmit={submit} className="form-stack">
      <label>Nom de l’entreprise<input name="legalName" required minLength={2} maxLength={160} placeholder="Nom de l’entreprise" /></label>
      <label>Identifiant unique<input name="slug" required pattern="[a-z0-9][a-z0-9-]{2,62}" placeholder="identifiant-entreprise" title="Lettres minuscules, chiffres et tirets" /></label>
      <button type="submit" className="primary-link" disabled={busy}><ZarayIcon name="save" size={18} /> {busy ? 'Enregistrement…' : 'Créer l’entreprise'}</button>
    </form>}
    {notice && <p role="alert">{notice}</p>}
    <p><a href="/entreprises"><ZarayIcon name="company" size={18} /> Mes entreprises</a> · <a href="/mon-compte"><ZarayIcon name="home" size={18} /> Mon compte</a></p>
  </section></main>;
}
