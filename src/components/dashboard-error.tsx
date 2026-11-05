import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { ZarayIcon } from '@/components/ui/zaray-icon';

/** Real error, not a simulated loading or availability screen. */
export default function DashboardError({ companyId, siteId, message }:{
  companyId:string; siteId?:string; message:string
}) {
  return <AppShell companyId={companyId} siteId={siteId}
    activePath={siteId?'/sites/'+siteId:'/tableau-de-bord'} title="Tableau de bord">
    <section className="panel" role="alert">
      <h2>Données indisponibles</h2>
      <p>{message}</p>
      <Link className="header-link" href="/entreprises">
        <ZarayIcon name="back" size={18}/> Revenir à mes entreprises
      </Link>
    </section>
  </AppShell>;
}
