-- One exclusive, verified custom hostname per residential site.
-- Backend-only writes: neither browser nor ordinary authenticated SQL role can activate a domain.
create table if not exists public.site_custom_domains (
  site_id uuid primary key references public.sites(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  hostname text not null unique,
  status text not null default 'pending' check (status in ('pending','active')),
  verified_at timestamptz,
  last_checked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_custom_domain_hostname check (
    hostname = lower(hostname)
    and length(hostname) between 4 and 253
    and hostname ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  ),
  constraint site_custom_domain_verified check (
    status <> 'active' or verified_at is not null
  )
);
create index if not exists site_custom_domain_company_idx
  on public.site_custom_domains(company_id,updated_at desc);
create index if not exists site_custom_domain_active_host_idx
  on public.site_custom_domains(hostname)
  where status='active';

create or replace function public.enforce_site_domain_company()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if not exists (
    select 1 from public.sites s
    where s.id=new.site_id and s.company_id=new.company_id
  ) then
    raise exception 'Site does not belong to this company'
      using errcode='23503';
  end if;
  new.updated_at=now();
  return new;
end;
$$;
drop trigger if exists site_domain_company_guard on public.site_custom_domains;
create trigger site_domain_company_guard
  before insert or update on public.site_custom_domains
  for each row execute function public.enforce_site_domain_company();

alter table public.site_custom_domains enable row level security;
revoke all on public.site_custom_domains from public,anon,authenticated;
grant select,insert,update,delete on public.site_custom_domains to service_role;
revoke all on function public.enforce_site_domain_company()
  from public,anon,authenticated;
