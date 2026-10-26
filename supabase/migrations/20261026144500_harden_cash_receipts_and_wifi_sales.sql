-- ZARAY production cash register hardening: only verified cash payments; active site required.
-- Cash payments for subscribed customers: record the payment and return a printable receipt payload.
create or replace function public.record_subscription_cash_payment(
  p_order_id uuid,
  p_receipt_number text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_order public.subscription_orders%rowtype;
  v_payment_id uuid;
  v_receipt text := left(trim(coalesce(p_receipt_number,'')),80);
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  if not exists(select 1 from auth.users u where u.id=v_user_id and u.email_confirmed_at is not null) then
    raise exception 'verified_email_required' using errcode='42501';
  end if;
  if v_receipt = '' then
    raise exception 'receipt_number_required' using errcode='22023';
  end if;

  select cm.role into v_role
  from public.company_members cm
  where cm.company_id = (select so.company_id from public.subscription_orders so where so.id = p_order_id)
    and cm.user_id = v_user_id and cm.status = 'active'
  limit 1;
  if v_role not in ('owner','admin') or v_role is null then
    raise exception 'role_not_authorized' using errcode='42501';
  end if;

  select * into v_order
  from public.subscription_orders
  where id = p_order_id
  for update;
  if v_order.id is null then
    raise exception 'order_not_found' using errcode='P0002';
  end if;
  if v_order.status <> 'pending_payment' then
    raise exception 'order_not_payable' using errcode='23505';
  end if;

  if v_order.status = 'pending_payment' then
    insert into public.payments(company_id, order_id, provider, provider_payment_id,
      idempotency_key, amount, currency, status, confirmed_at)
    values (v_order.company_id, v_order.id, 'cash',
      'cash:' || v_order.id::text || ':' || v_receipt,
      'cash-receipt:' || v_order.id::text,
      v_order.amount, v_order.currency, 'succeeded', now())
    returning id into v_payment_id;

    update public.subscription_orders
    set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
    where id = v_order.id;
  end if;

  insert into public.audit_logs(company_id, actor_user_id, event, metadata)
  values (v_order.company_id, v_user_id, 'subscription.cash_payment.receipt_issued',
    jsonb_build_object('order_id',v_order.id,'receipt_number',v_receipt,
      'payment_method','cash','amount',v_order.amount,'currency',v_order.currency,
      'payment_id',v_payment_id));

  return jsonb_build_object(
    'id',v_order.id,
    'company_id',v_order.company_id,
    'site_id',v_order.site_id,
    'customer_name',v_order.customer_name,
    'customer_email',v_order.customer_email,
    'customer_phone',v_order.customer_phone,
    'offer_name',v_order.offer_name,
    'public_reference',v_order.public_reference,
    'amount',v_order.amount,
    'currency',v_order.currency,
    'status','paid',
    'paid_at',coalesce(v_order.paid_at,now()),
    'receipt_number',v_receipt,
    'payment_method','cash'
  );
end;
$$;

revoke all on function public.record_subscription_cash_payment(uuid,text) from public, anon;
grant execute on function public.record_subscription_cash_payment(uuid,text) to authenticated;


create or replace function public.create_walkin_sale(
  p_company_id uuid,
  p_site_id uuid,
  p_offer_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_payment_method text,
  p_code_hash text,
  p_code_prefix text,
  p_receipt_number text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_sale public.walkin_sales%rowtype;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from auth.users u where u.id=v_user_id and u.email_confirmed_at is not null) then raise exception 'verified_email_required' using errcode='42501'; end if;
  if not exists(select 1 from public.company_members m where m.company_id=p_company_id and m.user_id=v_user_id and m.status='active' and m.role in ('owner','admin','site_manager','support','sales')) then raise exception 'role_not_authorized' using errcode='42501'; end if;
  if p_customer_name is null or btrim(p_customer_name)='' then raise exception 'customer_name_required' using errcode='22023'; end if;
  if p_payment_method <> 'cash' then raise exception 'invalid_payment_method' using errcode='22023'; end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_ticket_code' using errcode='22023'; end if;
  if p_code_prefix is null or length(p_code_prefix) not between 4 and 16 then raise exception 'invalid_ticket_prefix' using errcode='22023'; end if;
  if p_receipt_number is null or length(p_receipt_number) not between 6 and 40 then raise exception 'invalid_receipt_number' using errcode='22023'; end if;

  select * into v_offer from public.offers where id=p_offer_id and company_id=p_company_id and status='active';
  if v_offer.id is null then raise exception 'offer_not_found' using errcode='P0002'; end if;
  if p_site_id is null or not exists(select 1 from public.sites s where s.id=p_site_id and s.company_id=p_company_id and s.status='active') then raise exception 'site_not_active' using errcode='23514'; end if;

  insert into public.walkin_sales(company_id,site_id,offer_id,receipt_number,ticket_code_hash,ticket_code_prefix,customer_name,customer_phone,offer_name,amount,currency,duration_minutes,validity_days,max_devices,payment_method,ticket_status,valid_from,valid_until,created_by)
  values(p_company_id,p_site_id,p_offer_id,p_receipt_number,p_code_hash,upper(p_code_prefix),btrim(p_customer_name),nullif(btrim(p_customer_phone),''),v_offer.name,v_offer.price_amount,v_offer.currency,v_offer.duration_minutes,v_offer.validity_days,v_offer.max_devices,p_payment_method,'issued',now(),now()+make_interval(days=>v_offer.validity_days),v_user_id)
  returning * into v_sale;

  insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(v_sale.company_id,v_user_id,'walkin_sale.created',jsonb_build_object('sale_id',v_sale.id,'receipt_number',v_sale.receipt_number,'offer_id',v_sale.offer_id,'payment_method',v_sale.payment_method,'amount',v_sale.amount,'ticket_prefix',v_sale.ticket_code_prefix));

  return jsonb_build_object('id',v_sale.id,'receipt_number',v_sale.receipt_number,'ticket_code_prefix',v_sale.ticket_code_prefix,'customer_name',v_sale.customer_name,'customer_phone',v_sale.customer_phone,'offer_name',v_sale.offer_name,'amount',v_sale.amount,'currency',v_sale.currency,'payment_method',v_sale.payment_method,'duration_minutes',v_sale.duration_minutes,'validity_days',v_sale.validity_days,'max_devices',v_sale.max_devices,'valid_from',v_sale.valid_from,'valid_until',v_sale.valid_until,'created_at',v_sale.created_at);
exception when unique_violation then
  raise exception 'duplicate_walkin_sale' using errcode='23505';
end;
$$;

grant execute on function public.create_walkin_sale(uuid,uuid,uuid,text,text,text,text,text,text) to authenticated;

revoke all on function public.create_walkin_sale(uuid,uuid,uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.create_walkin_sale(uuid,uuid,uuid,text,text,text,text,text,text) to authenticated;