-- Tickets Wi-Fi ZARAY -> MikroTik Hotspot: isolated provisioning and cash sale.
create table if not exists public.wifi_voucher_network (
 voucher_id uuid primary key references public.wifi_vouchers(id) on delete cascade,
 company_id uuid not null references public.companies(id) on delete cascade,
 site_id uuid not null,
 router_id uuid not null,
 password_length integer not null check(password_length between 12 and 32),
 credential_scheme text not null default 'hmac-v1' check(credential_scheme='hmac-v1'),
 network_state text not null default 'not_sold' check(network_state in ('not_sold','queued','provisioned','failed','expired')),
 last_error text,
 updated_at timestamptz not null default now(),
 foreign key (site_id,company_id) references public.sites(id,company_id),
 foreign key (router_id,company_id) references public.network_routers(id,company_id)
);
create index if not exists wifi_voucher_network_router_idx on public.wifi_voucher_network(router_id,network_state);
create or replace function public.wifi_voucher_network_guard() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if not exists (
 select 1 from public.wifi_vouchers v join public.network_routers r on r.id=new.router_id
 where v.id=new.voucher_id and v.company_id=new.company_id and v.site_id=new.site_id
 and r.company_id=new.company_id and r.site_id=new.site_id
 ) then raise exception 'Voucher and router must belong to the same site'; end if;
 return new;
end $$;
drop trigger if exists wifi_voucher_network_guard_trg on public.wifi_voucher_network;
create trigger wifi_voucher_network_guard_trg before insert or update on public.wifi_voucher_network
for each row execute function public.wifi_voucher_network_guard();
alter table public.wifi_voucher_network enable row level security;
revoke all on public.wifi_voucher_network from anon,authenticated;
grant select on public.wifi_voucher_network to authenticated;
create policy wifi_voucher_network_read on public.wifi_voucher_network for select to authenticated using (
 exists(select 1 from public.company_members m where m.company_id=wifi_voucher_network.company_id
 and m.user_id=(select auth.uid()) and m.status='active')
);
create table if not exists public.wifi_voucher_sales (
 id uuid primary key default gen_random_uuid(),
 voucher_id uuid not null unique references public.wifi_vouchers(id) on delete restrict,
 company_id uuid not null references public.companies(id) on delete cascade,
 site_id uuid not null,
 payment_method text not null default 'cash' check(payment_method='cash'),
 amount numeric not null check(amount>=0),
 currency text not null,
 customer_name text not null default 'Client occasionnel',
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 foreign key (site_id,company_id) references public.sites(id,company_id)
);
alter table public.wifi_voucher_sales enable row level security;
revoke all on public.wifi_voucher_sales from anon,authenticated;
grant select on public.wifi_voucher_sales to authenticated;
create policy wifi_voucher_sales_read on public.wifi_voucher_sales for select to authenticated using (
 exists(select 1 from public.company_members m where m.company_id=wifi_voucher_sales.company_id
 and m.user_id=(select auth.uid()) and m.status='active')
);
alter table public.network_commands add column if not exists voucher_id uuid references public.wifi_vouchers(id) on delete set null;
alter table public.network_commands drop constraint if exists network_commands_action_check;
alter table public.network_commands add constraint network_commands_action_check
 check(action in ('disconnect_hotspot','disconnect_ppp','suspend_account','resume_account','block_hotspot_mac','unblock_hotspot_mac','provision_voucher','expire_voucher'));
create unique index if not exists wifi_voucher_open_provision_idx on public.network_commands(voucher_id,action)
 where voucher_id is not null and status in ('queued','dispatched');

-- Single transaction prevents selling an unpaid ticket twice, and never trusts a browser-supplied price.
create or replace function public.sell_wifi_voucher(p_voucher_id uuid, p_customer_name text default 'Client occasionnel')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_user uuid := auth.uid(); v_voucher public.wifi_vouchers%rowtype;
 v_net public.wifi_voucher_network%rowtype; v_router public.network_routers%rowtype;
 v_amount numeric; v_currency text; v_command uuid; v_sale uuid;
begin
 if v_user is null then raise exception using errcode='42501',message='Authentication required'; end if;
 select * into v_voucher from public.wifi_vouchers where id=p_voucher_id for update;
 if not found then raise exception using errcode='P0002',message='Voucher not found'; end if;
 if not exists(select 1 from public.company_members m where m.company_id=v_voucher.company_id
   and m.user_id=v_user and m.status='active' and m.role in ('owner','admin','site_manager','sales'))
 then raise exception using errcode='42501',message='Not authorized to sell vouchers'; end if;
 if v_voucher.status<>'available' then raise exception using errcode='23505',message='Voucher already sold'; end if;
 if not exists(select 1 from public.sites where id=v_voucher.site_id and company_id=v_voucher.company_id and status='active')
 then raise exception using errcode='22023',message='Site not active'; end if;
 select * into v_net from public.wifi_voucher_network where voucher_id=p_voucher_id for update;
 if not found or v_net.credential_scheme<>'hmac-v1' then
  raise exception using errcode='22023',message='This voucher was not generated for network provisioning'; end if;
 select * into v_router from public.network_routers where id=v_net.router_id;
 if not found or v_router.site_id<>v_voucher.site_id or not v_router.control_enabled
  or v_router.last_seen_at is null or v_router.last_seen_at<now()-interval '3 minutes'
 then raise exception using errcode='22023',message='MikroTik connector not ready'; end if;
 select price_amount,currency into v_amount,v_currency from public.offers
  where id=v_voucher.offer_id and company_id=v_voucher.company_id and status='active';
 if not found then raise exception using errcode='22023',message='Offer unavailable'; end if;
 update public.wifi_vouchers set status='paid',paid_at=now() where id=p_voucher_id and status='available';
 insert into public.wifi_voucher_sales(voucher_id,company_id,site_id,amount,currency,customer_name,created_by)
 values(p_voucher_id,v_voucher.company_id,v_voucher.site_id,v_amount,v_currency,
 left(coalesce(nullif(trim(p_customer_name),''),'Client occasionnel'),160),v_user) returning id into v_sale;
 insert into public.network_commands(company_id,router_id,voucher_id,protocol,username,action,created_by,reason,expires_at)
 values(v_voucher.company_id,v_net.router_id,p_voucher_id,'hotspot',v_voucher.username,'provision_voucher',v_user,
 'Ticket Wi-Fi vendu en espèces',now()+interval '24 hours') returning id into v_command;
 update public.wifi_voucher_network set network_state='queued',updated_at=now() where voucher_id=p_voucher_id;
 insert into public.audit_logs(company_id,actor_user_id,event,metadata)
 values(v_voucher.company_id,v_user,'wifi_voucher.cash_sale',
 jsonb_build_object('voucher_id',p_voucher_id,'sale_id',v_sale,'command_id',v_command,'amount',v_amount,'currency',v_currency));
 return jsonb_build_object('sale_id',v_sale,'voucher_id',p_voucher_id,'command_id',v_command,'state','pending_router');
end $$;
revoke all on function public.sell_wifi_voucher(uuid,text) from public,anon;
grant execute on function public.sell_wifi_voucher(uuid,text) to authenticated;

create or replace function network_internal.reconcile_wifi_vouchers() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r record;
begin
 update public.wifi_vouchers set status='expired'
 where status='active' and expires_at is not null and expires_at <= now();
 -- Tickets that were sold but never connected expire after the voucher redemption window.
 update public.wifi_vouchers set status='expired'
 where status='paid' and paid_at is not null and paid_at + make_interval(days=>validity_days) <= now();
 for r in select v.id,v.username,v.company_id,n.router_id,n.network_state
 from public.wifi_vouchers v join public.wifi_voucher_network n on n.voucher_id=v.id
 join public.network_routers router on router.id=n.router_id
 where v.status='expired' and n.network_state not in ('expired','not_sold') and router.control_enabled loop
   if not exists(select 1 from public.network_commands c where c.voucher_id=r.id
     and c.action='expire_voucher' and c.status in ('queued','dispatched'))
   and not exists(select 1 from public.network_commands c where c.voucher_id=r.id
     and c.action='expire_voucher' and c.status='failed' and c.created_at>now()-interval '15 minutes')
   then
     insert into public.network_commands(company_id,router_id,voucher_id,protocol,username,action,reason)
     values(r.company_id,r.router_id,r.id,'hotspot',r.username,'expire_voucher','Expiration du ticket Wi-Fi');
   end if;
 end loop;
end $$;
revoke all on function network_internal.reconcile_wifi_vouchers() from public,anon,authenticated;
