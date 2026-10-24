-- Correctly distinguish an unconfigured admin from an active reviewer grant.
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
    'authorized', (r.user_id is not null and r.revoked_at is null),
    'granted_at', case when r.revoked_at is null then r.granted_at else null end
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
