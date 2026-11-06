-- Android companion: one-time pairing and revocable, scoped device credentials.
-- This table is SERVER-ONLY. No direct PostgREST data access for browser roles.
create table if not exists public.residential_alarm_devices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  pairing_hash text not null unique check (pairing_hash ~ '^[0-9a-f]{64}$'),
  pairing_expires_at timestamptz not null,
  paired_at timestamptz,
  device_name text check (char_length(device_name) <= 60),
  token_hash text unique check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((paired_at is null and token_hash is null and token_expires_at is null)
      or (paired_at is not null and token_hash is not null and token_expires_at is not null))
);
create index if not exists residential_alarm_devices_customer_scope
  on public.residential_alarm_devices(company_id,site_id,customer_id,created_at desc);
create index if not exists residential_alarm_devices_pairing_window
  on public.residential_alarm_devices(pairing_expires_at)
  where paired_at is null and revoked_at is null;
alter table public.residential_alarm_devices enable row level security;
revoke all on public.residential_alarm_devices from public,anon,authenticated;
comment on table public.residential_alarm_devices is
  'Server-only pairing tickets and revocable Android device credentials, hashed at rest. No user-facing secrets, no service keys in Android.';
