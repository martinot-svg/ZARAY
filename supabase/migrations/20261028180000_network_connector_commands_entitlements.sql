
-- Module 10: private connector credentials, operator commands, entitlement engine.
alter table public.network_routers add column if not exists control_enabled boolean not null default false;
create table if not exists public.network_connector_credentials (
  router_id uuid primary key references public.network_routers(id) on delete cascade,
  pairing_hash text, pairing_expires_at timestamptz,
  secret_hash text, paired_at timestamptz, revoked_at timestamptz,
  last_poll_at timestamptz, updated_at timestamptz not null default now(),
  constraint connector_pair_hash_format check(pairing_hash is null or pairing_hash ~ '^[0-9a-f]{64}$'),
  constraint connector_secret_hash_format check(secret_hash is null or secret_hash ~ '^[0-9a-f]{64}$')
);
create table if not exists public.network_company_policies (
 company_id uuid primary key references public.companies(id) on delete cascade,
 grace_hours integer not null default 72 check(grace_hours between 0 and 2160),
 extension_max_hours integer not null default 24 check(extension_max_hours between 1 and 87600),
 updated_at timestamptz not null default now()
);
create table if not exists public.network_access_accounts (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 router_id uuid not null,
 order_id uuid unique references public.subscription_orders(id) on delete set null,
 username text not null check(length(username) between 1 and 128),
 protocol text not null check(protocol in ('hotspot','pppoe')),
 expires_at timestamptz,
 grace_until timestamptz,
 extension_until timestamptz,
 administrative_hold boolean not null default false,
 desired_state text not null default 'suspended' check(desired_state in ('active','suspended')),
 applied_state text not null default 'unknown' check(applied_state in ('unknown','active','suspended')),
 last_sync_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(router_id,company_id) references public.network_routers(id,company_id) on delete cascade,
 unique(router_id,protocol,username)
);
create table if not exists public.network_commands (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 router_id uuid not null,
 account_id uuid references public.network_access_accounts(id) on delete set null,
 action text not null check(action in ('disconnect_hotspot','disconnect_ppp','suspend_account','resume_account')),
 protocol text not null check(protocol in ('hotspot','pppoe')),
 username text not null check(length(username) between 1 and 128),
 session_id text,
 status text not null default 'queued' check(status in ('queued','dispatched','success','failed','cancelled')),
 created_by uuid references auth.users(id),
 reason text not null default '' check(length(reason)<=600),
 outcome text check(length(outcome)<=600),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '24 hours'),
 dispatched_at timestamptz, completed_at timestamptz,
 foreign key(router_id,company_id) references public.network_routers(id,company_id) on delete cascade
);
create index if not exists network_commands_pending on public.network_commands(router_id,status,created_at);
create unique index if not exists network_accounts_active_pending on public.network_commands(account_id,action) where account_id is not null and status in ('queued','dispatched');
create table if not exists public.network_access_events (
 id bigint generated always as identity primary key,
 company_id uuid not null references public.companies(id) on delete cascade,
 account_id uuid references public.network_access_accounts(id) on delete set null,
 actor_user_id uuid references auth.users(id),
 event_type text not null,
 reason text,
 created_at timestamptz not null default now()
);
-- Service-role only writes. The browser receives only tenant-scoped read access.
do $$ declare t text; begin
 foreach t in array array['network_connector_credentials','network_access_accounts','network_commands','network_company_policies','network_access_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
grant select on public.network_access_accounts,public.network_commands,public.network_company_policies,public.network_access_events to authenticated;
create policy network_accounts_read on public.network_access_accounts for select to authenticated
 using(exists(select 1 from public.company_members m where m.company_id=network_access_accounts.company_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy network_commands_read on public.network_commands for select to authenticated
 using(exists(select 1 from public.company_members m where m.company_id=network_commands.company_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy network_policies_read on public.network_company_policies for select to authenticated
 using(exists(select 1 from public.company_members m where m.company_id=network_company_policies.company_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy network_events_read on public.network_access_events for select to authenticated
 using(exists(select 1 from public.company_members m where m.company_id=network_access_events.company_id and m.user_id=(select auth.uid()) and m.status='active'));
create schema if not exists network_internal;
revoke all on schema network_internal from public,anon,authenticated;
create or replace function network_internal.reconcile_one(p_account_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.network_access_accounts%rowtype; r public.network_routers%rowtype; v_desired text; v_action text;
begin
 select * into a from public.network_access_accounts where id=p_account_id for update;
 if not found then return; end if;
 select * into r from public.network_routers where id=a.router_id;
 v_desired:=case when not a.administrative_hold and a.expires_at is not null
  and (now()<=a.expires_at or now()<=coalesce(a.grace_until,'-infinity'::timestamptz)
   or now()<=coalesce(a.extension_until,'-infinity'::timestamptz))
  then 'active' else 'suspended' end;
 update public.network_access_accounts set desired_state=v_desired where id=a.id;
 v_action:=case when v_desired='active' then 'resume_account' else 'suspend_account' end;
 update public.network_commands set status='cancelled',completed_at=now(),outcome='Etat souhaité modifié'
  where account_id=a.id and status='queued' and action<>v_action;
 if r.control_enabled and a.applied_state is distinct from v_desired and not exists
  (select 1 from public.network_commands where account_id=a.id and action=v_action and status in ('queued','dispatched'))
 then
  insert into public.network_commands(company_id,router_id,account_id,action,protocol,username,reason)
  values(a.company_id,a.router_id,a.id,v_action,a.protocol,a.username,'Synchronisation des droits d''accès');
 end if;
end $$;
create or replace function network_internal.reconcile_all() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare a record;
begin
 for a in select id from public.network_access_accounts loop perform network_internal.reconcile_one(a.id); end loop;
 update public.network_commands set status='failed',completed_at=now(),outcome='Commande expirée'
  where status in ('queued','dispatched') and expires_at<now();
end $$;
revoke all on function network_internal.reconcile_one(uuid) from public,anon,authenticated;
revoke all on function network_internal.reconcile_all() from public,anon,authenticated;
create or replace function network_internal.network_payment_approved() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare a record; v_grace integer;
begin
 if new.status='paid' and (tg_op='INSERT' or old.status is distinct from new.status) then
  for a in select id,company_id,expires_at from public.network_access_accounts where order_id=new.id loop
   select grace_hours into v_grace from public.network_company_policies where company_id=a.company_id;
   v_grace:=coalesce(v_grace,72);
   update public.network_access_accounts set
    expires_at=greatest(now(),coalesce(a.expires_at,now()))+make_interval(days=>greatest(new.validity_days,1)),
    grace_until=greatest(now(),coalesce(a.expires_at,now()))+make_interval(days=>greatest(new.validity_days,1),hours=>v_grace)
    where id=a.id;
   perform network_internal.reconcile_one(a.id);
  end loop;
 end if;
 return new;
end $$;
drop trigger if exists network_payment_approved_trigger on public.subscription_orders;
create trigger network_payment_approved_trigger after insert or update of status on public.subscription_orders
 for each row execute function network_internal.network_payment_approved();
revoke all on function network_internal.network_payment_approved() from public,anon,authenticated;
