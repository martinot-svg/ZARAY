-- V1.1: opt-in resident e-mails, expiry reminders and a durable delivery queue.
-- Mail and push are never sent by database triggers; they only record events/jobs.
alter table public.site_notifications
  drop constraint if exists site_notifications_kind_check;
alter table public.site_notifications
  add constraint site_notifications_kind_check
  check (kind in ('subscription_created','payment_confirmed','subscription_expiring'));
alter table public.site_notifications
  add column if not exists event_key text unique,
  add column if not exists source_subscription_id uuid
    references public.residential_subscriptions(id) on delete set null;

create table if not exists public.residential_notification_preferences (
 company_id uuid not null references public.companies(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade,
 customer_id uuid not null references public.customers(id) on delete cascade,
 email_enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key (company_id,site_id,customer_id)
);
create or replace function public.guard_residential_notification_preference()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
 if not exists (
  select 1 from public.customers c join public.sites s
    on s.id=new.site_id and s.company_id=new.company_id
  where c.id=new.customer_id and c.company_id=new.company_id
   and c.site_id=new.site_id and c.status='active'
 ) then raise exception 'invalid_notification_customer' using errcode='23503'; end if;
 new.updated_at=now();
 return new;
end;
$$;
drop trigger if exists guard_residential_notification_preference
 on public.residential_notification_preferences;
create trigger guard_residential_notification_preference
 before insert or update on public.residential_notification_preferences
 for each row execute function public.guard_residential_notification_preference();

create table if not exists public.residential_notification_email_jobs (
 notification_id uuid primary key references public.site_notifications(id) on delete cascade,
 company_id uuid not null references public.companies(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade,
 customer_id uuid not null references public.customers(id) on delete cascade,
 status text not null default 'pending'
  check (status in ('pending','sending','sent','failed','cancelled')),
 attempts integer not null default 0 check (attempts between 0 and 10),
 next_attempt_at timestamptz not null default now(),
 lease_until timestamptz,
 provider_id text,
 last_error text,
 sent_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists residential_mail_jobs_due_idx
 on public.residential_notification_email_jobs(next_attempt_at,created_at)
 where status in ('pending','sending');

create or replace function public.queue_site_residential_email()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.customer_id is not null
  and exists (
   select 1 from public.residential_notification_preferences p
   where p.company_id=new.company_id and p.site_id=new.site_id
     and p.customer_id=new.customer_id and p.email_enabled=true
  )
  and exists (
   select 1 from public.site_custom_domains d
   where d.company_id=new.company_id and d.site_id=new.site_id
    and d.status='active' and d.verified_at is not null
  ) then
  insert into public.residential_notification_email_jobs
   (notification_id,company_id,site_id,customer_id)
  values(new.id,new.company_id,new.site_id,new.customer_id)
  on conflict(notification_id) do nothing;
 end if;
 return new;
end;
$$;
drop trigger if exists site_notification_email_enqueued on public.site_notifications;
create trigger site_notification_email_enqueued after insert on public.site_notifications
 for each row execute function public.queue_site_residential_email();

-- Called once/day from a secret-protected job. Date arithmetic is site-local to Madagascar.
create or replace function public.create_residential_expiry_reminders()
returns integer language plpgsql security invoker set search_path=''
as $$
declare added_count integer;
begin
 with periods as (
  select r.id,r.company_id,r.site_id,r.customer_id,r.offer_name,r.expires_at,
   ((r.expires_at at time zone 'Indian/Antananarivo')::date
    -(now() at time zone 'Indian/Antananarivo')::date) as days_left
  from public.residential_subscriptions r
  join public.customers c on c.id=r.customer_id
    and c.company_id=r.company_id and c.site_id=r.site_id and c.status='active'
  join public.sites s on s.id=r.site_id and s.company_id=r.company_id and s.status='active'
  join public.companies o on o.id=r.company_id and o.status in ('active','trial')
  where r.paid_cycles>0 and r.activated_cycles>0 and r.expires_at is not null
 ),
 inserted as (
  insert into public.site_notifications
   (company_id,site_id,customer_id,source_subscription_id,event_key,
    kind,customer_title,site_title,details)
  select p.company_id,p.site_id,p.customer_id,p.id,
    'expiry:'||p.id::text||':'||p.expires_at::text||':'||p.days_left::text,
    'subscription_expiring','Votre forfait expire bientôt',
    'Abonnement résidentiel à échéance',
    'Votre forfait '||coalesce(p.offer_name,'Internet')||
      ' arrive à échéance dans '||p.days_left::text||' jour(s).'
  from periods p where p.days_left in (7,3,1)
  on conflict (event_key) do nothing
  returning 1
 )
 select count(*) into added_count from inserted;
 return added_count;
end;
$$;

-- Transactional claim. Two concurrent cron jobs cannot take the same email.
create or replace function public.claim_residential_email_jobs(p_limit integer default 20)
returns table (
 notification_id uuid,company_id uuid,site_id uuid,customer_id uuid,
 kind text,title text,details text
)
language sql volatile security invoker set search_path=''
as $$
 with picked as (
  select j.notification_id from public.residential_notification_email_jobs j
  where (j.status='pending' or
      (j.status='sending' and j.lease_until<now()))
   and j.attempts<3 and j.next_attempt_at<=now()
  order by j.next_attempt_at,j.created_at
  for update skip locked limit least(greatest(coalesce(p_limit,20),1),30)
 ), claimed as (
  update public.residential_notification_email_jobs j
  set status='sending',attempts=j.attempts+1,lease_until=now()+interval '10 minutes'
  from picked p where j.notification_id=p.notification_id
  returning j.notification_id,j.company_id,j.site_id,j.customer_id
 )
 select j.notification_id,j.company_id,j.site_id,j.customer_id,
        n.kind,n.customer_title as title,n.details
 from claimed j join public.site_notifications n on n.id=j.notification_id
$$;
revoke all on public.residential_notification_preferences from public,anon,authenticated;
revoke all on public.residential_notification_email_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.residential_notification_preferences to service_role;
grant select,insert,update,delete on public.residential_notification_email_jobs to service_role;
alter table public.residential_notification_preferences enable row level security;
alter table public.residential_notification_email_jobs enable row level security;
revoke all on function public.guard_residential_notification_preference()
 from public,anon,authenticated;
revoke all on function public.queue_site_residential_email()
 from public,anon,authenticated;
revoke all on function public.create_residential_expiry_reminders()
 from public,anon,authenticated;
revoke all on function public.claim_residential_email_jobs(integer)
 from public,anon,authenticated;
grant execute on function public.create_residential_expiry_reminders() to service_role;
grant execute on function public.claim_residential_email_jobs(integer) to service_role;
