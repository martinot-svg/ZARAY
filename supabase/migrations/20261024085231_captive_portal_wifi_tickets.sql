-- Recovered from original GitHub commit 28bb61343da060bb62b3261ee4e2b7e5eeaf6335.
-- ZARAY modules 7-8: public captive-portal catalogue, pending orders and guarded Wi-Fi ticket issuance.
create table if not exists public.subscription_orders (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null unique,
  company_id uuid not null references public.companies(id) on delete restrict,
  site_id uuid references public.sites(id) on delete restrict,
  offer_id uuid not null references public.offers(id) on delete restrict,
  customer_name text not null check (char_length(trim(customer_name)) between 2 and 160),
  customer_email text not null check (customer_email=lower(trim(customer_email)) and char_length(customer_email)<=254),
  customer_phone text check (customer_phone is null or char_length(trim(customer_phone)) between 5 and 32),
  offer_name text not null,
  amount numeric(12,2) not null check (amount>=0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  duration_minutes integer not null check (duration_minutes between 1 and 525600),
  validity_days integer not null check (validity_days between 1 and 3650),
  max_devices integer not null check (max_devices between 1 and 100),
  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','cancelled','expired','activation_pending','active','failed')),
  paid_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscription_orders_company_created on public.subscription_orders(company_id, created_at desc);
create index if not exists idx_subscription_orders_pending_email on public.subscription_orders(company_id, customer_email, created_at desc) where status='pending_payment';
create index if not exists idx_subscription_orders_status_created on public.subscription_orders(status, created_at desc);

create table if not exists public.wifi_tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  subscription_order_id uuid not null unique references public.subscription_orders(id) on delete restrict,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  code_prefix text not null check (char_length(code_prefix) between 4 and 12),
  status text not null default 'issued' check (status in ('issued','redeemed','expired','revoked')),
  duration_minutes integer not null check (duration_minutes between 1 and 525600),
  max_devices integer not null check (max_devices between 1 and 100),
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (valid_until > valid_from)
);
create index if not exists idx_wifi_tickets_company_created on public.wifi_tickets(company_id, created_at desc);
create index if not exists idx_wifi_tickets_status_validity on public.wifi_tickets(status, valid_until);

alter table public.subscription_orders enable row level security;
alter table public.wifi_tickets enable row level security;
revoke all on public.subscription_orders, public.wifi_tickets from public, anon, authenticated;
grant select on public.subscription_orders to authenticated;
grant select (id,company_id,subscription_order_id,code_prefix,status,duration_minutes,max_devices,valid_from,valid_until,redeemed_at,revoked_at,created_by,created_at) on public.wifi_tickets to authenticated;

drop policy if exists "active company members read subscription orders" on public.subscription_orders;
create policy "active company members read subscription orders" on public.subscription_orders for select to authenticated
using (exists (select 1 from public.company_members m where m.company_id=subscription_orders.company_id and m.user_id=(select auth.uid()) and m.status='active'));

drop policy if exists "active company members read Wi-Fi tickets" on public.wifi_tickets;
create policy "active company members read Wi-Fi tickets" on public.wifi_tickets for select to authenticated
using (exists (select 1 from public.company_members m where m.company_id=wifi_tickets.company_id and m.user_id=(select auth.uid()) and m.status='active'));

create or replace function public.get_public_offer_catalog(p_company_slug text)
returns table (company_name text, company_slug text, offer_id uuid, offer_name text, description text, duration_minutes integer, validity_days integer, price_amount numeric, currency text, max_devices integer)
language sql stable security definer set search_path = ''
as $$
  select c.legal_name, c.slug, o.id, o.name, o.description, o.duration_minutes, o.validity_days, o.price_amount, o.currency, o.max_devices
  from public.companies c join public.offers o on o.company_id=c.id
  where c.slug=lower(trim(p_company_slug)) and c.status in ('trial','active') and o.status='active'
  order by o.price_amount asc, o.name asc limit 100;
$$;

create or replace function public.create_public_subscription_order(
  p_company_slug text, p_offer_id uuid, p_customer_name text, p_customer_email text, p_customer_phone text default null
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_company_id uuid;
  v_offer public.offers%rowtype;
  v_name text := trim(coalesce(p_customer_name,''));
  v_email text := lower(trim(coalesce(p_customer_email,'')));
  v_phone text := nullif(trim(coalesce(p_customer_phone,'')),'');
  v_order_id uuid;
  v_reference text;
  v_recent_count integer;
begin
  if length(v_name)<2 or length(v_name)>160 or length(v_email)>254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or (v_phone is not null and length(v_phone) not between 5 and 32) then
    raise exception 'invalid_customer_details' using errcode='22023';
  end if;
  if p_company_slug is null or length(trim(p_company_slug)) not between 2 and 80 then
    raise exception 'invalid_company' using errcode='22023';
  end if;
  select c.id into v_company_id from public.companies c
  where c.slug=lower(trim(p_company_slug)) and c.status in ('trial','active');
  if v_company_id is null then raise exception 'company_not_found' using errcode='P0002'; end if;
  select o.* into v_offer from public.offers o
  where o.id=p_offer_id and o.company_id=v_company_id and o.status='active';
  if v_offer.id is null then raise exception 'offer_not_available' using errcode='P0002'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_company_id::text || ':' || v_email, 0));
  select count(*) into v_recent_count from public.subscription_orders so
  where so.company_id=v_company_id and so.customer_email=v_email and so.status='pending_payment'
    and so.created_at > now() - interval '15 minutes';
  if v_recent_count>=3 then raise exception 'too_many_orders' using errcode='P0001'; end if;

  v_order_id:=gen_random_uuid();
  v_reference:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  insert into public.subscription_orders(id,public_reference,company_id,offer_id,customer_name,customer_email,customer_phone,offer_name,amount,currency,duration_minutes,validity_days,max_devices,status)
  values(v_order_id,v_reference,v_company_id,v_offer.id,v_name,v_email,v_phone,v_offer.name,v_offer.price_amount,v_offer.currency,v_offer.duration_minutes,v_offer.validity_days,v_offer.max_devices,'pending_payment');

  insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(v_company_id,null,'subscription_order.created',jsonb_build_object('order_id',v_order_id,'reference',v_reference,'offer_id',v_offer.id,'amount',v_offer.price_amount,'currency',v_offer.currency,'source','captive_portal'));

  return jsonb_build_object('id',v_order_id,'reference',v_reference,'status','pending_payment','amount',v_offer.price_amount,'currency',v_offer.currency,'offer_name',v_offer.name);
end;
$$;

create or replace function public.issue_wifi_ticket(p_order_id uuid,p_code_hash text,p_code_prefix text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.subscription_orders%rowtype;
  v_ticket public.wifi_tickets%rowtype;
  v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from auth.users u where u.id=v_user_id and u.email_confirmed_at is not null) then
    raise exception 'verified_email_required' using errcode='42501';
  end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' or p_code_prefix is null or length(p_code_prefix) not between 4 and 12 then
    raise exception 'invalid_ticket_code' using errcode='22023';
  end if;
  select so.* into v_order from public.subscription_orders so where so.id=p_order_id for update;
  if v_order.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;
  if not exists(select 1 from public.company_members m where m.company_id=v_order.company_id and m.user_id=v_user_id and m.status='active' and m.role in ('owner','admin','site_manager','support','sales')) then
    raise exception 'role_not_authorized' using errcode='42501';
  end if;
  if v_order.status<>'paid' or v_order.paid_at is null then raise exception 'payment_not_confirmed' using errcode='42501'; end if;
  if exists(select 1 from public.wifi_tickets t where t.subscription_order_id=v_order.id) then raise exception 'ticket_already_issued' using errcode='23505'; end if;

  insert into public.wifi_tickets(company_id,subscription_order_id,code_hash,code_prefix,status,duration_minutes,max_devices,valid_from,valid_until,created_by)
  values(v_order.company_id,v_order.id,p_code_hash,upper(p_code_prefix),'issued',v_order.duration_minutes,v_order.max_devices,now(),now()+make_interval(days=>v_order.validity_days),v_user_id)
  returning * into v_ticket;

  insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(v_order.company_id,v_user_id,'wifi_ticket.issued',jsonb_build_object('ticket_id',v_ticket.id,'order_id',v_order.id,'reference',v_order.public_reference));

  return jsonb_build_object('id',v_ticket.id,'company_id',v_ticket.company_id,'subscription_order_id',v_ticket.subscription_order_id,'code_prefix',v_ticket.code_prefix,'status',v_ticket.status,'valid_from',v_ticket.valid_from,'valid_until',v_ticket.valid_until,'duration_minutes',v_ticket.duration_minutes,'max_devices',v_ticket.max_devices);
end;
$$;

create or replace function public.revoke_wifi_ticket(p_ticket_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_ticket public.wifi_tickets%rowtype;
  v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select t.* into v_ticket from public.wifi_tickets t where t.id=p_ticket_id for update;
  if v_ticket.id is null then raise exception 'ticket_not_found' using errcode='P0002'; end if;
  if not exists(select 1 from public.company_members m where m.company_id=v_ticket.company_id and m.user_id=v_user_id and m.status='active' and m.role in ('owner','admin','site_manager','support')) then
    raise exception 'role_not_authorized' using errcode='42501';
  end if;
  if v_ticket.status<>'issued' then raise exception 'ticket_not_revokeable' using errcode='P0001'; end if;
  update public.wifi_tickets set status='revoked',revoked_at=now() where id=v_ticket.id;
  insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(v_ticket.company_id,v_user_id,'wifi_ticket.revoked',jsonb_build_object('ticket_id',v_ticket.id,'order_id',v_ticket.subscription_order_id));
  return true;
end;
$$;

revoke all on function public.get_public_offer_catalog(text) from public,authenticated,anon;
grant execute on function public.get_public_offer_catalog(text) to anon,authenticated;
revoke all on function public.create_public_subscription_order(text,uuid,text,text,text) from public,authenticated,anon;
grant execute on function public.create_public_subscription_order(text,uuid,text,text,text) to anon,authenticated;
revoke all on function public.issue_wifi_ticket(uuid,text,text) from public,anon,authenticated;
grant execute on function public.issue_wifi_ticket(uuid,text,text) to authenticated;
revoke all on function public.revoke_wifi_ticket(uuid) from public,anon,authenticated;
grant execute on function public.revoke_wifi_ticket(uuid) to authenticated;
