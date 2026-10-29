-- Cumulative Hotspot uptime sourced from a router-managed voucher user.
alter table public.wifi_voucher_network
 add column if not exists used_seconds integer not null default 0
 check(used_seconds between 0 and 315360000);
alter table public.wifi_voucher_network
 add column if not exists last_usage_at timestamptz;

create or replace function public.record_wifi_voucher_usage(p_router_id uuid,p_readings jsonb)
returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare item jsonb; v_id uuid; v_name text; v_sec integer; x record; total integer:=0; new_used integer;
begin
 if current_user<>'service_role' then
  raise exception using errcode='42501',message='Service role required'; end if;
 if jsonb_typeof(p_readings) is distinct from 'array' or jsonb_array_length(p_readings)>500 then
  raise exception using errcode='22023',message='Invalid cumulative usage batch'; end if;
 for item in select value from jsonb_array_elements(p_readings) loop
  if jsonb_typeof(item) is distinct from 'object'
    or coalesce(item->>'voucherId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or length(coalesce(item->>'username','')) not between 1 and 128
    or coalesce(item->>'uptimeSeconds','') !~ '^[0-9]{1,9}$' then
   raise exception using errcode='22023',message='Invalid usage entry'; end if;
  v_id:=(item->>'voucherId')::uuid;
  v_name:=item->>'username';
  v_sec:=(item->>'uptimeSeconds')::integer;
  if v_sec<0 or v_sec>315360000 then
   raise exception using errcode='22023',message='Usage counter out of range'; end if;

  select v.id,v.status,v.duration_minutes,n.used_seconds into x
    from public.wifi_vouchers v
    join public.wifi_voucher_network n on n.voucher_id=v.id
    where n.router_id=p_router_id and v.id=v_id and v.username=v_name
    for update of v,n;
  if not found or x.status not in ('paid','active','expired') then continue; end if;
  new_used:=greatest(x.used_seconds,v_sec);
  update public.wifi_voucher_network
    set used_seconds=new_used,last_usage_at=now(),updated_at=now()
    where voucher_id=v_id and router_id=p_router_id;

  if x.status in ('paid','active') and new_used>=x.duration_minutes*60 then
   update public.wifi_vouchers set status='expired',expires_at=now(),
     activated_at=coalesce(activated_at,now())
     where id=v_id and status in ('paid','active');
  elsif x.status='paid' and new_used>0 then
   update public.wifi_vouchers
     set status='active',activated_at=coalesce(activated_at,now()),expires_at=null
     where id=v_id and status='paid';
  end if;
  total:=total+1;
 end loop;
 return total;
end $$;
revoke all on function public.record_wifi_voucher_usage(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_wifi_voucher_usage(uuid,jsonb) to service_role;

-- Active vouchers use HotSpot uptime, NOT wall-clock time since first login.
-- validity_days remains the first-use window after sale for unused tickets only.
update public.wifi_vouchers v set expires_at=null
 where v.status='active' and exists (
  select 1 from public.wifi_voucher_network n where n.voucher_id=v.id and n.credential_scheme='hmac-v1'
 );

create or replace function network_internal.reconcile_wifi_vouchers()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; recent_failures integer;
begin
 update public.wifi_vouchers v set status='expired',expires_at=now()
 where v.status='active' and exists (
  select 1 from public.wifi_voucher_network n
  where n.voucher_id=v.id and n.used_seconds>=v.duration_minutes*60
 );
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

