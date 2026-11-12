-- Recovered from original GitHub commit a0c16d97ebc510b49cc4f246ae664cf8e7d3742c.
-- ZARAY modules 5-6: tenant-scoped CRM customers and internet offers.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  site_id uuid references public.sites(id) on delete restrict,
  full_name text not null check (char_length(trim(full_name)) between 2 and 160),
  email text check (email is null or (char_length(email)<=254 and email=lower(trim(email)))),
  phone text check (phone is null or char_length(trim(phone)) between 5 and 32),
  notes text not null default '' check (char_length(notes)<=2000),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_company_created on public.customers(company_id,created_at desc);
create index if not exists idx_customers_company_site on public.customers(company_id,site_id);
create index if not exists idx_customers_company_email on public.customers(company_id,email) where email is not null;

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text not null default '' check (char_length(description)<=1000),
  duration_minutes integer not null check (duration_minutes between 1 and 525600),
  validity_days integer not null default 1 check (validity_days between 1 and 3650),
  price_amount numeric(12,2) not null check (price_amount>=0),
  currency text not null default 'MGA' check (currency ~ '^[A-Z]{3}$'),
  max_devices integer not null default 1 check (max_devices between 1 and 100),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,name)
);
create index if not exists idx_offers_company_status on public.offers(company_id,status,created_at desc);

alter table public.customers enable row level security;
alter table public.offers enable row level security;
revoke all on public.customers,public.offers from public,anon,authenticated;
grant select on public.customers,public.offers to authenticated;
grant insert (company_id,site_id,full_name,email,phone,notes,status,created_by) on public.customers to authenticated;
grant update (site_id,full_name,email,phone,notes,status,updated_at) on public.customers to authenticated;
grant insert (company_id,name,description,duration_minutes,validity_days,price_amount,currency,max_devices,status,created_by) on public.offers to authenticated;
grant update (name,description,duration_minutes,validity_days,price_amount,currency,max_devices,status,updated_at) on public.offers to authenticated;

drop policy if exists "active members read company customers" on public.customers;
create policy "active members read company customers" on public.customers for select to authenticated
using (exists(select 1 from public.company_members m where m.company_id=customers.company_id and m.user_id=(select auth.uid()) and m.status='active'));
drop policy if exists "authorized roles create company customers" on public.customers;
create policy "authorized roles create company customers" on public.customers for insert to authenticated
with check (created_by=(select auth.uid()) and exists(select 1 from public.company_members m where m.company_id=customers.company_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','site_manager','support','sales')));
drop policy if exists "authorized roles update company customers" on public.customers;
create policy "authorized roles update company customers" on public.customers for update to authenticated
using (exists(select 1 from public.company_members m where m.company_id=customers.company_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','site_manager','support','sales')))
with check (exists(select 1 from public.company_members m where m.company_id=customers.company_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','site_manager','support','sales')));

drop policy if exists "active members read company offers" on public.offers;
create policy "active members read company offers" on public.offers for select to authenticated
using (exists(select 1 from public.company_members m where m.company_id=offers.company_id and m.user_id=(select auth.uid()) and m.status='active'));
drop policy if exists "authorized roles create company offers" on public.offers;
create policy "authorized roles create company offers" on public.offers for insert to authenticated
with check (created_by=(select auth.uid()) and exists(select 1 from public.company_members m where m.company_id=offers.company_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','site_manager','sales')));
drop policy if exists "authorized roles update company offers" on public.offers;
create policy "authorized roles update company offers" on public.offers for update to authenticated
using (exists(select 1 from public.company_members m where m.company_id=offers.company_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','site_manager','sales')))
with check (exists(select 1 from public.company_members m where m.company_id=offers.company_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','site_manager','sales')));

create or replace function public.validate_customer_site()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.site_id is not null and not exists(select 1 from public.sites s where s.id=new.site_id and s.company_id=new.company_id) then
    raise exception 'site_must_belong_to_company' using errcode='23514';
  end if;
  new.updated_at:=now();
  return new;
end; $$;
drop trigger if exists customers_validate_site on public.customers;
create trigger customers_validate_site before insert or update on public.customers for each row execute function public.validate_customer_site();

create or replace function public.audit_customer_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(new.company_id,auth.uid(),case when tg_op='INSERT' then 'customer.created' else 'customer.updated' end,
    jsonb_build_object('customer_id',new.id,'status',new.status));
  return new;
end; $$;
drop trigger if exists customers_audit_insert_update on public.customers;
create trigger customers_audit_insert_update after insert or update on public.customers for each row execute function public.audit_customer_mutation();

create or replace function public.audit_offer_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(new.company_id,auth.uid(),case when tg_op='INSERT' then 'offer.created' else 'offer.updated' end,
    jsonb_build_object('offer_id',new.id,'offer_name',new.name,'status',new.status));
  return new;
end; $$;
drop trigger if exists offers_audit_insert_update on public.offers;
create trigger offers_audit_insert_update after insert or update on public.offers for each row execute function public.audit_offer_mutation();

revoke all on function public.validate_customer_site() from public,anon,authenticated;
revoke all on function public.audit_customer_mutation() from public,anon,authenticated;
revoke all on function public.audit_offer_mutation() from public,anon,authenticated;
