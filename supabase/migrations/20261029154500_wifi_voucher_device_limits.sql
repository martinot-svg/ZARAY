alter table public.wifi_voucher_network
 add column if not exists max_devices integer not null default 1 check(max_devices between 1 and 100);