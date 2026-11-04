-- ZARAY: additive key versioning. Existing legacy hashes and vouchers are never rewritten.
-- Existing linked HMAC vouchers, if any, continue to use key_version=1.
alter table public.wifi_voucher_network
  add column if not exists key_version smallint not null default 1;
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname='wifi_voucher_network_key_version_check'
       and conrelid='public.wifi_voucher_network'::regclass
  ) then
    alter table public.wifi_voucher_network
      add constraint wifi_voucher_network_key_version_check check(key_version in (1,2));
  end if;
end $$;
comment on column public.wifi_voucher_network.key_version is
  '1=legacy ZARAY_WIFI_VOUCHER_HMAC_KEY; 2=ZARAY_WIFI_VOUCHER_HMAC_KEY_V2 (independent HMAC verifier).';
