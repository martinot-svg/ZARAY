-- Recovered from original GitHub commit eded502f86af974e90bd6385dbf5b1c82e2d5c18.
-- ZARAY module 9: provider-neutral payment ledger and idempotent, server-verified webhook processing.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  order_id uuid not null references public.subscription_orders(id) on delete restrict,
  provider text not null check (provider ~ '^[a-z0-9_-]{2,40}$'),
  provider_payment_id text not null check (length(trim(provider_payment_id)) between 1 and 200),
  idempotency_key text not null unique,
  amount numeric(12,2) not null check (amount>=0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('pending','succeeded','failed','cancelled','review_required')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,provider_payment_id)
);
create unique index if not exists idx_payments_one_success_per_order
  on public.payments(order_id) where status='succeeded';
create index if not exists idx_payments_company_created
  on public.payments(company_id,created_at desc);
create index if not exists idx_payments_order_created
  on public.payments(order_id,created_at desc);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  provider text not null check (provider ~ '^[a-z0-9_-]{2,40}$'),
  provider_event_id text not null check (length(trim(provider_event_id)) between 1 and 200),
  event_type text not null check (length(trim(event_type)) between 1 and 100),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  received_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);
create index if not exists idx_payment_events_company_received
  on public.payment_events(company_id,received_at desc);

alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
revoke all on public.payments,public.payment_events from public,anon,authenticated;
grant select on public.payments to authenticated;
grant select (id,company_id,payment_id,provider,provider_event_id,event_type,received_at) on public.payment_events to authenticated;

drop policy if exists "finance members read payments" on public.payments;
create policy "finance members read payments" on public.payments for select to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id=payments.company_id and m.user_id=(select auth.uid())
    and m.status='active' and m.role in ('owner','admin','finance','support','sales')
));
drop policy if exists "finance members read payment events" on public.payment_events;
create policy "finance members read payment events" on public.payment_events for select to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id=payment_events.company_id and m.user_id=(select auth.uid())
    and m.status='active' and m.role in ('owner','admin','finance','support','sales')
));

create or replace function public.process_payment_webhook(
  p_provider text,
  p_provider_payment_id text,
  p_event_id text,
  p_order_reference text,
  p_amount numeric,
  p_currency text,
  p_event_status text,
  p_payload_hash text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_order public.subscription_orders%rowtype;
  v_payment public.payments%rowtype;
  v_existing_event public.payment_events%rowtype;
  v_provider text:=lower(trim(coalesce(p_provider,'')));
  v_payment_id text:=trim(coalesce(p_provider_payment_id,''));
  v_event_id text:=trim(coalesce(p_event_id,''));
  v_event_status text:=lower(trim(coalesce(p_event_status,'')));
  v_target_status text;
  v_was_paid boolean:=false;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception 'service_role_required' using errcode='42501';
  end if;
  if v_provider !~ '^[a-z0-9_-]{2,40}$' or length(v_payment_id) not between 1 and 200
    or length(v_event_id) not between 1 and 200
    or p_order_reference is null or length(trim(p_order_reference)) not between 1 and 40
    or p_amount is null or p_amount<0 or upper(coalesce(p_currency,'')) !~ '^[A-Z]{3}$'
    or p_payload_hash is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_payment_event' using errcode='22023';
  end if;

  if v_event_status in ('paid','succeeded','success','completed') then v_target_status:='succeeded';
  elsif v_event_status in ('failed','declined','error') then v_target_status:='failed';
  elsif v_event_status in ('pending','processing','created') then v_target_status:='pending';
  elsif v_event_status in ('cancelled','canceled') then v_target_status:='cancelled';
  else raise exception 'unsupported_payment_status' using errcode='22023';
  end if;

  select so.* into v_order from public.subscription_orders so
  where so.public_reference=upper(trim(p_order_reference)) for update;
  if v_order.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;
  if p_amount<>v_order.amount or upper(p_currency)<>v_order.currency then
    raise exception 'payment_amount_or_currency_mismatch' using errcode='22023';
  end if;

  select pe.* into v_existing_event from public.payment_events pe
  where pe.provider=v_provider and pe.provider_event_id=v_event_id;
  if v_existing_event.id is not null then
    if v_existing_event.payload_hash<>p_payload_hash then
      raise exception 'event_id_payload_conflict' using errcode='23505';
    end if;
    return jsonb_build_object('accepted',true,'duplicate',true,'payment_id',v_existing_event.payment_id);
  end if;

  select p.* into v_payment from public.payments p
  where p.provider=v_provider and p.provider_payment_id=v_payment_id for update;
  if v_payment.id is not null and v_payment.order_id<>v_order.id then
    raise exception 'provider_payment_already_linked' using errcode='23505';
  end if;

  if v_payment.id is null then
    insert into public.payments(company_id,order_id,provider,provider_payment_id,idempotency_key,amount,currency,status)
    values(v_order.company_id,v_order.id,v_provider,v_payment_id,'webhook:'||v_provider||':'||v_payment_id,p_amount,upper(p_currency),'pending')
    returning * into v_payment;
  end if;

  v_was_paid := v_order.status='paid' and v_order.paid_at is not null;
  if v_target_status='succeeded' and v_was_paid and v_payment.status<>'succeeded' then
    update public.payments set status='review_required',updated_at=now() where id=v_payment.id returning * into v_payment;
    insert into public.audit_logs(company_id,actor_user_id,event,metadata)
    values(v_order.company_id,null,'payment.duplicate_charge_review',
      jsonb_build_object('order_id',v_order.id,'payment_id',v_payment.id,'provider',v_provider,'provider_payment_id',v_payment_id,'reference',v_order.public_reference));
  elsif v_payment.status<>'succeeded' then
    update public.payments set status=v_target_status,
      confirmed_at=case when v_target_status='succeeded' then coalesce(confirmed_at,now()) else confirmed_at end,
      updated_at=now()
    where id=v_payment.id returning * into v_payment;
  end if;

  insert into public.payment_events(company_id,payment_id,provider,provider_event_id,event_type,payload_hash)
  values(v_order.company_id,v_payment.id,v_provider,v_event_id,v_event_status,p_payload_hash);

  if v_target_status='succeeded' and not v_was_paid and v_payment.status='succeeded' then
    update public.subscription_orders set status='paid',paid_at=coalesce(paid_at,now()),updated_at=now()
    where id=v_order.id;
    insert into public.audit_logs(company_id,actor_user_id,event,metadata)
    values(v_order.company_id,null,'payment.confirmed',
      jsonb_build_object('order_id',v_order.id,'payment_id',v_payment.id,'provider',v_provider,'provider_payment_id',v_payment_id,'reference',v_order.public_reference,'amount',v_order.amount,'currency',v_order.currency));
  end if;

  return jsonb_build_object('accepted',true,'duplicate',false,'payment_id',v_payment.id,'payment_status',v_payment.status,'order_paid',v_order.status='paid' or (v_target_status='succeeded' and v_payment.status='succeeded'));
end;
$$;

revoke all on function public.process_payment_webhook(text,text,text,text,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.process_payment_webhook(text,text,text,text,numeric,text,text,text) to service_role;
