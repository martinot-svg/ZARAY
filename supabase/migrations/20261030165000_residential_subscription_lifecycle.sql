-- ZARAY: durable residential subscription ledger.
-- A client is created through public registration; subscriptions are derived from
-- orders and cannot be manually forged by a browser. Network activation is separate.

create table if not exists public.residential_subscriptions (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete restrict,
 customer_id uuid not null references public.customers(id) on delete restrict,
 site_id uuid references public.sites(id) on delete restrict,
 first_order_id uuid not null references public.subscription_orders(id) on delete restrict,
 latest_order_id uuid not null references public.subscription_orders(id) on delete restrict,
 latest_paid_order_id uuid references public.subscription_orders(id) on delete restrict,
 offer_id uuid not null references public.offers(id) on delete restrict,
 offer_name text not null,
 validity_days integer not null check(validity_days between 1 and 3650),
 paid_cycles integer not null default 0 check(paid_cycles >= 0),
 activated_cycles integer not null default 0 check(activated_cycles >= 0),
 last_paid_at timestamptz,
 activated_at timestamptz,
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(company_id,customer_id),
 check(activated_cycles <= paid_cycles)
);
create index if not exists residential_subscriptions_company_recent
 on public.residential_subscriptions(company_id,updated_at desc);
create index if not exists residential_subscriptions_company_expiry
 on public.residential_subscriptions(company_id,expires_at);
create index if not exists residential_subscriptions_site
 on public.residential_subscriptions(company_id,site_id);

create table if not exists public.residential_subscription_cycles(
 id uuid primary key default gen_random_uuid(),
 subscription_id uuid not null references public.residential_subscriptions(id) on delete restrict,
 company_id uuid not null references public.companies(id) on delete restrict,
 order_id uuid not null unique references public.subscription_orders(id) on delete restrict,
 paid_at timestamptz not null,
 activated_at timestamptz,
 period_start timestamptz,
 period_end timestamptz,
 validity_days integer not null check(validity_days between 1 and 3650),
 offer_name text not null,
 amount numeric(14,2) not null,
 currency text not null,
 created_at timestamptz not null default now(),
 check((activated_at is null and period_start is null and period_end is null)
   or (activated_at is not null and period_start is not null and period_end is not null
    and period_end > period_start))
);
create index if not exists residential_cycles_subscription_period
 on public.residential_subscription_cycles(subscription_id,period_end desc);
create index if not exists residential_cycles_company
 on public.residential_subscription_cycles(company_id,paid_at desc);

alter table public.residential_subscriptions enable row level security;
alter table public.residential_subscription_cycles enable row level security;
revoke all on public.residential_subscriptions from anon,authenticated;
revoke all on public.residential_subscription_cycles from anon,authenticated;
grant select on public.residential_subscriptions to authenticated;
grant select on public.residential_subscription_cycles to authenticated;

create policy "active company members view residential subscriptions"
 on public.residential_subscriptions for select to authenticated
 using (exists (select 1 from public.company_members m
  where m.company_id=residential_subscriptions.company_id
   and m.user_id=(select auth.uid()) and m.status='active'));
create policy "active company members view residential payment periods"
 on public.residential_subscription_cycles for select to authenticated
 using (exists (select 1 from public.company_members m
  where m.company_id=residential_subscription_cycles.company_id
   and m.user_id=(select auth.uid()) and m.status='active'));

-- Runs only as an internal trigger / migration backfill, never a public RPC.
create or replace function network_internal.sync_residential_subscription(p_order_id uuid)
returns void language plpgsql security definer set search_path=''
as $fn$
declare
 v_order public.subscription_orders%rowtype;
 v_sub public.residential_subscriptions%rowtype;
 v_cycle public.residential_subscription_cycles%rowtype;
 v_last_end timestamptz;
 v_start timestamptz;
begin
 select * into v_order from public.subscription_orders where id=p_order_id;
 if v_order.id is null or v_order.customer_id is null then return; end if;

 -- Serialise all orders and renewals belonging to one customer in one tenant.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(v_order.company_id::text||':'||v_order.customer_id::text,1));

 insert into public.residential_subscriptions(
   company_id,customer_id,site_id,first_order_id,latest_order_id,
   offer_id,offer_name,validity_days
 ) values(
   v_order.company_id,v_order.customer_id,v_order.site_id,v_order.id,v_order.id,
   v_order.offer_id,v_order.offer_name,v_order.validity_days
 )
 on conflict(company_id,customer_id)
 do update set
   latest_order_id=case when
     (select so.created_at from public.subscription_orders so where so.id=excluded.latest_order_id)
     >= (select so.created_at from public.subscription_orders so where so.id=residential_subscriptions.latest_order_id)
     then excluded.latest_order_id else residential_subscriptions.latest_order_id end,
   site_id=coalesce(residential_subscriptions.site_id,excluded.site_id),
   updated_at=now();

 select * into v_sub from public.residential_subscriptions
  where company_id=v_order.company_id and customer_id=v_order.customer_id for update;

 if v_order.paid_at is null or v_order.status not in ('paid','activation_pending','active','failed') then return; end if;

 insert into public.residential_subscription_cycles(
   subscription_id,company_id,order_id,paid_at,validity_days,offer_name,amount,currency
 ) values(
   v_sub.id,v_order.company_id,v_order.id,v_order.paid_at,
   v_order.validity_days,v_order.offer_name,v_order.amount,v_order.currency
 ) on conflict(order_id) do nothing;

 select * into v_cycle from public.residential_subscription_cycles
  where order_id=v_order.id for update;

 if v_order.activated_at is not null and v_cycle.activated_at is null then
   select max(period_end) into v_last_end
     from public.residential_subscription_cycles
     where subscription_id=v_sub.id and activated_at is not null;
   v_start=greatest(v_order.activated_at,coalesce(v_last_end,v_order.activated_at));
   update public.residential_subscription_cycles
    set activated_at=v_order.activated_at,
        period_start=v_start,
        period_end=v_start+make_interval(days=>v_order.validity_days)
    where id=v_cycle.id;
 end if;

 update public.residential_subscriptions s set
   paid_cycles=(select count(*)::integer from public.residential_subscription_cycles x where x.subscription_id=s.id),
   activated_cycles=(select count(*)::integer from public.residential_subscription_cycles x where x.subscription_id=s.id and x.activated_at is not null),
   latest_paid_order_id=(select x.order_id from public.residential_subscription_cycles x where x.subscription_id=s.id order by x.paid_at desc,x.created_at desc limit 1),
   last_paid_at=(select max(x.paid_at) from public.residential_subscription_cycles x where x.subscription_id=s.id),
   expires_at=(select max(x.period_end) from public.residential_subscription_cycles x where x.subscription_id=s.id),
   activated_at=(select min(x.activated_at) from public.residential_subscription_cycles x where x.subscription_id=s.id),
   offer_id=(select so.offer_id from public.subscription_orders so
              join public.residential_subscription_cycles x on x.order_id=so.id
             where x.subscription_id=s.id order by x.paid_at desc,x.created_at desc limit 1),
   offer_name=(select x.offer_name from public.residential_subscription_cycles x
             where x.subscription_id=s.id order by x.paid_at desc,x.created_at desc limit 1),
   validity_days=(select x.validity_days from public.residential_subscription_cycles x
             where x.subscription_id=s.id order by x.paid_at desc,x.created_at desc limit 1),
   updated_at=now()
 where s.id=v_sub.id;
end;
$fn$;
revoke all on function network_internal.sync_residential_subscription(uuid) from public,anon,authenticated;

create or replace function network_internal.residential_order_sync_trigger()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 perform network_internal.sync_residential_subscription(new.id);
 return new;
end;
$fn$;
revoke all on function network_internal.residential_order_sync_trigger() from public,anon,authenticated;

drop trigger if exists residential_subscription_order_sync on public.subscription_orders;
create trigger residential_subscription_order_sync
 after insert or update of status,paid_at,activated_at on public.subscription_orders
 for each row execute function network_internal.residential_order_sync_trigger();

-- Existing customer registrations and paid periods are preserved on rollout.
do $$
declare o record;
begin
 for o in select id from public.subscription_orders
   where customer_id is not null
   order by coalesce(activated_at,paid_at,created_at),created_at,id
 loop
   perform network_internal.sync_residential_subscription(o.id);
 end loop;
end $$;

-- Restrict renewal request to a logged-in active company officer.
-- It generates an unpaid order; it never validates payment or activates a router.
create or replace function public.request_residential_renewal(p_subscription_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid:=auth.uid();
 v_sub public.residential_subscriptions%rowtype;
 v_member_role text;
 v_offer public.offers%rowtype;
 v_customer public.customers%rowtype;
 v_pending public.subscription_orders%rowtype;
 v_reference text;
 v_new uuid;
begin
 if v_actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not exists(select 1 from auth.users u where u.id=v_actor and u.email_confirmed_at is not null)
 then raise exception 'email_verification_required' using errcode='42501'; end if;
 select * into v_sub from public.residential_subscriptions where id=p_subscription_id for update;
 if v_sub.id is null then raise exception 'subscription_not_found' using errcode='P0002'; end if;
 select m.role into v_member_role from public.company_members m
  where m.company_id=v_sub.company_id and m.user_id=v_actor and m.status='active';
 if v_member_role is null or v_member_role not in ('owner','admin','site_manager','sales')
 then raise exception 'role_not_authorized' using errcode='42501'; end if;

 select * into v_pending from public.subscription_orders o
   where o.company_id=v_sub.company_id and o.customer_id=v_sub.customer_id
    and o.status='pending_payment' and o.created_at>now()-interval '30 days'
   order by o.created_at desc limit 1;
 if v_pending.id is not null then
  return jsonb_build_object('id',v_pending.id,'reference',v_pending.public_reference,
    'status',v_pending.status,'already_pending',true);
 end if;
 select * into v_offer from public.offers where id=v_sub.offer_id
   and company_id=v_sub.company_id and status='active';
 if v_offer.id is null then raise exception 'offer_unavailable' using errcode='P0002'; end if;
 select * into v_customer from public.customers where id=v_sub.customer_id and company_id=v_sub.company_id;
 if v_customer.id is null or v_customer.email is null
 then raise exception 'customer_unavailable' using errcode='P0002'; end if;
 v_reference=upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 insert into public.subscription_orders(
  public_reference,company_id,site_id,offer_id,customer_name,customer_email,customer_phone,
  offer_name,amount,currency,duration_minutes,validity_days,max_devices,status
 ) values(
  v_reference,v_sub.company_id,v_sub.site_id,v_offer.id,v_customer.full_name,
  v_customer.email,v_customer.phone,v_offer.name,v_offer.price_amount,v_offer.currency,
  v_offer.duration_minutes,v_offer.validity_days,v_offer.max_devices,'pending_payment'
 ) returning id into v_new;
 insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(v_sub.company_id,v_actor,'residential.renewal_requested',
   jsonb_build_object('subscription_id',v_sub.id,'order_id',v_new,'reference',v_reference));
 return jsonb_build_object('id',v_new,'reference',v_reference,
  'status','pending_payment','already_pending',false);
end;
$fn$;
revoke all on function public.request_residential_renewal(uuid) from public,anon;
grant execute on function public.request_residential_renewal(uuid) to authenticated;

-- KPI function uses the caller's RLS visibility (SECURITY INVOKER).
create or replace function public.residential_subscription_summary(p_company_id uuid,p_site_id uuid default null)
returns jsonb language sql stable security invoker set search_path=''
as $fn$
 select jsonb_build_object(
 'total',count(*),
 'active',count(*) filter(where s.expires_at>now()),
 'expiring',count(*) filter(where s.expires_at>now() and s.expires_at<=now()+interval '7 days'),
 'expired',count(*) filter(where s.expires_at<=now()),
 'waiting_payment',count(*) filter(where s.paid_cycles=0),
 'waiting_activation',count(*) filter(where s.paid_cycles>s.activated_cycles
   and (s.expires_at is null or s.expires_at<=now()))
 )
 from public.residential_subscriptions s
 where s.company_id=p_company_id and (p_site_id is null or s.site_id=p_site_id);
$fn$;
revoke all on function public.residential_subscription_summary(uuid,uuid) from public,anon;
grant execute on function public.residential_subscription_summary(uuid,uuid) to authenticated;
