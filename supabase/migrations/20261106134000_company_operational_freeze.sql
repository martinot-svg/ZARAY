-- Company-wide operational freeze. Read-only reporting and incoming network
-- observations remain available; existing Wi-Fi sessions are NOT disconnected.
create or replace function public.guard_order_site_is_active()
returns trigger language plpgsql set search_path='' as $$
declare v_site_id uuid;
begin
 if new.site_id is not null then
  select s.id into v_site_id from public.sites s
  join public.companies c on c.id=s.company_id
  where s.id=new.site_id and s.company_id=new.company_id
   and s.status='active' and c.status in ('trial','active')
  for share of s,c;
  if v_site_id is null then
   raise exception 'site_not_available' using errcode='23514';
  end if;
 else
  if not exists(select 1 from public.companies c
    where c.id=new.company_id and c.status in ('trial','active'))
  then raise exception 'company_not_available' using errcode='23514'; end if;
 end if;
 return new;
end;
$$;

create or replace function public.guard_company_new_service()
returns trigger language plpgsql set search_path='' as $$
declare v_status text;
begin
 -- Suspension / revocation commands must remain possible while paused.
 if tg_table_name='network_commands'
  and new.action not in ('resume_account','provision_voucher','unblock_hotspot_mac')
 then return new; end if;
 select c.status into v_status from public.companies c
  where c.id=new.company_id for share;
 if v_status is null or v_status in ('suspended','closed') then
  raise exception 'company_suspended' using errcode='23514';
 end if;
 return new;
end;
$$;
-- Only the new service channels are frozen; existing data is preserved.
drop trigger if exists company_freeze_new_vouchers on public.wifi_vouchers;
create trigger company_freeze_new_vouchers before insert on public.wifi_vouchers
 for each row execute function public.guard_company_new_service();
drop trigger if exists company_freeze_network_accounts on public.network_access_accounts;
create trigger company_freeze_network_accounts before insert on public.network_access_accounts
 for each row execute function public.guard_company_new_service();
drop trigger if exists company_freeze_network_commands on public.network_commands;
create trigger company_freeze_network_commands before insert on public.network_commands
 for each row execute function public.guard_company_new_service();
