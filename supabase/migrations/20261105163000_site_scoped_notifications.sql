-- Site-scoped events, one durable event per audience and source.
-- Client and administrative read states are per authenticated user, not global.
create table if not exists public.site_notifications (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade,
 customer_id uuid references public.customers(id) on delete set null,
 audience text not null check (audience in ('site','client')),
 event_type text not null check (event_type in ('subscription_created','payment_proof','payment_confirmed','network_activated')),
 event_key text not null check (length(event_key) between 3 and 160),
 priority text not null default 'info' check (priority in ('info','important','critical')),
 title text not null check (length(title) between 1 and 150),
 message text not null check (length(message)<=500),
 created_at timestamptz not null default now(),
 unique (company_id,site_id,audience,event_key),
 constraint client_notification_owner check (audience <> 'client' or customer_id is not null)
);
create index if not exists idx_site_notifications_site
 on public.site_notifications(company_id,site_id,created_at desc);
create index if not exists idx_site_notifications_customer
 on public.site_notifications(customer_id,site_id,created_at desc)
 where audience='client';
alter table public.site_notifications enable row level security;
revoke all on public.site_notifications from public,anon,authenticated;
grant select,insert,update,delete on public.site_notifications to service_role;

create table if not exists public.site_notification_reads (
 notification_id uuid not null references public.site_notifications(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 read_at timestamptz not null default now(),
 primary key (notification_id,user_id)
);
create index if not exists idx_site_notification_reads_user
 on public.site_notification_reads(user_id,read_at desc);
alter table public.site_notification_reads enable row level security;
revoke all on public.site_notification_reads from public,anon,authenticated;
grant select,insert,update,delete on public.site_notification_reads to service_role;

-- Only database triggers enqueue; never expose a privileged public callable.
create or replace function public.enqueue_residential_notifications()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
 v_site uuid;
 v_customer uuid;
 v_ref text;
begin
 if tg_table_name='subscription_orders' then
  v_site:=new.site_id; v_customer:=new.customer_id;
  if v_site is null or not exists(select 1 from public.sites s
     where s.id=v_site and s.company_id=new.company_id) then return new; end if;
  if tg_op='INSERT' then
   insert into public.site_notifications(company_id,site_id,customer_id,audience,event_type,event_key,priority,title,message)
   values(new.company_id,v_site,v_customer,'site','subscription_created','order-created:'||new.id::text,
    'info','Nouvelle souscription','Une nouvelle demande résidentielle a été enregistrée.')
   on conflict do nothing;
   if v_customer is not null then
    insert into public.site_notifications(company_id,site_id,customer_id,audience,event_type,event_key,title,message)
    values(new.company_id,v_site,v_customer,'client','subscription_created','order-created:'||new.id::text,
     'Inscription enregistrée','Votre demande d’abonnement a été reçue par votre fournisseur.')
    on conflict do nothing;
   end if;
  elsif tg_op='UPDATE' and new.status='paid' and old.status is distinct from new.status then
   insert into public.site_notifications(company_id,site_id,customer_id,audience,event_type,event_key,priority,title,message)
   values(new.company_id,v_site,v_customer,'site','payment_confirmed','order-paid:'||new.id::text,
    'info','Paiement validé','Un paiement d’abonnement a été confirmé.')
   on conflict do nothing;
   if v_customer is not null then
    insert into public.site_notifications(company_id,site_id,customer_id,audience,event_type,event_key,title,message)
    values(new.company_id,v_site,v_customer,'client','payment_confirmed','order-paid:'||new.id::text,
     'Paiement confirmé','Votre fournisseur a confirmé votre paiement.')
    on conflict do nothing;
   end if;
  end if;
 elsif tg_table_name='manual_payment_submissions' and tg_op='INSERT' then
  select so.site_id,so.customer_id into v_site,v_customer
   from public.subscription_orders so
   where so.id=new.order_id and so.company_id=new.company_id;
  if v_site is null then return new; end if;
  insert into public.site_notifications(company_id,site_id,customer_id,audience,event_type,event_key,priority,title,message)
  values(new.company_id,v_site,v_customer,'site','payment_proof','proof:'||new.id::text,
   'important','Justificatif à vérifier','Un client a transmis un justificatif de paiement.')
  on conflict do nothing;
  if v_customer is not null then
   insert into public.site_notifications(company_id,site_id,customer_id,audience,event_type,event_key,title,message)
   values(new.company_id,v_site,v_customer,'client','payment_proof','proof:'||new.id::text,
    'Justificatif reçu','Votre justificatif a été transmis pour vérification.')
   on conflict do nothing;
  end if;
 elsif tg_table_name='residential_subscriptions' and tg_op='UPDATE'
    and new.activated_cycles > old.activated_cycles and new.site_id is not null then
  insert into public.site_notifications(company_id,site_id,customer_id,audience,event_type,event_key,priority,title,message)
  values(new.company_id,new.site_id,new.customer_id,'site','network_activated',
   'activation:'||new.id::text||':'||new.activated_cycles::text,'info',
   'Abonnement activé','Une période de connexion résidentielle a été confirmée.')
  on conflict do nothing;
  insert into public.site_notifications(company_id,site_id,customer_id,audience,event_type,event_key,title,message)
  values(new.company_id,new.site_id,new.customer_id,'client','network_activated',
   'activation:'||new.id::text||':'||new.activated_cycles::text,
   'Connexion activée','Votre période Internet a été activée par votre fournisseur.')
  on conflict do nothing;
 end if;
 return new;
end;
$fn$;
revoke all on function public.enqueue_residential_notifications() from public,anon,authenticated;

drop trigger if exists site_notify_order_create on public.subscription_orders;
create trigger site_notify_order_create after insert on public.subscription_orders
 for each row execute function public.enqueue_residential_notifications();
drop trigger if exists site_notify_order_paid on public.subscription_orders;
create trigger site_notify_order_paid after update of status on public.subscription_orders
 for each row execute function public.enqueue_residential_notifications();
drop trigger if exists site_notify_payment_proof on public.manual_payment_submissions;
create trigger site_notify_payment_proof after insert on public.manual_payment_submissions
 for each row execute function public.enqueue_residential_notifications();
drop trigger if exists site_notify_network_active on public.residential_subscriptions;
create trigger site_notify_network_active after update of activated_cycles on public.residential_subscriptions
 for each row execute function public.enqueue_residential_notifications();
