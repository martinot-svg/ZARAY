-- New vouchers: configurable short password (3-5). Preserve existing voucher credentials.
alter table public.ticket_templates
 drop constraint if exists ticket_templates_password_length_check;
update public.ticket_templates
 set password_length=5,updated_at=now()
 where password_length is not null and password_length>5;
alter table public.ticket_templates
 add constraint ticket_templates_password_length_check
 check (password_length is null or password_length between 3 and 5);

-- Older already-issued vouchers keep their original password lengths for compatibility.
alter table public.wifi_voucher_network
 drop constraint if exists wifi_voucher_network_password_length_check;
alter table public.wifi_voucher_network
 add constraint wifi_voucher_network_password_length_check
 check (password_length between 3 and 32);
