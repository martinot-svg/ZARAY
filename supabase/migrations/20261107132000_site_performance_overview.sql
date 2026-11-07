-- Site performance: read-only, server-only financial aggregation.
-- Never treat a HotSpot activation as a verified cash receipt.
-- Function is SECURITY INVOKER and may only be called by service_role
-- after the Next.js route checks the user's live company/site permissions.
CREATE OR REPLACE FUNCTION public.site_performance_overview(
 p_company_id uuid, p_site_id uuid, p_period text
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $body$
WITH clock AS (
 SELECT now() AS observed_at,
  (now() AT TIME ZONE 'Indian/Antananarivo') AS local_now
),
calendar AS (
 SELECT observed_at,
  CASE p_period
   WHEN 'day' THEN date_trunc('day',local_now)
   WHEN 'week' THEN date_trunc('week',local_now)
   WHEN 'month' THEN date_trunc('month',local_now)
   WHEN 'year' THEN date_trunc('year',local_now)
  END AS local_start
 FROM clock
),
bounds AS (
 SELECT observed_at, local_start,
  (local_start AT TIME ZONE 'Indian/Antananarivo') AS begins_at,
  ((local_start + CASE p_period
    WHEN 'day' THEN interval '1 day'
    WHEN 'week' THEN interval '7 days'
    WHEN 'month' THEN interval '1 month'
    WHEN 'year' THEN interval '1 year' END)
    AT TIME ZONE 'Indian/Antananarivo') AS ends_at
 FROM calendar
),
receipts AS (
 SELECT 'subscription'::text AS origin,p.amount,p.currency,
  p.confirmed_at AS received_at,p.order_id
 FROM public.payments p
 JOIN public.subscription_orders o ON o.id=p.order_id AND o.company_id=p.company_id
 CROSS JOIN bounds b
 WHERE p.company_id=p_company_id AND o.site_id=p_site_id
  AND p.status='succeeded' AND p.confirmed_at>=b.begins_at AND p.confirmed_at<b.ends_at
 UNION ALL
 SELECT 'ticket'::text, s.amount,s.currency,s.created_at,NULL::uuid
 FROM public.walkin_sales s CROSS JOIN bounds b
 WHERE s.company_id=p_company_id AND s.site_id=p_site_id
  AND s.created_at>=b.begins_at AND s.created_at<b.ends_at
 UNION ALL
 -- Legacy cashier-confirmed voucher sales; NOT first RouterOS logins.
 SELECT 'ticket'::text,s.amount,s.currency,s.created_at,NULL::uuid
 FROM public.wifi_voucher_sales s CROSS JOIN bounds b
 WHERE s.company_id=p_company_id AND s.site_id=p_site_id
  AND s.created_at>=b.begins_at AND s.created_at<b.ends_at
),
currency_summary AS (
 SELECT currency,
  sum(amount) AS total,
  coalesce(sum(amount) FILTER(WHERE origin='ticket'),0) AS tickets_amount,
  coalesce(sum(amount) FILTER(WHERE origin='subscription'),0) AS subscriptions_amount,
  count(*) FILTER(WHERE origin='ticket') AS ticket_sales,
  count(DISTINCT order_id) FILTER(WHERE origin='subscription') AS subscription_orders_paid
 FROM receipts GROUP BY currency
),
totals AS (
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'currency',currency,'total',total::text,
  'ticketsAmount',tickets_amount::text,
  'subscriptionsAmount',subscriptions_amount::text,
  'ticketsSold',ticket_sales,
  'subscriptionOrdersPaid',subscription_orders_paid) ORDER BY currency),'[]'::jsonb) AS currencies,
  coalesce(sum(ticket_sales),0) AS tickets_sold,
  coalesce(sum(subscription_orders_paid),0) AS subscription_orders_paid
 FROM currency_summary
),
trend_summary AS (
 SELECT currency,
  date_trunc(
   CASE WHEN p_period='day' THEN 'hour'
        WHEN p_period='year' THEN 'month'
        ELSE 'day' END,
   received_at AT TIME ZONE 'Indian/Antananarivo') AS bucket_local,
  sum(amount) AS amount
 FROM receipts
 GROUP BY currency,bucket_local
),
trend AS (
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'currency',currency,
  'bucket',to_char(bucket_local,'YYYY-MM-DD HH24:MI'),
  'amount',amount::text) ORDER BY bucket_local,currency),'[]'::jsonb) AS values
 FROM trend_summary
),
stock AS (
 SELECT count(*) FILTER(WHERE v.status='available') AS unsold,
  count(*) FILTER(WHERE v.status='available' AND n.network_state='provisioned') AS ready,
  count(*) FILTER(WHERE v.status='available' AND n.network_state IS DISTINCT FROM 'provisioned') AS unprepared,
  count(*) FILTER(WHERE v.status IN ('paid','active','expired')) AS previously_used
 FROM public.wifi_vouchers v
 LEFT JOIN public.wifi_voucher_network n
  ON n.voucher_id=v.id AND n.company_id=v.company_id AND n.site_id=v.site_id
 WHERE v.company_id=p_company_id AND v.site_id=p_site_id
),
activation AS (
 SELECT count(*) AS first_connections
 FROM public.wifi_voucher_activations a CROSS JOIN bounds b
 WHERE a.company_id=p_company_id AND a.site_id=p_site_id
  AND a.activated_at>=b.begins_at AND a.activated_at<b.ends_at
),
subscriptions AS (
 SELECT count(*) AS total,
  count(*) FILTER(WHERE s.paid_cycles>0 AND s.expires_at<=b.observed_at) AS overdue,
  count(*) FILTER(WHERE s.activated_cycles=0 OR s.expires_at<=b.observed_at) AS inactive,
  count(*) FILTER(WHERE s.paid_cycles>s.activated_cycles) AS waiting_activation,
  count(*) FILTER(WHERE (
     o.status='failed' OR EXISTS (
      SELECT 1 FROM public.payments fp
      WHERE fp.company_id=p_company_id AND fp.order_id=s.latest_order_id AND fp.status='failed'
     )
   ) AND NOT EXISTS (
     SELECT 1 FROM public.payments ok
     WHERE ok.company_id=p_company_id AND ok.order_id=s.latest_order_id AND ok.status='succeeded'
   )) AS payment_failure
 FROM public.residential_subscriptions s
 LEFT JOIN public.subscription_orders o
  ON o.id=s.latest_order_id AND o.company_id=s.company_id
 CROSS JOIN bounds b
 WHERE s.company_id=p_company_id AND s.site_id=p_site_id
),
failed_attempts AS (
 SELECT count(*) AS failed_count
 FROM public.payments p
 JOIN public.subscription_orders o ON o.id=p.order_id AND o.company_id=p.company_id
 CROSS JOIN bounds b
 WHERE p.company_id=p_company_id AND o.site_id=p_site_id
  AND p.status='failed' AND p.created_at>=b.begins_at AND p.created_at<b.ends_at
)
SELECT jsonb_build_object(
 'period',p_period,'timezone','Indian/Antananarivo',
 'start',b.begins_at,'end',b.ends_at,
 'currencies',t.currencies,'trend',tr.values,
 'tickets',jsonb_build_object('sold',t.tickets_sold,'stock',st.unsold,
  'ready',st.ready,'unprepared',st.unprepared,'firstConnections',a.first_connections),
 'subscriptions',jsonb_build_object('total',s.total,
  'paidOrders',t.subscription_orders_paid,'overdue',s.overdue,
  'inactive',s.inactive,'failures',s.payment_failure,
  'waitingActivation',s.waiting_activation,'failedAttempts',f.failed_count)
)
FROM bounds b CROSS JOIN totals t CROSS JOIN trend tr CROSS JOIN stock st
 CROSS JOIN activation a CROSS JOIN subscriptions s CROSS JOIN failed_attempts f
WHERE p_period IN ('day','week','month','year')
$body$;
REVOKE ALL ON FUNCTION public.site_performance_overview(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.site_performance_overview(uuid,uuid,text)
 TO service_role;
