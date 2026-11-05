/** Serializable, permission-scoped dashboard data; shared by RSC and the client view. */
export type DashboardMetrics = {
  sites: number | null;
  customers: number | null;
  offers: number | null;
  subscription_orders: number | null;
  payments: number | null;
  wifi_tickets: number | null;
  walkin_sales: number | null;
};
export type DashboardPayload = {
  company: { id: string; legal_name: string; slug: string };
  site: { id: string; company_id: string; name: string; status: string } | null;
  role: string;
  metrics: DashboardMetrics;
  sites: { id: string; company_id: string; name: string; status: string }[];
  recentOrders: {
    id: string; public_reference: string; customer_name: string;
    offer_name: string; status: string; created_at: string;
  }[];
};
