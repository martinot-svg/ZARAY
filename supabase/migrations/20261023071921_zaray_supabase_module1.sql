-- Reconstructed baseline for ZARAY module 1 from the live Supabase schema.
-- This file captures the foundational tenant tables. The owner_user_id column and
-- insert/update mutation policies are introduced by the following migration.
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check (char_length(trim(legal_name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  status text not null default 'trial' check (status in ('trial','active','grace','suspended','closed')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '31 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('owner','admin','site_manager','support','technician','sales','finance')),
  status text not null default 'active' check (status in ('invited','active','suspended')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  status text not null default 'planned' check (status in ('planned','active','suspended','archived')),
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_company_members_user on public.company_members(user_id);
create index if not exists idx_sites_company on public.sites(company_id);
create index if not exists idx_audit_company_date on public.audit_logs(company_id, created_at desc);

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.sites enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.companies, public.company_members, public.sites, public.audit_logs from public, anon, authenticated;
grant select on public.companies, public.company_members, public.sites to authenticated;

drop policy if exists "members can read their companies" on public.companies;
create policy "members can read their companies" on public.companies
for select to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = companies.id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
));

drop policy if exists "users can read their own memberships" on public.company_members;
create policy "users can read their own memberships" on public.company_members
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "members can read company sites" on public.sites;
create policy "members can read company sites" on public.sites
for select to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = sites.company_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
));
