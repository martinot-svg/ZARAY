-- Manual Orange Money / MVola payments with private proof storage and audited approval.
create table if not exists public.manual_payment_methods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null check (provider in ('orange_money','mvola')),
  account_number text not null check (length(trim(account_number)) between 10 and 20),
  account_name text not null check (length(trim(account_name)) between 2 and 120),
  instructions text not null default '' check (length(instructions) <= 1000),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, provider)
);

create table if not exists public.manual_payment_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.subscription_orders(id) on delete restrict,
  provider text not null check (provider in ('orange_money','mvola')),
  sender_phone text not null check (sender_phone ~ '^03[0-9]{8}$'),
  transaction_reference text not null check (length(trim(transaction_reference)) between 2 and 120),
  amount numeric not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  proof_path text not null check (length(proof_path) between 1 and 500),
  customer_note text not null default '' check (length(customer_note) <= 1000),
  status text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text not null default '' check (length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manual_payment_submissions_company_status_created_idx
  on public.manual_payment_submissions(company_id, status, created_at desc);
create index if not exists manual_payment_submissions_order_created_idx
  on public.manual_payment_submissions(order_id, created_at desc);
create unique index if not exists manual_payment_one_open_or_approved_per_order_idx
  on public.manual_payment_submissions(order_id)
  where status in ('submitted','approved');
create unique index if not exists manual_payment_transaction_reference_unique_idx
  on public.manual_payment_submissions(provider, lower(trim(transaction_reference)));

alter table public.manual_payment_methods enable row level security;
alter table public.manual_payment_submissions enable row level security;
revoke all on public.manual_payment_methods from anon, authenticated;
revoke all on public.manual_payment_submissions from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manual-payment-proofs', 'manual-payment-proofs', false, 5242880,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
set public = false, file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

create or replace function public.get_public_manual_payment_methods(p_company_slug text)
returns table(provider text, account_number text, account_name text, instructions text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.provider, m.account_number, m.account_name, m.instructions
  from public.manual_payment_methods m
  join public.companies c on c.id = m.company_id
  where c.slug = lower(trim(coalesce(p_company_slug,'')))
    and m.is_active = true
  order by case m.provider when 'orange_money' then 1 else 2 end;
$$;
revoke all on function public.get_public_manual_payment_methods(text) from public;
grant execute on function public.get_public_manual_payment_methods(text) to anon, authenticated;

create or replace function public.review_manual_payment_submission(
  p_submission_id uuid,
  p_action text,
  p_review_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
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
  where cm.company_id = (select s.company_id from public.manual_payment_submissions s where s.id = p_submission_id)
    and cm.user_id = v_user_id and cm.status = 'active'
  limit 1;
  if v_role not in ('owner','admin') or v_role is null then
    raise exception 'role_not_authorized' using errcode='42501';
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
revoke all on function public.review_manual_payment_submission(uuid,text,text) from public, anon;
grant execute on function public.review_manual_payment_submission(uuid,text,text) to authenticated;
