create table if not exists public.network_routers (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade,
 name text not null check (length(name) between 2 and 120),
 host text not null check(length(host) between 1 and 255),
 routeros_version text, model text, serial_number text,
 connection_mode text not null default 'connector' check(connection_mode in ('connector','private_vpn')),
 status text not null default 'unconfigured' check(status in ('unconfigured','pending','online','offline','error')),
 last_seen_at timestamptz, created_at timestamptz not null default now(),
 constraint network_router_site_tenant unique(id,company_id),
 unique(company_id,site_id,name)
);
create table if not exists public.network_observations (
 id uuid primary key default gen_random_uuid(), company_id uuid not null,
 router_id uuid not null, observed_kind text not null check(observed_kind in ('hotspot','pppoe','dhcp','wifi','neighbor','radius')),
 identity_key text not null check(length(identity_key) between 1 and 255),
 ip_address inet,mac_address macaddr,client_label text,active boolean not null default false,
 observed_at timestamptz not null default now(),
 foreign key(router_id,company_id) references public.network_routers(id,company_id) on delete cascade,
 unique(router_id,observed_kind,identity_key)
);
create index if not exists network_routers_company_site_idx on public.network_routers(company_id,site_id);
create index if not exists network_observations_router_idx on public.network_observations(router_id,observed_at desc);
create or replace function public.network_router_tenant_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from public.sites s where s.id=new.site_id and s.company_id=new.company_id)
 then raise exception 'Site does not belong to company'; end if;
 return new;
end $$;
drop trigger if exists network_router_tenant_guard_trigger on public.network_routers;
create trigger network_router_tenant_guard_trigger before insert or update on public.network_routers for each row execute function public.network_router_tenant_guard();
alter table public.network_routers enable row level security;
alter table public.network_observations enable row level security;
drop policy if exists network_router_select on public.network_routers;
create policy network_router_select on public.network_routers for select to authenticated using
 (exists(select 1 from public.company_members m where m.company_id=network_routers.company_id and m.user_id=(select auth.uid()) and m.status='active'));
drop policy if exists network_router_insert on public.network_routers;
create policy network_router_insert on public.network_routers for insert to authenticated with check
 (exists(select 1 from public.company_members m where m.company_id=network_routers.company_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','administrator')));
drop policy if exists network_observations_select on public.network_observations;
create policy network_observations_select on public.network_observations for select to authenticated using
 (exists(select 1 from public.company_members m where m.company_id=network_observations.company_id and m.user_id=(select auth.uid()) and m.status='active'));
grant select,insert on public.network_routers to authenticated;
grant select on public.network_observations to authenticated;
revoke all on public.network_routers,public.network_observations from anon;