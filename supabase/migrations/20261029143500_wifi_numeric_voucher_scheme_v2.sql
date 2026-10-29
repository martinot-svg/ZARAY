-- New tickets use numerical HMAC-derived PINs while older printed alphanumeric credentials remain valid.
alter table public.wifi_voucher_network
 drop constraint if exists wifi_voucher_network_credential_scheme_check;
alter table public.wifi_voucher_network
 add constraint wifi_voucher_network_credential_scheme_check
 check (credential_scheme in ('hmac-v1','hmac-numeric-v2'));
alter table public.wifi_voucher_network
 alter column credential_scheme set default 'hmac-numeric-v2';
