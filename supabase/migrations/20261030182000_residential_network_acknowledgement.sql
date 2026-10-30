-- Residential renewal on an existing MikroTik account: keep login credentials,
-- bind the paid order to the same network account, require a fresh router acknowledgement.
create or replace function network_internal.network_payment_approved()
returns trigger
language plpgsql security definer set search_path=''
as $function$
declare
 a public.network_access_accounts%rowtype;
 v_router public.network_routers%rowtype;
 v_grace integer;
 v_matching_accounts uuid[];
 v_new_expiry timestamptz;
begin
 if new.status='paid' and new.paid_at is not null
   and (tg_op='INSERT' or old.status is distinct from new.status) then

   -- For an existing residential client, reuse the *single* account at the same
   -- site. Ambiguous multiple network accounts are never silently rebound.
   if new.customer_id is not null and not exists(
      select 1 from public.network_access_accounts x
        where x.order_id=new.id and x.company_id=new.company_id
   ) then
     select pg_catalog.array_agg(na.id) into v_matching_accounts
     from public.network_access_accounts na
     join public.subscription_orders previous_order on previous_order.id=na.order_id
     join public.network_routers r on r.id=na.router_id and r.company_id=na.company_id
     where na.company_id=new.company_id
       and previous_order.company_id=new.company_id
       and previous_order.customer_id=new.customer_id
       and previous_order.paid_at is not null
       and previous_order.site_id is not distinct from new.site_id
       and r.site_id is not distinct from new.site_id;
     if coalesce(pg_catalog.array_length(v_matching_accounts,1),0)=1 then
       update public.network_access_accounts
       set order_id=new.id
       where id=v_matching_accounts[1] and company_id=new.company_id;
     end if;
   end if;

   for a in select * from public.network_access_accounts
      where company_id=new.company_id and order_id=new.id
      for update
   loop
     select * into v_router from public.network_routers where id=a.router_id;
     select grace_hours into v_grace
       from public.network_company_policies where company_id=a.company_id;
     v_grace:=coalesce(v_grace,72);
     v_new_expiry=greatest(now(),coalesce(a.expires_at,now()))
       +pg_catalog.make_interval(days=>greatest(new.validity_days,1));
     update public.network_access_accounts
        set expires_at=v_new_expiry,
            grace_until=v_new_expiry+pg_catalog.make_interval(hours=>v_grace)
        where id=a.id;

     perform network_internal.reconcile_one(a.id);
     -- If the account was already active before payment, reconcile_one() does
     -- not enqueue a new resume. The renewal nevertheless needs a fresh,
     -- acknowledged entitlement before the new order is marked activated.
     if v_router.control_enabled and a.applied_state='active'
       and not a.administrative_hold and
       (select desired_state from public.network_access_accounts where id=a.id)='active'
       and not exists (
         select 1 from public.network_commands cmd
         where cmd.account_id=a.id and cmd.action='resume_account'
           and cmd.status in ('queued','dispatched')
       ) then
       insert into public.network_commands(
         company_id,router_id,account_id,action,protocol,username,reason
       ) values (
         a.company_id,a.router_id,a.id,'resume_account',a.protocol,a.username,
         'Confirmer le renouvellement résidentiel sur MikroTik'
       );
     end if;
   end loop;
 end if;
 return new;
end;
$function$;
revoke all on function network_internal.network_payment_approved() from public,anon,authenticated;

-- Only a *trusted network connector* result updates applied_state to active.
-- It is the definitive proof that the residential service was provisioned.
create or replace function network_internal.residential_network_ack()
returns trigger
language plpgsql security definer set search_path=''
as $function$
declare
 v_order public.subscription_orders%rowtype;
 v_period_end timestamptz;
 v_grace integer;
begin
 if new.applied_state<>'active' or new.desired_state<>'active'
     or new.order_id is null then return new; end if;

 select * into v_order from public.subscription_orders
  where id=new.order_id and company_id=new.company_id;
 if v_order.id is null or v_order.paid_at is null
     or v_order.status not in ('paid','activation_pending') then return new; end if;

 update public.subscription_orders set
     status='active',
     activated_at=coalesce(activated_at,now()),
     updated_at=now()
   where id=v_order.id and company_id=new.company_id
     and paid_at is not null and activated_at is null
     and status in ('paid','activation_pending');

 if not found then return new; end if;
 -- Synchronize network expiry to the exact period the residential ledger
 -- recorded, so a delayed router connection never consumes paid offline days.
 select s.expires_at into v_period_end
 from public.residential_subscriptions s
 where s.company_id=new.company_id and s.customer_id=v_order.customer_id;

 if v_period_end is not null then
   select p.grace_hours into v_grace from public.network_company_policies p
    where p.company_id=new.company_id;
   update public.network_access_accounts
     set expires_at=v_period_end,
         grace_until=v_period_end+
           pg_catalog.make_interval(hours=>coalesce(v_grace,72))
     where id=new.id and company_id=new.company_id;
 end if;
 return new;
end;
$function$;
revoke all on function network_internal.residential_network_ack() from public,anon,authenticated;

drop trigger if exists residential_network_acknowledged on public.network_access_accounts;
create trigger residential_network_acknowledged
 after update of applied_state on public.network_access_accounts
 for each row execute function network_internal.residential_network_ack();
