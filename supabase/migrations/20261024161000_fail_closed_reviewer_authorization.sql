-- Fail closed when a reviewer grant remains after membership suspension or removal.
create or replace function public.can_review_manual_payment_submissions(p_company_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if v_user_id is null or p_company_id is null then return false; end if;

  select cm.role into v_role
  from public.company_members cm
  where cm.company_id = p_company_id
    and cm.user_id = v_user_id
    and cm.status = 'active';

  if v_role = 'owner' then return true; end if;
  if v_role is distinct from 'admin' then return false; end if;

  return exists (
    select 1 from public.manual_payment_reviewers r
    where r.company_id = p_company_id
      and r.user_id = v_user_id
      and r.revoked_at is null
  );
end;
$$;
revoke all on function public.can_review_manual_payment_submissions(uuid) from public, anon, authenticated;
grant execute on function public.can_review_manual_payment_submissions(uuid) to authenticated;

create or replace function public.review_manual_payment_submission(
  p_submission_id uuid,
  p_action text,
  p_review_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_submission public.manual_payment_submissions%rowtype;
  v_order public.subscription_orders%rowtype;
  v_provider text;
  v_note text := left(trim(coalesce(p_review_note,'')),1000);
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if coalesce(p_action,'') not in ('approve','reject') then raise exception 'invalid_review_action' using errcode='22023'; end if;

  select cm.role into v_role
  from public.company_members cm
  where cm.company_id = (
    select s.company_id from public.manual_payment_submissions s where s.id = p_submission_id
  ) and cm.user_id = v_user_id and cm.status = 'active'
  limit 1;

  if v_role is distinct from 'owner' and not (
    v_role is not distinct from 'admin'
    and exists (
      select 1 from public.manual_payment_reviewers r
      where r.company_id = (
        select s.company_id from public.manual_payment_submissions s where s.id = p_submission_id
      ) and r.user_id = v_user_id and r.revoked_at is null
    )
  ) then
    raise exception 'manual_payment_review_not_authorized' using errcode='42501';
  end if;

  select * into v_submission from public.manual_payment_submissions where id=p_submission_id for update;
  if v_submission.id is null then raise exception 'submission_not_found' using errcode='P0002'; end if;
  if v_submission.status <> 'submitted' then raise exception 'submission_already_reviewed' using errcode='23505'; end if;

  select * into v_order from public.subscription_orders where id=v_submission.order_id for update;
  if v_order.id is null then raise exception 'order_not_found' using errcode='P0002'; end if;

  if p_action = 'reject' then
    update public.manual_payment_submissions
    set status='rejected', reviewer_user_id=v_user_id, reviewed_at=now(), review_note=v_note, updated_at=now()
    where id=v_submission.id;
    insert into public.audit_logs(company_id,actor_user_id,event,metadata)
    values(v_submission.company_id,v_user_id,'manual_payment.rejected',
      jsonb_build_object('submission_id',v_submission.id,'order_id',v_order.id,'reference',v_order.public_reference,
        'provider',v_submission.provider,'transaction_reference',v_submission.transaction_reference,'note',v_note));
    return jsonb_build_object('submission_id',v_submission.id,'status','rejected');
  end if;

  if v_order.status <> 'pending_payment' or v_order.paid_at is not null then
    raise exception 'order_not_payable' using errcode='23505';
  end if;
  if v_submission.amount <> v_order.amount or v_submission.currency <> v_order.currency then
    raise exception 'payment_amount_or_currency_mismatch' using errcode='22023';
  end if;

  v_provider := 'manual_' || v_submission.provider;
  insert into public.payments(company_id,order_id,provider,provider_payment_id,idempotency_key,amount,currency,status,confirmed_at)
  values(v_order.company_id,v_order.id,v_provider,'manual-submission:'||v_submission.id::text,
    'manual-payment-submission:'||v_submission.id::text,v_order.amount,v_order.currency,'succeeded',now());

  update public.subscription_orders set status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() where id=v_order.id;
  update public.manual_payment_submissions
  set status='approved',reviewer_user_id=v_user_id,reviewed_at=now(),review_note=v_note,updated_at=now()
  where id=v_submission.id;

  insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(v_submission.company_id,v_user_id,'manual_payment.approved',
    jsonb_build_object('submission_id',v_submission.id,'order_id',v_order.id,'payment_provider',v_provider,
      'reference',v_order.public_reference,'transaction_reference',v_submission.transaction_reference,
      'amount',v_order.amount,'currency',v_order.currency));

  return jsonb_build_object('submission_id',v_submission.id,'status','approved','order_id',v_order.id,'order_status','paid');
end;
$$;
revoke all on function public.review_manual_payment_submission(uuid,text,text) from public, anon, authenticated;
grant execute on function public.review_manual_payment_submission(uuid,text,text) to authenticated;
