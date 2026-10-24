-- Explicit, owner-controlled authorization for manual Orange Money / MVola payment reviews.
-- Additive only: preserves existing payment submissions and review history.

create table if not exists public.manual_payment_reviewers (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  primary key (company_id, user_id),
  constraint manual_payment_reviewers_revocation_pair
    check ((revoked_at is null) = (revoked_by is null))
);

create index if not exists manual_payment_reviewers_active_idx
  on public.manual_payment_reviewers(company_id, user_id)
  where revoked_at is null;

alter table public.manual_payment_reviewers enable row level security;
revoke all on public.manual_payment_reviewers from public, anon, authenticated;

create or replace function public.set_manual_payment_reviewer(
  p_company_id uuid,
  p_user_id uuid,
  p_authorized boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_company_id is null or p_user_id is null or p_authorized is null then
    raise exception 'invalid_reviewer_input' using errcode = '22023';
  end if;

  select cm.role into v_actor_role
  from public.company_members cm
  where cm.company_id = p_company_id
    and cm.user_id = v_actor
    and cm.status = 'active';

  if v_actor_role is distinct from 'owner' then
    raise exception 'owner_only_reviewer_management' using errcode = '42501';
  end if;

  if p_user_id = v_actor then
    raise exception 'owner_does_not_need_reviewer_grant' using errcode = '22023';
  end if;

  if p_authorized then
    select cm.role into v_target_role
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = p_user_id
      and cm.status = 'active';

    if v_target_role is distinct from 'admin' then
      raise exception 'reviewer_must_be_active_admin' using errcode = '22023';
    end if;

    insert into public.manual_payment_reviewers(company_id, user_id, granted_by, granted_at, revoked_by, revoked_at)
    values (p_company_id, p_user_id, v_actor, now(), null, null)
    on conflict (company_id, user_id) do update
      set granted_by = excluded.granted_by,
          granted_at = now(),
          revoked_by = null,
          revoked_at = null;

    insert into public.audit_logs(company_id, actor_user_id, event, metadata)
    values (p_company_id, v_actor, 'manual_payment.reviewer_authorized',
      jsonb_build_object('reviewer_user_id', p_user_id));
    return jsonb_build_object('company_id', p_company_id, 'user_id', p_user_id, 'authorized', true);
  end if;

  update public.manual_payment_reviewers
  set revoked_by = v_actor, revoked_at = now()
  where company_id = p_company_id and user_id = p_user_id and revoked_at is null;

  if found then
    insert into public.audit_logs(company_id, actor_user_id, event, metadata)
    values (p_company_id, v_actor, 'manual_payment.reviewer_revoked',
      jsonb_build_object('reviewer_user_id', p_user_id));
  end if;

  return jsonb_build_object('company_id', p_company_id, 'user_id', p_user_id, 'authorized', false);
end;
$$;

revoke all on function public.set_manual_payment_reviewer(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_manual_payment_reviewer(uuid, uuid, boolean) to authenticated;

create or replace function public.list_manual_payment_reviewers(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_reviewers jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select cm.role into v_actor_role
  from public.company_members cm
  where cm.company_id = p_company_id
    and cm.user_id = v_actor
    and cm.status = 'active';

  if v_actor_role is distinct from 'owner' then
    raise exception 'owner_only_reviewer_management' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', cm.user_id,
    'email', u.email,
    'role', cm.role,
    'authorized', (r.revoked_at is null),
    'granted_at', r.granted_at
  ) order by u.email), '[]'::jsonb)
  into v_reviewers
  from public.company_members cm
  join auth.users u on u.id = cm.user_id
  left join public.manual_payment_reviewers r
    on r.company_id = cm.company_id and r.user_id = cm.user_id
  where cm.company_id = p_company_id
    and cm.status = 'active'
    and cm.role = 'admin';

  return jsonb_build_object('reviewers', v_reviewers);
end;
$$;

revoke all on function public.list_manual_payment_reviewers(uuid) from public, anon, authenticated;
grant execute on function public.list_manual_payment_reviewers(uuid) to authenticated;

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
  if v_user_id is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  if coalesce(p_action,'') not in ('approve','reject') then
    raise exception 'invalid_review_action' using errcode='22023';
  end if;

  select cm.role into v_role
  from public.company_members cm
  where cm.company_id = (
    select s.company_id from public.manual_payment_submissions s where s.id = p_submission_id
  )
    and cm.user_id = v_user_id and cm.status = 'active'
  limit 1;

  if v_role is distinct from 'owner' and not (
    v_role = 'admin'
    and exists (
      select 1
      from public.manual_payment_reviewers r
      where r.company_id = (
        select s.company_id from public.manual_payment_submissions s where s.id = p_submission_id
      )
        and r.user_id = v_user_id
        and r.revoked_at is null
    )
  ) then
    raise exception 'manual_payment_review_not_authorized' using errcode='42501';
  end if;

  select * into v_submission
  from public.manual_payment_submissions
  where id = p_submission_id
  for update;
  if v_submission.id is null then
    raise exception 'submission_not_found' using errcode='P0002';
  end if;
  if v_submission.status <> 'submitted' then
    raise exception 'submission_already_reviewed' using errcode='23505';
  end if;

  select * into v_order
  from public.subscription_orders
  where id = v_submission.order_id
  for update;
  if v_order.id is null then
    raise exception 'order_not_found' using errcode='P0002';
  end if;

  if p_action = 'reject' then
    update public.manual_payment_submissions
    set status = 'rejected', reviewer_user_id = v_user_id, reviewed_at = now(),
        review_note = v_note, updated_at = now()
    where id = v_submission.id;

    insert into public.audit_logs(company_id, actor_user_id, event, metadata)
    values (v_submission.company_id, v_user_id, 'manual_payment.rejected',
      jsonb_build_object('submission_id',v_submission.id,'order_id',v_order.id,
        'reference',v_order.public_reference,'provider',v_submission.provider,
        'transaction_reference',v_submission.transaction_reference,'note',v_note));
    return jsonb_build_object('submission_id',v_submission.id,'status','rejected');
  end if;

  if v_order.status <> 'pending_payment' or v_order.paid_at is not null then
    raise exception 'order_not_payable' using errcode='23505';
  end if;
  if v_submission.amount <> v_order.amount or v_submission.currency <> v_order.currency then
    raise exception 'payment_amount_or_currency_mismatch' using errcode='22023';
  end if;

  v_provider := 'manual_' || v_submission.provider;
  insert into public.payments(company_id, order_id, provider, provider_payment_id,
    idempotency_key, amount, currency, status, confirmed_at)
  values (v_order.company_id, v_order.id, v_provider,
    'manual-submission:' || v_submission.id::text,
    'manual-payment-submission:' || v_submission.id::text,
    v_order.amount, v_order.currency, 'succeeded', now());

  update public.subscription_orders
  set status = 'paid', paid_at = coalesce(paid_at,now()), updated_at = now()
  where id = v_order.id;

  update public.manual_payment_submissions
  set status = 'approved', reviewer_user_id = v_user_id, reviewed_at = now(),
      review_note = v_note, updated_at = now()
  where id = v_submission.id;

  insert into public.audit_logs(company_id, actor_user_id, event, metadata)
  values (v_submission.company_id, v_user_id, 'manual_payment.approved',
    jsonb_build_object('submission_id',v_submission.id,'order_id',v_order.id,
      'payment_provider',v_provider,'reference',v_order.public_reference,
      'transaction_reference',v_submission.transaction_reference,
      'amount',v_order.amount,'currency',v_order.currency));

  return jsonb_build_object('submission_id',v_submission.id,'status','approved',
    'order_id',v_order.id,'order_status','paid');
end;
$$;

revoke all on function public.review_manual_payment_submission(uuid,text,text) from public, anon, authenticated;
grant execute on function public.review_manual_payment_submission(uuid,text,text) to authenticated;
