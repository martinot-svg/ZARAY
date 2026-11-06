-- ZARAY · Site-isolated captive portal studio (additive migration).
-- Deliberately no writes to any existing site, customer, or ticket row.
-- Only the service role can access drafts, versions and publish functions.
create table if not exists public.site_portal_configs (
  site_id uuid primary key references public.sites(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  draft jsonb not null default '{}'::jsonb,
  draft_revision integer not null default 0 check (draft_revision >= 0),
  published jsonb,
  published_version integer not null default 0 check (published_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  constraint site_portal_config_is_object check (
    jsonb_typeof(draft)='object' and (published is null or jsonb_typeof(published)='object')
  ),
  constraint site_portal_config_size check (
    pg_column_size(draft) <= 180000 and
    (published is null or pg_column_size(published) <= 180000)
  )
);
create index if not exists idx_site_portal_configs_company
  on public.site_portal_configs(company_id,site_id);
create table if not exists public.site_portal_versions (
  site_id uuid not null references public.sites(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  version integer not null check (version > 0),
  configuration jsonb not null check (jsonb_typeof(configuration)='object' and pg_column_size(configuration)<=180000),
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  primary key(site_id,version)
);
create index if not exists idx_site_portal_versions_company
  on public.site_portal_versions(company_id,site_id,version desc);

alter table public.site_portal_configs enable row level security;
alter table public.site_portal_versions enable row level security;
revoke all on public.site_portal_configs from public,anon,authenticated;
revoke all on public.site_portal_versions from public,anon,authenticated;
grant select,insert,update,delete on public.site_portal_configs to service_role;
grant select,insert,update,delete on public.site_portal_versions to service_role;

-- Transactional publication: one site/version at a time; no unreviewed draft can
-- replace another tenant's portal. The API authenticates the actor separately.
create or replace function public.publish_site_portal(
  p_company_id uuid,p_site_id uuid,p_actor_id uuid,p_expected_revision integer
) returns integer
language plpgsql security invoker set search_path=''
as $$
declare
 v_site public.sites%rowtype;
 v_config public.site_portal_configs%rowtype;
 v_next integer;
begin
 if auth.role() <> 'service_role' then
   raise exception 'service_role_only' using errcode='42501';
 end if;
 select * into v_site from public.sites
  where id=p_site_id and company_id=p_company_id for share;
 if not found or v_site.status<>'active' then
  raise exception 'site_unavailable' using errcode='22023';
 end if;
 select * into v_config from public.site_portal_configs
  where site_id=p_site_id and company_id=p_company_id for update;
 if not found then raise exception 'draft_missing' using errcode='22023'; end if;
 if v_config.draft_revision <> p_expected_revision then
  raise exception 'draft_conflict' using errcode='40001';
 end if;
 v_next:=v_config.published_version+1;
 insert into public.site_portal_versions
  (site_id,company_id,version,configuration,published_by)
 values(p_site_id,p_company_id,v_next,v_config.draft,p_actor_id);
 update public.site_portal_configs
  set published=v_config.draft,published_version=v_next,
      published_at=now(),published_by=p_actor_id,updated_at=now()
  where site_id=p_site_id and company_id=p_company_id;
 return v_next;
end;
$$;

create or replace function public.restore_site_portal_draft(
 p_company_id uuid,p_site_id uuid,p_version integer,p_expected_revision integer
) returns integer
language plpgsql security invoker set search_path=''
as $$
declare v_snapshot jsonb;v_revision integer;
begin
 if auth.role() <> 'service_role' then
  raise exception 'service_role_only' using errcode='42501';
 end if;
 select configuration into v_snapshot from public.site_portal_versions
  where site_id=p_site_id and company_id=p_company_id and version=p_version;
 if not found then raise exception 'version_missing' using errcode='22023'; end if;
 update public.site_portal_configs
  set draft=v_snapshot,draft_revision=draft_revision+1,updated_at=now()
  where site_id=p_site_id and company_id=p_company_id and draft_revision=p_expected_revision
  returning draft_revision into v_revision;
 if not found then raise exception 'draft_conflict' using errcode='40001'; end if;
 return v_revision;
end;
$$;
revoke all on function public.publish_site_portal(uuid,uuid,uuid,integer)
 from public,anon,authenticated;
revoke all on function public.restore_site_portal_draft(uuid,uuid,integer,integer)
 from public,anon,authenticated;
grant execute on function public.publish_site_portal(uuid,uuid,uuid,integer) to service_role;
grant execute on function public.restore_site_portal_draft(uuid,uuid,integer,integer) to service_role;
comment on table public.site_portal_configs is
 'Draft and published portal are independent per site; never expose drafts through public APIs.';
