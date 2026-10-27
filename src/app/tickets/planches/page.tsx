import { redirect } from 'next/navigation';

// Keep existing bookmarks working without creating a second Tickets Wi-Fi module.
export default async function LegacyTicketView({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; siteId?: string }>;
}) {
  const values = await searchParams;
  const qs = new URLSearchParams({ tab: 'generate' });
  if (values.companyId) qs.set('companyId', values.companyId);
  if (values.siteId) qs.set('siteId', values.siteId);
  redirect('/tickets?' + qs.toString());
}
