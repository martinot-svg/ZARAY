-- Harden public checkout RPC search_path and provide a database-backed reviewer access check.
create or replace function public.get_public_manual_payment_methods(p_company_slug text)
returns table(provider text, account_number text, account_name text, instructions text)
language sql
stable
security definer
set search_path = ''
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
  if v_user_id is null or p_company_id is null then
    return false;
  end if;

  select cm.role into v_role
  from public.company_members cm
  where cm.company_id = p_company_id
    and cm.user_id = v_user_id
    and cm.status = 'active';

  if v_role = 'owner' then
    return true;
  end if;

  if v_role <> 'admin' then
    return false;
  end if;

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
