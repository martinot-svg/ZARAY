-- Site-scoped notification ledger for ZARAY V1.1.
-- This is an in-app event history; it does not claim that e-mail or push was delivered.
create table if not exists public.site_notifications (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade,
 customer_id uuid references public.customers(id) on delete set null,
 source_order_id uuid references public.subscription_orders(id) on delete set null,
 kind text not null check (kind in ('subscription_created','payment_confirmed')),
 customer_title text not null,
 site_title text not null,
 details text not null default '',
 created_at timestamptz not null default now(),
 unique (source_order_id,kind)
);
create index if not exists site_notifications_company_site_idx
 on public.site_notifications(company_id,site_id,created_at desc);
create index if not exists site_notifications_customer_idx
 on public.site_notifications(customer_id,site_id,created_at desc);
alter table public.site_notifications enable row level security;
revoke all on public.site_notifications from public,anon,authenticated;
grant select,insert,update,delete on public.site_notifications to service_role;

create table if not exists public.site_notification_reads (
 notification_id uuid not null references public.site_notifications(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 read_at timestamptz not null default now(),
 primary key (notification_id,user_id)
);
create index if not exists site_notification_reads_user_idx
 on public.site_notification_reads(user_id,read_at desc);
alter table public.site_notification_reads enable row level security;
revoke all on public.site_notification_reads from public,anon,authenticated;
grant select,insert,update,delete on public.site_notification_reads to service_role;

create or replace function public.record_site_subscription_notification()
returns trigger
language plpgsql security definer set search_path=''
as $fn$
begin
 if new.site_id is null or new.customer_id is null then return new; end if;
 if tg_op='INSERT' then
  insert into public.site_notifications
   (company_id,site_id,customer_id,source_order_id,kind,customer_title,site_title,details)
  values (new.company_id,new.site_id,new.customer_id,new.id,
   'subscription_created','Inscription enregistrée','Nouvelle inscription résidentielle',
   'Forfait : ' || coalesce(new.offer_name,'Internet'))
  on conflict (source_order_id,kind) do nothing;
 elsif new.status='paid' and old.status is distinct from new.status then
  insert into public.site_notifications
   (company_id,site_id,customer_id,source_order_id,kind,customer_title,site_title,details)
  values (new.company_id,new.site_id,new.customer_id,new.id,
   'payment_confirmed','Paiement confirmé','Paiement résidentiel confirmé',
   'Forfait : ' || coalesce(new.offer_name,'Internet'))
  on conflict (source_order_id,kind) do nothing;
 end if;
 return new;
end;
$fn$;
revoke all on function public.record_site_subscription_notification()
 from public,anon,authenticated;
drop trigger if exists subscription_order_site_notification on public.subscription_orders;
create trigger subscription_order_site_notification
 after insert or update of status on public.subscription_orders
 for each row execute function public.record_site_subscription_notification();
