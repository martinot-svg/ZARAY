-- ZARAY: CRM customers are populated from subscription enrollment, not staff entry.
-- Registration here means the public enterprise subscription portal (not /inscription,
-- which creates SaaS administrators). An order remains unpaid until proof verification.
alter table public.customers
 add column if not exists enrollment_source text not null default 'historical'
 check (enrollment_source in ('historical','public_subscription'));
alter table public.subscription_orders
 add column if not exists customer_id uuid references public.customers(id) on delete restrict;
create index if not exists idx_subscription_orders_customer
 on public.subscription_orders(company_id,customer_id,created_at desc);
-- Each customer is unique in the context of their company; emails are normalized.
create unique index if not exists idx_customers_company_email_enrollment
 on public.customers(company_id,email) where email is not null;

create or replace function public.link_customer_on_subscription_signup()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare
  v_customer uuid;
  v_email text:=pg_catalog.lower(pg_catalog.btrim(new.customer_email));
begin
  if v_email is null or v_email='' then
    raise exception 'registration_email_required' using errcode='22023';
  end if;
  -- A single email may subscribe repeatedly without creating repeated CRM records.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.company_id::text||':'||v_email,0));
  select c.id into v_customer
    from public.customers c
    where c.company_id=new.company_id and c.email=v_email
    limit 1;
  if v_customer is null then
    insert into public.customers(
      company_id,site_id,full_name,email,phone,notes,status,created_by,enrollment_source
    ) values (
      new.company_id,new.site_id,new.customer_name,v_email,
      new.customer_phone,'','active',null,'public_subscription'
    )
    on conflict (company_id,email) where email is not null do nothing
    returning id into v_customer;
    if v_customer is null then
      select c.id into v_customer from public.customers c
      where c.company_id=new.company_id and c.email=v_email limit 1;
    end if;
  end if;
  if v_customer is null then raise exception 'customer_link_failed'; end if;
  new.customer_id:=v_customer;
  return new;
end;
$$;
drop trigger if exists subscription_order_enroll_customer on public.subscription_orders;
create trigger subscription_order_enroll_customer before insert on public.subscription_orders
for each row execute function public.link_customer_on_subscription_signup();

-- Legacy orders, if any, remain visible and are associated without resetting
-- their paid status or creating a new subscription.
update public.subscription_orders so set customer_id=c.id
from public.customers c
where so.customer_id is null and so.company_id=c.company_id
 and so.customer_email=c.email;

-- Staff may correct existing CRM profiles with their existing RLS rights;
-- they may not create customers manually.
revoke insert on public.customers from authenticated;
drop policy if exists "authorized roles create company customers" on public.customers;
revoke all on function public.link_customer_on_subscription_signup()
 from public,anon,authenticated;
