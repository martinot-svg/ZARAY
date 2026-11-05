-- Internal, free public links. These are NOT DNS domains and never authorize a custom hostname.
create table if not exists public.site_public_links (
  site_id uuid primary key,
  company_id uuid not null,
  alias text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (site_id,company_id) references public.sites(id,company_id) on delete cascade,
  constraint site_public_links_alias_format check (
    alias=lower(alias) and length(alias) between 3 and 100
    and alias ~ '^[a-z0-9]+([.-][a-z0-9]+)*$'
  )
);
create index if not exists site_public_links_company_idx on public.site_public_links(company_id);
alter table public.site_public_links enable row level security;
revoke all on public.site_public_links from public, anon, authenticated;
grant select, insert, update, delete on public.site_public_links to service_role;

-- A saved but unverified "domain" was intended by the administrator as a
-- human-readable alias. Copy it into the internal links table without
-- claiming ownership of that Internet domain or modifying DNS.
insert into public.site_public_links(site_id,company_id,alias,created_by)
select site_id,company_id,hostname,created_by
from public.site_custom_domains
where status='pending' and length(hostname)<=100
on conflict do nothing;