-- Zaray module 1: Supabase Auth, multi-tenant schema, RLS and transactional RPCs.
-- No business/demo rows are inserted by this migration.

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
  unique(company_id, user_id)
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  status text not null default 'planned' check (status in ('planned','active','suspended','archived')),
  created_at timestamptz not null default now(),
  unique(company_id, name)
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

drop policy if exists "members can read their companies" on public.companies;
create policy "members can read their companies" on public.companies
  for select to authenticated
  using (exists (
    select 1 from public.company_members m
    where m.company_id = companies.id and m.user_id = (select auth.uid()) and m.status = 'active'
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
    where m.company_id = sites.company_id and m.user_id = (select auth.uid()) and m.status = 'active'
  ));

drop policy if exists "members can read company audit logs" on public.audit_logs;
create policy "members can read company audit logs" on public.audit_logs
  for select to authenticated
  using (company_id is not null and exists (
    select 1 from public.company_members m
    where m.company_id = audit_logs.company_id and m.user_id = (select auth.uid()) and m.status = 'active'
  ));

revoke all on public.companies, public.company_members, public.sites, public.audit_logs from public, anon, authenticated;
grant select on public.companies, public.company_members, public.sites, public.audit_logs to authenticated;

create or replace function public.create_company_for_current_user(p_legal_name text, p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_confirmed_at timestamptz;
  v_company public.companies;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  select u.email_confirmed_at into v_confirmed_at from auth.users u where u.id = v_user_id;
  if v_confirmed_at is null then
    raise exception 'email_not_verified' using errcode = '42501';
  end if;
  if p_legal_name is null or char_length(trim(p_legal_name)) not between 2 and 160
     or p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{2,62}$' then
    raise exception 'invalid_company_input' using errcode = '22023';
  end if;

  insert into public.companies (legal_name, slug)
  values (trim(p_legal_name), lower(trim(p_slug)))
  returning * into v_company;
  insert into public.company_members (company_id, user_id, role, status)
  values (v_company.id, v_user_id, 'owner', 'active');
  insert into public.audit_logs (company_id, actor_user_id, event, metadata)
  values (v_company.id, v_user_id, 'company.created', jsonb_build_object('company_id', v_company.id));

  return jsonb_build_object('id', v_company.id, 'legal_name', v_company.legal_name, 'slug', v_company.slug,
    'status', v_company.status, 'trial_ends_at', v_company.trial_ends_at);
end;
$$;

create or replace function public.create_site_for_current_user(p_company_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_site public.sites;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select m.role into v_role from public.company_members m
  where m.company_id = p_company_id and m.user_id = v_user_id and m.status = 'active' limit 1;
  if v_role is null or v_role not in ('owner', 'admin', 'site_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 2 and 120 then
    raise exception 'invalid_site_name' using errcode = '22023';
  end if;

  insert into public.sites (company_id, name) values (p_company_id, trim(p_name)) returning * into v_site;
  insert into public.audit_logs (company_id, actor_user_id, event, metadata)
  values (p_company_id, v_user_id, 'site.created', jsonb_build_object('site_id', v_site.id, 'site_name', v_site.name));
  return jsonb_build_object('id', v_site.id, 'company_id', v_site.company_id, 'name', v_site.name,
    'status', v_site.status, 'created_at', v_site.created_at);
end;
$$;

create or replace function public.update_site_for_current_user(p_site_id uuid, p_name text, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_role text;
  v_site public.sites;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_name is null or char_length(trim(p_name)) not between 2 and 120
     or p_status not in ('planned', 'active', 'suspended', 'archived') then
    raise exception 'invalid_site_input' using errcode = '22023';
  end if;
  select s.company_id, m.role into v_company_id, v_role
  from public.sites s join public.company_members m on m.company_id = s.company_id
  where s.id = p_site_id and m.user_id = v_user_id and m.status = 'active' limit 1;
  if v_company_id is null or v_role not in ('owner', 'admin', 'site_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  update public.sites set name = trim(p_name), status = p_status where id = p_site_id returning * into v_site;
  insert into public.audit_logs (company_id, actor_user_id, event, metadata)
  values (v_company_id, v_user_id, 'site.updated',
    jsonb_build_object('site_id', v_site.id, 'site_name', v_site.name, 'status', v_site.status));
  return jsonb_build_object('id', v_site.id, 'company_id', v_site.company_id, 'name', v_site.name,
    'status', v_site.status, 'created_at', v_site.created_at);
end;
$$;

revoke all on function public.create_company_for_current_user(text, text) from public, anon, authenticated;
revoke all on function public.create_site_for_current_user(uuid, text) from public, anon, authenticated;
revoke all on function public.update_site_for_current_user(uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_company_for_current_user(text, text) to authenticated;
grant execute on function public.create_site_for_current_user(uuid, text) to authenticated;
grant execute on function public.update_site_for_current_user(uuid, text, text) to authenticated;
