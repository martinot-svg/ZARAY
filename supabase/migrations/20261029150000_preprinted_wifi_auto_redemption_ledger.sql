
-- ZARAY: pre-printed cash vouchers redeem automatically on first authenticated Hotspot session.
-- Prepared credentials must be confirmed on the RouterOS device before tickets are handed out.
alter table public.wifi_voucher_network
 add column if not exists unit_price numeric(14,2),
 add column if not exists unit_currency text,
 add column if not exists prepared_at timestamptz,
 add column if not exists last_printed_at timestamptz,
 add column if not exists reprint_count integer not null default 0;
alter table public.wifi_voucher_network
 add constraint voucher_network_unit_price_nonnegative check(unit_price is null or unit_price>=0);

create table if not exists public.wifi_voucher_activations (
 voucher_id uuid primary key references public.wifi_vouchers(id) on delete restrict,
 company_id uuid not null references public.companies(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade,
 router_id uuid not null references public.network_routers(id) on delete restrict,
 offer_id uuid not null references public.offers(id) on delete restrict,
 amount numeric(14,2) not null check(amount>=0),
 currency text not null check(length(currency) between 3 and 8),
 activated_at timestamptz not null default now(),
 source text not null default 'mikrotik_hotspot' check(source='mikrotik_hotspot')
);
create index if not exists wifi_voucher_activations_company_date on public.wifi_voucher_activations(company_id,activated_at desc);
create index if not exists wifi_voucher_activations_site_date on public.wifi_voucher_activations(site_id,activated_at desc);
alter table public.wifi_voucher_activations enable row level security;
revoke all on public.wifi_voucher_activations from anon,authenticated;
grant select on public.wifi_voucher_activations to authenticated;
drop policy if exists wifi_voucher_activations_tenant_read on public.wifi_voucher_activations;
create policy wifi_voucher_activations_tenant_read on public.wifi_voucher_activations for select to authenticated
 using(exists(select 1 from public.company_members m where m.company_id=wifi_voucher_activations.company_id
   and m.user_id=(select auth.uid()) and m.status='active'));

-- The service-role-only function is called ONLY after a *connected* Hotspot user
-- appears in the authenticated router-agent observations; retries never double count.
create or replace function public.record_preprinted_wifi_logins(p_router_id uuid,p_usernames jsonb)
returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare u text; v record; affected integer:=0;
begin
 if current_user<>'service_role' then raise exception using errcode='42501',message='Service role required';end if;
 if jsonb_typeof(p_usernames) is distinct from 'array' or jsonb_array_length(p_usernames)>500 then
  raise exception using errcode='22023',message='Invalid session batch';end if;
 for u in select distinct jsonb_array_elements_text(p_usernames) loop
  if length(u) not between 3 and 128 then continue;end if;
  select v.id,v.company_id,v.site_id,v.offer_id,v.username,
         n.router_id,n.unit_price,n.unit_currency into v
   from public.wifi_vouchers v join public.wifi_voucher_network n on n.voucher_id=v.id
   where n.router_id=p_router_id and v.username=u
    and v.status='available' and n.network_state='provisioned'
    and n.unit_price is not null and n.unit_currency is not null
   for update of v,n;
  if not found then continue;end if;
  update public.wifi_vouchers set status='active',paid_at=now(),activated_at=now(),expires_at=null
    where id=v.id and status='available';
  if not found then continue;end if;
  insert into public.wifi_voucher_activations(voucher_id,company_id,site_id,router_id,offer_id,amount,currency)
   values(v.id,v.company_id,v.site_id,v.router_id,v.offer_id,v.unit_price,v.unit_currency)
   on conflict(voucher_id) do nothing;
  affected:=affected+1;
 end loop;
 return affected;
end $$;
revoke all on function public.record_preprinted_wifi_logins(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_preprinted_wifi_logins(uuid,jsonb) to service_role;

-- Stop the old manual cashier RPC from marking pre-printed vouchers as paid.
revoke execute on function public.sell_wifi_voucher(uuid,text) from authenticated;

-- Cron: prepare newly generated stock BEFORE sale; keep old paid-ticket flow
-- for historical orders; retry failures conservatively.
create or replace function network_internal.reconcile_wifi_vouchers()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; failures integer; v_action text;
begin
 update public.wifi_vouchers v set status='expired',expires_at=now()
 where v.status='active' and exists (
  select 1 from public.wifi_voucher_network n where n.voucher_id=v.id
    and n.used_seconds>=v.duration_minutes*60
 );
 update public.wifi_vouchers set status='expired'
 where status='paid' and paid_at is not null and paid_at+make_interval(days=>validity_days)<=now();
 for r in
  select v.id,v.username,v.company_id,v.status,n.router_id,n.network_state,n.unit_price
   from public.wifi_vouchers v
   join public.wifi_voucher_network n on n.voucher_id=v.id
   join public.network_routers router on router.id=n.router_id
   where router.control_enabled and router.last_seen_at>now()-interval '3 minutes'
     and (
      (v.status='expired' and n.network_state not in ('expired','not_sold'))
      or
      (v.status='available' and n.unit_price is not null and n.network_state in ('queued','failed'))
      or
      (v.status='paid' and n.network_state in ('queued','failed'))
     )
 loop
  v_action:=case when r.status='expired' then 'expire_voucher' else 'provision_voucher' end;
  select count(*) into failures from public.network_commands c
   where c.voucher_id=r.id and c.action=v_action and c.status='failed'
    and c.created_at>now()-interval '1 day';
  if failures>=3 then continue;end if;
  if exists(select 1 from public.network_commands c where c.voucher_id=r.id
     and c.action=v_action and c.status in ('queued','dispatched','success')) then continue;end if;
  if exists(select 1 from public.network_commands c where c.voucher_id=r.id
     and c.action=v_action and c.status='failed' and c.created_at>now()-interval '15 minutes') then continue;end if;
  insert into public.network_commands(company_id,router_id,voucher_id,protocol,username,action,reason)
   values(r.company_id,r.router_id,r.id,'hotspot',r.username,v_action,
     case when v_action='expire_voucher' then 'Expiration du ticket préimprimé'
     else 'Préparation du ticket préimprimé avant vente' end);
  if v_action='provision_voucher' then
   update public.wifi_voucher_network set network_state='queued',updated_at=now() where voucher_id=r.id;
  end if;
 end loop;
end $$;
revoke all on function network_internal.reconcile_wifi_vouchers() from public,anon,authenticated;
