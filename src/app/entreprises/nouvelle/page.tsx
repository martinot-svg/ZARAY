'use client';
import { useState, type FormEvent } from 'react';

export default function NouvelleEntreprise() {
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [created,setCreated]=useState<{legal_name:string;slug:string;status:string}|null>(null);
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setNotice('');
    const form=new FormData(e.currentTarget);
    try {
      const response=await fetch('/api/companies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({legalName:String(form.get('legalName')),slug:String(form.get('slug'))})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||'Échec de création');
      setCreated(data.company);
    }catch(e){setNotice(e instanceof Error?e.message:'Une erreur est survenue.');}
    finally{setBusy(false);}
  }
  return <main className="form-shell"><section className="form-card"><p className="eyebrow">ZARAY · GESTION DES ENTREPRISES</p><h1>Enregistrer mon entreprise</h1><p>Cette action enregistre réellement l’entreprise dans Neon lorsque l'API est configurée et votre session vérifiée. Essai prévu : 31 jours.</p>
  {created?<div role="status"><h2>Entreprise créée</h2><p>{created.legal_name} · {created.slug} · {created.status}</p><a href="/">Accueil</a></div>:<form onSubmit={submit} className="form-stack"><label>Nom de l’entreprise<input name="legalName" required minLength={2} maxLength={160} placeholder="Ex. Maleka Wi-Fi"/></label><label>Identifiant unique<input name="slug" required pattern="[a-z0-9][a-z0-9-]{2,62}" placeholder="ex. maleka-wifi" title="Lettres minuscules, chiffres et tirets"/></label><button type="submit" className="primary-link" disabled={busy}>{busy?'Enregistrement…':'Créer l’entreprise'}</button></form>}
  {notice&&<p role="alert">{notice}</p>}<p><a href="/connexion">Se connecter</a></p></section></main>;
}
