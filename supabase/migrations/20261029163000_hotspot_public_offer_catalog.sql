-- Public Hotspot catalog: only active company offers with at least one prepared unused ticket in this site.
-- Exposed to browsers solely through the ZARAY public GET API using service_role.
create or replace function public.get_hotspot_offer_catalog(p_site_id uuid)
returns table(offer_id uuid, offer_name text, offer_description text,
 duration_minutes integer, price_amount numeric, currency text,
 prepared_stock bigint)
language sql security invoker stable
set search_path=public,pg_temp
as $$
 select o.id,o.name,o.description,o.duration_minutes,o.price_amount,o.currency,
  count(v.id)::bigint
 from public.sites s
 join public.offers o on o.company_id=s.company_id and o.status='active'
 join public.wifi_vouchers v on v.site_id=s.id and v.company_id=s.company_id
  and v.offer_id=o.id and v.status='available'
 join public.wifi_voucher_network n on n.voucher_id=v.id and n.site_id=s.id
  and n.network_state='provisioned' and n.unit_price is not null
 join public.network_routers r on r.id=n.router_id and r.company_id=s.company_id
  and r.site_id=s.id and r.control_enabled
 where s.id=p_site_id and s.status='active'
 group by o.id,o.name,o.description,o.duration_minutes,o.price_amount,o.currency
 having count(v.id)>0
 order by o.price_amount asc,o.duration_minutes asc,o.name asc
$$;
revoke all on function public.get_hotspot_offer_catalog(uuid) from public,anon,authenticated;
grant execute on function public.get_hotspot_offer_catalog(uuid) to service_role;
