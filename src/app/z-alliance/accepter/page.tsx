'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ZarayIcon } from '@/components/ui/zaray-icon';

const STORAGE='zaray:pending-alliance-invitation';
type Membership={company_id:string;company_name:string;role:string};

export default function AcceptZAllianceInvitation() {
  const [token,setToken]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [loginNeeded,setLoginNeeded]=useState(false);
  const [success,setSuccess]=useState<Membership|null>(null);

  useEffect(()=>{
    const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
    const raw=hash.get('token') || sessionStorage.getItem(STORAGE) || '';
    // Fragments never reach the server; remove the fragment from browsing history.
    window.history.replaceState(null,'',window.location.pathname);
    if (/^[0-9a-f]{64}$/.test(raw)) {
      sessionStorage.setItem(STORAGE,raw);
      setToken(raw);
    } else {
      sessionStorage.removeItem(STORAGE);
      setMessage('Lien d’invitation manquant ou invalide.');
    }
  },[]);

  async function accept(){
    if(!token||busy)return;
    setBusy(true);setMessage('');setLoginNeeded(false);
    try{
      const response=await fetch('/api/z-alliance/accept',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token})
      });
      const result=await response.json();
      if(!response.ok){
        if(response.status===401)setLoginNeeded(true);
        throw new Error(result.error||'Invitation non acceptée.');
      }
      sessionStorage.removeItem(STORAGE);
      setToken('');
      setSuccess(result.membership as Membership);
    }catch(error){setMessage(error instanceof Error?error.message:'Service indisponible.');}
    finally{setBusy(false);}
  }

  return <main className="form-shell"><section className="form-card" style={{maxWidth:620,width:'100%'}}>
    <p className="eyebrow">ZARAY · COLLABORATION</p>
    <h1><ZarayIcon name="alliance" size={27}/> Rejoindre Z’Alliance</h1>
    {success ? <>
      <div className="alert alert-success" role="status">Vous avez rejoint {success.company_name}. Votre rôle a été confirmé.</div>
      <Link href={'/tableau-de-bord?companyId='+encodeURIComponent(success.company_id)} className="primary-link">
        <ZarayIcon name="next" size={18}/> Ouvrir mon entreprise
      </Link>
    </> : <>
      <p>Cette invitation est personnelle. Connectez-vous ou inscrivez-vous avec <strong>l’adresse e-mail qui a reçu l’invitation</strong> pour consulter les droits proposés.</p>
      <p>Une fois connecté et votre adresse confirmée, choisissez « Accepter l’invitation ». Aucun accès n’est accordé avant cette validation.</p>
      {token && <button type="button" className="primary-link" onClick={()=>void accept()} disabled={busy}>
        <ZarayIcon name="confirm" size={18}/> {busy?'Vérification en cours…':'Accepter l’invitation'}
      </button>}
      {message && <div role="alert" className="alert alert-error">{message}</div>}
      {loginNeeded && <div className="zalliance-login-options">
        <Link className="primary-link" href="/connexion"><ZarayIcon name="login" size={18}/> Me connecter</Link>
        <Link className="header-link" href="/inscription"><ZarayIcon name="signup" size={18}/> Créer mon compte</Link>
      </div>}
    </>}
    <p style={{marginTop:25}}><Link href="/mon-compte"><ZarayIcon name="home" size={18}/> Z’Accueil</Link></p>
  </section></main>;
}
