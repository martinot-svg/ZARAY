import PersonalShell from '@/components/personal-shell';
import PersonalFinanceOverview from '@/components/personal-finance-overview';
import { loadPersonalContext } from '@/lib/personal-context';

export const dynamic = 'force-dynamic';

const financeRoles = new Set(['owner', 'admin', 'finance', 'support', 'sales']);
type LedgerRow = { amount: number | string; currency: string };

export default async function GlobalFinancePage({ searchParams }: { searchParams: Promise<{ financeCompanyId?: string; currency?: string }> }) {
  const { financeCompanyId, currency } = await searchParams;
  const { client, identity, companies, error: contextError } = await loadPersonalContext();
  const authorized = companies.filter(c => financeRoles.has(c.role));
  let error = contextError;
  const rows: { id: string; name: string; values: Map<string, number>; count: number }[] = [];
  if (!error) for (const company of authorized) {
    // Payment ledger only: confirmed transactions, visible to this authenticated user through RLS.
    const { data, count, error: ledgerError } = await client.from('payments')
      .select('amount,currency', { count: 'exact' }).eq('company_id', company.id)
      .eq('status', 'succeeded').range(0, 999);
    if (ledgerError || count === null || count > 1000) {
      error = 'Consolidation indisponible : impossible de vérifier intégralement les paiements autorisés.';
      break;
    }
    const sums = new Map<string, number>();
    for (const payment of (data ?? []) as LedgerRow[]) {
      const amount = Number(payment.amount);
      if (!Number.isFinite(amount)) { error = 'Montant de paiement invalide : consolidation suspendue.'; break; }
      sums.set(payment.currency, (sums.get(payment.currency) ?? 0) + amount);
    }
    if (error) break;
    rows.push({ id: company.id, name: company.legal_name, values: sums, count });
  }
  const consolidated = new Map<string, number>();
  if (!error) for (const company of rows) for (const [currency, amount] of company.values) {
    consolidated.set(currency, (consolidated.get(currency) ?? 0) + amount);
  }
  const hasPayments = !error && rows.some(row => row.count > 0);
  const format = (amount: number, currency: string) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(amount) + ' ' + currency;

  return <PersonalShell active="/finance-globale" email={identity.email} name={identity.name}
    inviteCompanyId={companies.find(company => company.role === 'owner' || company.role === 'admin')?.id ?? null}>
    <header className="personal-page-heading"><p className="eyebrow">COMPTE PERSONNEL · FINANCE</p><h1>Finance globale</h1>
      <p>Consolidation des paiements confirmés du registre uniquement, pour les entreprises auxquelles votre rôle donne accès. Les monnaies restent séparées.</p></header>
    {error ? <div role="alert" className="alert alert-error">{error}</div>
      : !authorized.length ? <section className="empty-state"><strong>Aucun périmètre financier autorisé</strong>
        <p>Votre compte ne dispose pas d'un rôle donnant accès aux paiements des entreprises.</p></section>
      : !hasPayments ? <section className="empty-state"><strong>Aucun paiement confirmé disponible</strong>
        <p>Aucune donnée consolidable n'est actuellement accessible dans le registre de paiements.</p></section>
      : <>
        <section className="panel"><h2 className="panel-title">Montants consolidés par devise</h2>
          <div className="personal-finance-totals">{[...consolidated.entries()].map(([currency, amount]) =>
            <div className="kpi" key={currency}><p className="kpi-label">PAIEMENTS CONFIRMÉS · {currency}</p><strong className="kpi-value">{format(amount,currency)}</strong></div>)}</div>
        </section>
        <section className="panel"><h2 className="panel-title">Détail par entreprise autorisée</h2>
          <div className="data-list">{rows.map(row => <div className="data-row" key={row.id}><span><strong>{row.name}</strong>
            <span className="muted"> · {row.count} paiement{row.count !== 1 ? 's' : ''} confirmé{row.count !== 1 ? 's' : ''}</span></span>
            <span>{row.count ? [...row.values.entries()].map(([currency,amount]) => <span key={currency}>{format(amount,currency)} </span>) : 'Aucun paiement confirmé'}</span>
          </div>)}</div>
        </section>
      </>}
    {!error && <PersonalFinanceOverview client={client} companies={companies}
      requestedCompanyId={financeCompanyId} requestedCurrency={currency} filtersAction="/finance-globale" />}
  </PersonalShell>;
}
