'use client';
import { fetchWorkspaceDirectory } from '@/lib/workspace-directory-request';
import { ZarayIcon } from '@/components/ui/zaray-icon';
import AppShell from '@/components/app-shell';
import { useEffect, useState } from 'react';
import { scopedQuery, selectedCompany } from '@/lib/workspace-url';
import { MotionFeedback } from '@/components/motion';
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
        const response=await fetchWorkspaceDirectory();
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

  return <AppShell activePath="/paiements" title="Suivi des paiements" companyId={companyId}><section className="panel global-workspace-module">
    
    {companies.length>0&&<span className="muted">Entreprise active : {companies.find(c=>c.id===companyId)?.legal_name ?? '—'}</span>}
    {busy?null:payments.length?<div className="module-grid" style={{marginTop:24}}>
      {payments.map(p=><article className="module" key={p.id}>
        <span className="module-number">{labels[p.status] ?? p.status}</span><h3>{Number(p.amount).toLocaleString('fr-FR')} {p.currency}</h3>
        <details className="payment-info-disclosure"><summary>Références</summary><p>Fournisseur : {p.provider}</p><p>Référence paiement : {p.provider_payment_id}</p><p>Commande : {p.order_id}</p></details><span className="module-status">{p.confirmed_at?'Confirmé le '+new Date(p.confirmed_at).toLocaleString('fr-FR'):'Créé le '+new Date(p.created_at).toLocaleString('fr-FR')}</span>
      </article>)}
    </div>:!busy?<p>Aucun paiement enregistré pour cette entreprise.</p>:null}
    <MotionFeedback message={error} kind="error"/>
    <p style={{marginTop:28}}><a href="/commandes"><ZarayIcon name="orders" size={18} /> Commandes →</a> · <a href="/tickets"><ZarayIcon name="next" size={18} /> Tickets Wi-Fi</a> · <a href="/tableau-de-bord"><ZarayIcon name="next" size={18} /> Tableau de bord</a></p>
  </section></AppShell>;
}
