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
  if v_order.status not in ('pending_payment','paid') then
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
