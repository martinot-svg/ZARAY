import { ZarayIcon } from '@/components/ui/zaray-icon';
import type { PersonalCompany } from '@/lib/personal-context';
import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;
type PaymentRow = { amount: number | string; currency: string; confirmed_at: string | null };
const financeRoles = new Set(['owner', 'admin', 'finance', 'support', 'sales']);
const formatAmount = (value: number, currency: string) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value) + ' ' + currency;

type Props = {
  client: Client;
  companies: PersonalCompany[];
  requestedCompanyId?: string;
  requestedCurrency?: string;
};

/** Professional metrics only. Values are drawn from RLS-authorized, succeeded payments. */
export default async function PersonalFinanceOverview({ client, companies, requestedCompanyId, requestedCurrency }: Props) {
  const authorized = companies.filter(company => financeRoles.has(company.role));
  const invalidSelection = !!requestedCompanyId && requestedCompanyId !== 'all' &&
    !authorized.some(company => company.id === requestedCompanyId);
  const selectedCompanyId = !invalidSelection && requestedCompanyId && requestedCompanyId !== 'all'
    ? requestedCompanyId : 'all';
  const scoped = invalidSelection ? [] :
    selectedCompanyId === 'all' ? authorized : authorized.filter(company => company.id === selectedCompanyId);

  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));
  const monthStarts = Array.from({ length: 6 }, (_, index) =>
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
  const sums = new Map<string, number>();
  const monthlyByCurrency = new Map<string, number[]>();
  const amountsByCompany = new Map<string, Map<string, number>>();
  let paymentCount = 0;
  let financeError = invalidSelection ? 'Cette entreprise ne fait pas partie de votre périmètre financier autorisé.' : '';

  if (!financeError) {
    for (const company of scoped) {
      // Count must match every returned row: never display partial totals as consolidated data.
      const { data, count, error } = await client.from('payments')
        .select('amount,currency,confirmed_at', { count: 'exact' })
        .eq('company_id', company.id).eq('status', 'succeeded')
        .gte('confirmed_at', start.toISOString()).range(0, 999);

      if (error || count === null || count > 1000 || (data ?? []).length !== count) {
        financeError = 'Indicateurs financiers indisponibles : la totalité des paiements autorisés ne peut pas être vérifiée.';
        break;
      }
      for (const payment of (data ?? []) as PaymentRow[]) {
        const amount = Number(payment.amount);
        const date = payment.confirmed_at ? new Date(payment.confirmed_at) : null;
        if (!Number.isFinite(amount) || !payment.currency ||
            !date || !Number.isFinite(date.getTime())) {
          financeError = 'Certaines données financières sont invalides. Les totaux ont été masqués.';
          break;
        }
        const currency = payment.currency;
        const month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
        const monthIndex = monthStarts.indexOf(month);
        if (monthIndex < 0) continue;
        sums.set(currency, (sums.get(currency) ?? 0) + amount);
        const monthly = monthlyByCurrency.get(currency) ?? Array<number>(6).fill(0);
        monthly[monthIndex] += amount;
        monthlyByCurrency.set(currency, monthly);
        const companySums = amountsByCompany.get(company.id) ?? new Map<string, number>();
        companySums.set(currency, (companySums.get(currency) ?? 0) + amount);
        amountsByCompany.set(company.id, companySums);
        paymentCount++;
      }
      if (financeError) break;
    }
  }

  const currencies = financeError ? [] : [...sums.keys()].sort();
  const selectedCurrency = currencies.includes(requestedCurrency ?? '') ? requestedCurrency! : currencies[0];
  const monthly = selectedCurrency ? monthlyByCurrency.get(selectedCurrency) ?? [] : [];
  const monthMax = Math.max(0, ...monthly);
  const companyRows = scoped.map(company => ({
    company, value: amountsByCompany.get(company.id)?.get(selectedCurrency) ?? 0
  }));
  const companyMax = Math.max(0, ...companyRows.map(row => row.value));

  return <section className="personal-business-finance" aria-labelledby="personal-business-finance-title">
    <div className="personal-finance-heading">
      <div>
        <p className="eyebrow">TABLEAU DE BORD</p>
        <h2 id="personal-business-finance-title"><ZarayIcon name="finance" size={24} /> Entreprises &amp; Finance</h2>
        <p className="muted">Suivi professionnel des entreprises liées à votre compte. Aucune finance privée.</p>
      </div>
      <a className="header-link" href="/finance-globale"><ZarayIcon name="next" size={17} /> Finance globale</a>
    </div>
    <form method="get" action="/mon-compte" className="personal-finance-filters" aria-label="Filtres financiers">
      <label>Entreprise
        <select name="financeCompanyId" defaultValue={selectedCompanyId}>
          <option value="all">Toutes les entreprises autorisées</option>
          {authorized.map(company => <option key={company.id} value={company.id}>{company.legal_name}</option>)}
        </select>
      </label>
      <label>Devise
        <select name="currency" defaultValue={selectedCurrency ?? ''} disabled={!currencies.length}>
          {!currencies.length && <option value="">Aucune donnée</option>}
          {currencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}
        </select>
      </label>
      <button type="submit"><ZarayIcon name="confirm" size={18} /> Appliquer</button>
    </form>
    <div className="personal-finance-kpis">
      <article className="kpi"><div className="kpi-label"><ZarayIcon name="company" size={17} /> ENTREPRISES LIÉES</div>
        <div className="kpi-value">{companies.length}</div><p className="kpi-note">Adhésions actives accessibles</p></article>
      <article className="kpi"><div className="kpi-label"><ZarayIcon name="permissions" size={17} /> ACCÈS FINANCIERS</div>
        <div className="kpi-value">{authorized.length}</div><p className="kpi-note">Entreprises avec droit financier</p></article>
      <article className="kpi"><div className="kpi-label"><ZarayIcon name="payment" size={17} /> PAIEMENTS CONFIRMÉS</div>
        <div className="kpi-value">{financeError ? '—' : paymentCount}</div><p className="kpi-note">Sur les 6 derniers mois calendaires</p></article>
      {currencies.map(currency => <article key={currency} className="kpi">
        <div className="kpi-label"><ZarayIcon name="finance" size={17} /> MONTANT CONFIRMÉ · {currency}</div>
        <div className="kpi-value personal-finance-money">{formatAmount(sums.get(currency) ?? 0, currency)}</div>
        <p className="kpi-note">Paiements reçus · 6 derniers mois</p>
      </article>)}
    </div>
    {financeError ? <div role="alert" className="alert alert-error">{financeError}</div>
      : !authorized.length ? <div className="empty-state"><strong>Aucun accès financier</strong>
          <p>Vous pouvez consulter vos entreprises, mais aucun rôle ne vous autorise à consulter leurs paiements.</p></div>
      : !paymentCount ? <div className="empty-state"><strong>Aucun paiement confirmé sur cette période</strong>
          <p>Les graphiques apparaîtront lorsque des paiements autorisés seront disponibles.</p></div>
      : <div className="personal-finance-charts">
          <section className="panel" aria-label={'Paiements mensuels confirmés en ' + selectedCurrency}>
            <div className="panel-head"><h3 className="panel-title">Évolution des paiements confirmés</h3>
              <span className="status-pill">{selectedCurrency} · 6 mois</span></div>
            <div className="personal-bar-list">
              {monthStarts.map((stamp, index) => {
                const value = monthly[index] ?? 0;
                const label = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(stamp));
                return <div className="personal-bar-row" key={stamp}>
                  <span className="personal-bar-label">{label}</span>
                  <div className="personal-bar-track" role="img" aria-label={label + ' : ' + formatAmount(value, selectedCurrency)}>
                    <div className="personal-bar-fill" style={{ width: (monthMax > 0 ? (value / monthMax) * 100 : 0) + '%' }} />
                  </div>
                  <strong className="personal-bar-value">{formatAmount(value, selectedCurrency)}</strong>
                </div>;
              })}
            </div>
          </section>
          <section className="panel" aria-label={'Répartition par entreprise en ' + selectedCurrency}>
            <div className="panel-head"><h3 className="panel-title">Répartition par entreprise</h3>
              <span className="status-pill">{selectedCurrency}</span></div>
            <div className="personal-bar-list">
              {companyRows.map(({ company, value }) => <div className="personal-bar-row" key={company.id}>
                <span className="personal-bar-label" title={company.legal_name}>{company.legal_name}</span>
                <div className="personal-bar-track" role="img" aria-label={company.legal_name + ' : ' + formatAmount(value, selectedCurrency)}>
                  <div className="personal-bar-fill personal-bar-fill-secondary" style={{ width: (companyMax > 0 ? (value / companyMax) * 100 : 0) + '%' }} />
                </div>
                <strong className="personal-bar-value">{formatAmount(value, selectedCurrency)}</strong>
              </div>)}
            </div>
          </section>
        </div>}
    <p className="personal-finance-footnote">Source : paiements au statut « succeeded » avec date de confirmation, dans les entreprises autorisées. Les devises ne sont jamais additionnées entre elles. Ce suivi ne représente ni les dépenses ni le solde de trésorerie.</p>
  </section>;
}
