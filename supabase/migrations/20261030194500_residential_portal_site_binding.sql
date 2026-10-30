-- ZARAY: public residential enrollment now records the network site before
-- the order/customer/subscription triggers fire. Supports pre-router enrollment.

create or replace function public.get_public_residential_sites(p_company_slug text)
returns table(site_id uuid,site_name text,site_status text)
language sql stable security definer set search_path=''
as $fn$
 select s.id,s.name,s.status
 from public.sites s
 join public.companies c on c.id=s.company_id
 where c.slug=pg_catalog.lower(pg_catalog.trim(p_company_slug))
   and c.status in ('trial','active')
   and s.status in ('active','planned')
 order by (s.status='active') desc,s.name,s.id limit 100;
$fn$;
revoke all on function public.get_public_residential_sites(text) from public,anon,authenticated;
grant execute on function public.get_public_residential_sites(text) to anon,authenticated;

create or replace function public.create_public_subscription_order_at_site(
 p_company_slug text,p_offer_id uuid,p_customer_name text,p_customer_email text,
 p_customer_phone text default null,p_site_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_company_id uuid;
 v_offer public.offers%rowtype;
 v_name text:=pg_catalog.trim(coalesce(p_customer_name,''));
 v_email text:=pg_catalog.lower(pg_catalog.trim(coalesce(p_customer_email,'')));
 v_phone text:=nullif(pg_catalog.trim(coalesce(p_customer_phone,'')),'');
 v_site_id uuid;
 v_site_ids uuid[];
 v_order_id uuid;
 v_reference text;
 v_recent_count integer;
begin
 if pg_catalog.length(v_name) not between 2 and 160
   or pg_catalog.length(v_email)>254
   or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
   or (v_phone is not null and pg_catalog.length(v_phone) not between 5 and 32) then
   raise exception 'invalid_customer_details' using errcode='22023';
 end if;
 if p_company_slug is null or pg_catalog.length(pg_catalog.trim(p_company_slug)) not between 2 and 80 then
   raise exception 'invalid_company' using errcode='22023';
 end if;
 select c.id into v_company_id from public.companies c
 where c.slug=pg_catalog.lower(pg_catalog.trim(p_company_slug))
   and c.status in ('active','trial');
 if v_company_id is null then raise exception 'company_not_found' using errcode='P0002'; end if;
 select o.* into v_offer from public.offers o
 where o.id=p_offer_id and o.company_id=v_company_id and o.status='active';
 if v_offer.id is null then raise exception 'offer_not_available' using errcode='P0002'; end if;
 if p_site_id is not null then
   select s.id into v_site_id from public.sites s
   where s.id=p_site_id and s.company_id=v_company_id and s.status in ('active','planned');
   if v_site_id is null then raise exception 'site_not_available' using errcode='P0002'; end if;
 else
   select pg_catalog.array_agg(s.id) into v_site_ids from public.sites s
   where s.company_id=v_company_id and s.status in ('active','planned');
   if pg_catalog.coalesce(pg_catalog.array_length(v_site_ids,1),0)>1 then
     raise exception 'site_required' using errcode='22023';
   end if;
   v_site_id=v_site_ids[1];
 end if;
 -- Per-company/customer advisory lock and the pre-existing anti-spam ceiling.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(v_company_id::text||':'||v_email,0));
 select count(*) into v_recent_count from public.subscription_orders so
 where so.company_id=v_company_id and so.customer_email=v_email
   and so.status='pending_payment'
   and so.created_at>now()-interval '15 minutes';
 if v_recent_count>=3 then raise exception 'too_many_orders' using errcode='P0001'; end if;
 v_order_id:=gen_random_uuid();
 v_reference:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 insert into public.subscription_orders(
   id,public_reference,company_id,site_id,offer_id,customer_name,customer_email,
   customer_phone,offer_name,amount,currency,duration_minutes,
   validity_days,max_devices,status
 ) values(
   v_order_id,v_reference,v_company_id,v_site_id,v_offer.id,v_name,v_email,
   v_phone,v_offer.name,v_offer.price_amount,v_offer.currency,
   v_offer.duration_minutes,v_offer.validity_days,v_offer.max_devices,'pending_payment'
 );
 insert into public.audit_logs(company_id,actor_user_id,event,metadata)
 values(v_company_id,null,'subscription_order.created',jsonb_build_object(
    'order_id',v_order_id,'reference',v_reference,'offer_id',v_offer.id,
    'site_id',v_site_id,'amount',v_offer.price_amount,'currency',v_offer.currency,
    'source','captive_portal'));
 return jsonb_build_object(
   'id',v_order_id,'reference',v_reference,'status','pending_payment',
   'amount',v_offer.price_amount,'currency',v_offer.currency,'offer_name',v_offer.name,
   'site_id',v_site_id
 );
end;
$fn$;
revoke all on function public.create_public_subscription_order_at_site(text,uuid,text,text,text,uuid)
 from public,anon,authenticated;
grant execute on function public.create_public_subscription_order_at_site(text,uuid,text,text,text,uuid)
 to anon,authenticated;

-- Only company owners/admins can bind an initially unassigned subscription
-- after creating the site; changing an already assigned/active site needs a
-- separate controlled network transfer and is deliberately disallowed.
create or replace function public.assign_residential_subscription_site(
 p_subscription_id uuid,p_site_id uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid:=auth.uid();
 v_sub public.residential_subscriptions%rowtype;
 v_role text;
 v_site public.sites%rowtype;
begin
 if v_actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select * into v_sub from public.residential_subscriptions
 where id=p_subscription_id for update;
 if v_sub.id is null then raise exception 'subscription_not_found' using errcode='P0002'; end if;
 select m.role into v_role from public.company_members m
  where m.company_id=v_sub.company_id and m.user_id=v_actor and m.status='active';
 if v_role not in ('owner','admin') or v_role is null then
    raise exception 'role_not_authorized' using errcode='42501';
 end if;
 if v_sub.site_id is not null then raise exception 'site_already_assigned' using errcode='23505'; end if;
 select * into v_site from public.sites
 where id=p_site_id and company_id=v_sub.company_id and status in ('active','planned');
 if v_site.id is null then raise exception 'site_not_available' using errcode='P0002'; end if;
 if exists(select 1 from public.network_access_accounts a
   join public.subscription_orders o on o.id=a.order_id
   where a.company_id=v_sub.company_id and o.customer_id=v_sub.customer_id) then
   raise exception 'network_account_already_bound' using errcode='23505';
 end if;
 update public.subscription_orders set site_id=p_site_id,updated_at=now()
 where company_id=v_sub.company_id and customer_id=v_sub.customer_id and site_id is null;
 update public.residential_subscriptions set site_id=p_site_id,updated_at=now()
 where id=v_sub.id and company_id=v_sub.company_id;
 update public.customers set site_id=p_site_id,updated_at=now()
 where id=v_sub.customer_id and company_id=v_sub.company_id and site_id is null;
 insert into public.audit_logs(company_id,actor_user_id,event,metadata)
 values(v_sub.company_id,v_actor,'residential.site_assigned',
 jsonb_build_object('subscription_id',v_sub.id,'site_id',p_site_id));
 return jsonb_build_object('subscription_id',v_sub.id,'site_id',p_site_id);
end;
$fn$;
revoke all on function public.assign_residential_subscription_site(uuid,uuid) from public,anon,authenticated;
grant execute on function public.assign_residential_subscription_site(uuid,uuid) to authenticated;
