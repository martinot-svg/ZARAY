
create or replace function network_internal.reconcile_wifi_vouchers()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; recent_failures integer;
begin
 update public.wifi_vouchers set status='expired'
 where status='active' and expires_at is not null and expires_at<=now();
 update public.wifi_vouchers set status='expired'
 where status='paid' and paid_at is not null and paid_at + make_interval(days=>validity_days)<=now();
 for r in
 select v.id,v.username,v.company_id,v.status,n.router_id,n.network_state
 from public.wifi_vouchers v join public.wifi_voucher_network n on n.voucher_id=v.id
 join public.network_routers router on router.id=n.router_id
 where router.control_enabled and router.last_seen_at>now()-interval '3 minutes'
 and (
 (v.status='expired' and n.network_state not in ('expired','not_sold'))
 or (v.status='paid' and n.network_state in ('queued','failed'))
 ) loop
   if r.status='expired' then
    if not exists(select 1 from public.network_commands c where c.voucher_id=r.id and c.action='expire_voucher'
      and c.status in ('queued','dispatched'))
    and not exists(select 1 from public.network_commands c where c.voucher_id=r.id and c.action='expire_voucher'
      and c.status='failed' and c.created_at>now()-interval '15 minutes') then
     insert into public.network_commands(company_id,router_id,voucher_id,protocol,username,action,reason)
     values(r.company_id,r.router_id,r.id,'hotspot',r.username,'expire_voucher','Expiration du ticket Wi-Fi');
    end if;
   else
    select count(*) into recent_failures from public.network_commands c where c.voucher_id=r.id
      and c.action='provision_voucher' and c.status in ('failed','cancelled') and c.created_at>now()-interval '1 day';
    if recent_failures<3 and not exists(select 1 from public.network_commands c
      where c.voucher_id=r.id and c.action='provision_voucher' and c.status in ('queued','dispatched','success'))
    and not exists(select 1 from public.network_commands c where c.voucher_id=r.id and c.action='provision_voucher'
       and c.status in ('failed','cancelled') and c.created_at>now()-interval '15 minutes') then
      insert into public.network_commands(company_id,router_id,voucher_id,protocol,username,action,reason)
      values(r.company_id,r.router_id,r.id,'hotspot',r.username,'provision_voucher','Reprise de provisionnement Wi-Fi');
      update public.wifi_voucher_network set network_state='queued',updated_at=now() where voucher_id=r.id;
    end if;
   end if;
 end loop;
end $$;
revoke all on function network_internal.reconcile_wifi_vouchers() from public,anon,authenticated;
select cron.schedule('zaray_wifi_voucher_reconcile','* * * * *','select network_internal.reconcile_wifi_vouchers();');
