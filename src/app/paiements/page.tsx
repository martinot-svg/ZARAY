'use client';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import BrandLogo from '@/components/brand-logo';
import { useEffect, useState } from 'react';
import WorkspaceBreadcrumb from '@/components/workspace-breadcrumb';
import { activeSiteId, scopedQuery, selectedCompany, switchCompany } from '@/lib/workspace-url';
import { MotionFeedback, MotionSkeleton } from '@/components/motion';
type Company = { id: string; legal_name: string; role: string };
type Payment = { id: string; order_id: string; provider: string; provider_payment_id: string; amount: number | string; currency: string; status: string; confirmed_at: string | null; created_at: string };
const labels: Record<string,string> = { pending: 'En attente', succeeded: 'Confirmé', failed: 'Échec', cancelled: 'Annulé', review_required: 'À rapprocher' };

export default function PaymentsPage() {
  const [companies,setCompanies] = useState<Company[]>([]);
  const [companyId,setCompanyId] = useState('');
  const [payments,setPayments] = useState<Payment[]>([]);
  const [busy,setBusy] = useState(true);
  const [error,setError] = useState('');
  useEffect(() => {
    let active=true;
    (async()=>{
      try {
        const response=await fetch('/api/sites',{cache:'no-store'});
        const data=await response.json();
        if(!response.ok) throw new Error(data.error || 'Impossible de charger les entreprises.');
        if(active){setCompanies(data.companies ?? []);setCompanyId(selectedCompany(data.companies??[],data.sites??[]));}
      } catch(e){if(active)setError(e instanceof Error?e.message:'Erreur de chargement.');}
      finally{if(active)setBusy(false);}
    })();
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!companyId){setPayments([]);return;}
    let active=true;setBusy(true);
    (async()=>{
      try{
        const response=await fetch('/api/payments?'+scopedQuery(companyId),{cache:'no-store'});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error || 'Impossible de charger les paiements.');
        if(active)setPayments(data.payments ?? []);
      }catch(e){if(active)setError(e instanceof Error?e.message:'Erreur de chargement.');}
      finally{if(active)setBusy(false);}
    })();
    return()=>{active=false;};
  },[companyId]);

  return <main className="form-shell"><section className="form-card" style={{maxWidth:1100,width:'min(100%,1100px)'}}>
      <div className="workspace-brand"><a href="/" aria-label="ZARAY · Accueil"><BrandLogo /></a></div>
    <WorkspaceBreadcrumb companyId={companyId}/><p className="eyebrow">ZARAY · MODULE 9 · PAIEMENTS</p><h1>Suivi des paiements</h1>
    <p>Les confirmations proviennent du webhook signé et sont vérifiées côté serveur contre la référence, le montant et la devise de la commande. Un événement répété est traité de façon idempotente ; un paiement ne déclenche pas directement l’activation Internet.</p>
    <section className="module" style={{marginTop:20,minHeight:0}}>
      <h2>Passerelle de paiement</h2>
      <p>Le registre et le point d’entrée sécurisé sont prêts. La création de sessions de paiement et le format de signature doivent être raccordés à la passerelle choisie ; aucune passerelle n’est activée par défaut.</p>
      <p><strong>Ne renseignez pas de clé privée dans le navigateur.</strong> Le secret webhook attendu est une variable serveur <code>ZARAY_PAYMENT_WEBHOOK_SECRET</code>.</p>
    </section>
    {companies.length>0&&<label>Entreprise<select value={companyId} onChange={(e)=>switchCompany('/paiements',e.target.value)}>{companies.map(c=><option key={c.id} value={c.id}>{c.legal_name}</option>)}</select></label>}
    {busy?<MotionSkeleton rows={3}/>:payments.length?<div className="module-grid" style={{marginTop:24}}>
      {payments.map(p=><article className="module" key={p.id}>
        <span className="module-number">{labels[p.status] ?? p.status}</span><h3>{Number(p.amount).toLocaleString('fr-FR')} {p.currency}</h3>
        <p>Fournisseur : {p.provider}</p><p>Référence paiement : {p.provider_payment_id}</p>
        <p>Commande : {p.order_id}</p><span className="module-status">{p.confirmed_at?'Confirmé le '+new Date(p.confirmed_at).toLocaleString('fr-FR'):'Créé le '+new Date(p.created_at).toLocaleString('fr-FR')}</span>
      </article>)}
    </div>:!busy?<p>Aucun paiement enregistré pour cette entreprise.</p>:null}
    <MotionFeedback message={error} kind="error"/>
    <p style={{marginTop:28}}><a href="/commandes"><ZarayIcon name="orders" size={18} /> Commandes →</a> · <a href="/tickets"><ZarayIcon name="next" size={18} /> Tickets Wi-Fi</a> · <a href="/tableau-de-bord"><ZarayIcon name="next" size={18} /> Tableau de bord</a></p>
  </section></main>;
}
