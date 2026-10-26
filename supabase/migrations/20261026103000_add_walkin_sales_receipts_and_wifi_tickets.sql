create table if not exists public.walkin_sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  offer_id uuid not null references public.offers(id) on delete restrict,
  receipt_number text not null,
  ticket_code_hash text not null,
  ticket_code_prefix text not null,
  customer_name text not null,
  customer_phone text,
  offer_name text not null,
  amount numeric not null check (amount >= 0),
  currency text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  validity_days integer not null check (validity_days > 0),
  max_devices integer not null check (max_devices > 0),
  payment_method text not null check (payment_method in ('cash','mobile_money','bank_transfer','card','other')),
  ticket_status text not null default 'issued' check (ticket_status in ('issued','redeemed','expired','revoked')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(company_id, receipt_number),
  unique(ticket_code_hash)
);

create index if not exists walkin_sales_company_created_idx on public.walkin_sales(company_id, created_at desc);
create index if not exists walkin_sales_site_created_idx on public.walkin_sales(site_id, created_at desc);

alter table public.walkin_sales enable row level security;

create policy "active company members read walk-in sales" on public.walkin_sales
  for select to authenticated
  using (exists (select 1 from public.company_members m where m.company_id=walkin_sales.company_id and m.user_id=(select auth.uid()) and m.status='active'));

create policy "authorized sales roles create walk-in sales" on public.walkin_sales
  for insert to authenticated
  with check (
    created_by=(select auth.uid()) and
    exists (select 1 from public.company_members m where m.company_id=walkin_sales.company_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','site_manager','support','sales'))
  );

create or replace function public.create_walkin_sale(
  p_company_id uuid,
  p_site_id uuid,
  p_offer_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_payment_method text,
  p_code_hash text,
  p_code_prefix text,
  p_receipt_number text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_sale public.walkin_sales%rowtype;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from auth.users u where u.id=v_user_id and u.email_confirmed_at is not null) then raise exception 'verified_email_required' using errcode='42501'; end if;
  if not exists(select 1 from public.company_members m where m.company_id=p_company_id and m.user_id=v_user_id and m.status='active' and m.role in ('owner','admin','site_manager','support','sales')) then raise exception 'role_not_authorized' using errcode='42501'; end if;
  if p_customer_name is null or btrim(p_customer_name)='' then raise exception 'customer_name_required' using errcode='22023'; end if;
  if p_payment_method not in ('cash','mobile_money','bank_transfer','card','other') then raise exception 'invalid_payment_method' using errcode='22023'; end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_ticket_code' using errcode='22023'; end if;
  if p_code_prefix is null or length(p_code_prefix) not between 4 and 16 then raise exception 'invalid_ticket_prefix' using errcode='22023'; end if;
  if p_receipt_number is null or length(p_receipt_number) not between 6 and 40 then raise exception 'invalid_receipt_number' using errcode='22023'; end if;

  select * into v_offer from public.offers where id=p_offer_id and company_id=p_company_id and status='active';
  if v_offer.id is null then raise exception 'offer_not_found' using errcode='P0002'; end if;
  if p_site_id is not null and not exists(select 1 from public.sites s where s.id=p_site_id and s.company_id=p_company_id) then raise exception 'site_not_found' using errcode='P0002'; end if;

  insert into public.walkin_sales(company_id,site_id,offer_id,receipt_number,ticket_code_hash,ticket_code_prefix,customer_name,customer_phone,offer_name,amount,currency,duration_minutes,validity_days,max_devices,payment_method,ticket_status,valid_from,valid_until,created_by)
  values(p_company_id,p_site_id,p_offer_id,p_receipt_number,p_code_hash,upper(p_code_prefix),btrim(p_customer_name),nullif(btrim(p_customer_phone),''),v_offer.name,v_offer.price_amount,v_offer.currency,v_offer.duration_minutes,v_offer.validity_days,v_offer.max_devices,p_payment_method,'issued',now(),now()+make_interval(days=>v_offer.validity_days),v_user_id)
  returning * into v_sale;

  insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(v_sale.company_id,v_user_id,'walkin_sale.created',jsonb_build_object('sale_id',v_sale.id,'receipt_number',v_sale.receipt_number,'offer_id',v_sale.offer_id,'payment_method',v_sale.payment_method,'amount',v_sale.amount,'ticket_prefix',v_sale.ticket_code_prefix));

  return jsonb_build_object('id',v_sale.id,'receipt_number',v_sale.receipt_number,'ticket_code_prefix',v_sale.ticket_code_prefix,'customer_name',v_sale.customer_name,'customer_phone',v_sale.customer_phone,'offer_name',v_sale.offer_name,'amount',v_sale.amount,'currency',v_sale.currency,'payment_method',v_sale.payment_method,'duration_minutes',v_sale.duration_minutes,'validity_days',v_sale.validity_days,'max_devices',v_sale.max_devices,'valid_from',v_sale.valid_from,'valid_until',v_sale.valid_until,'created_at',v_sale.created_at);
exception when unique_violation then
  raise exception 'duplicate_walkin_sale' using errcode='23505';
end;
$$;

grant execute on function public.create_walkin_sale(uuid,uuid,uuid,text,text,text,text,text,text) to authenticated;
