-- Keep the production Supabase migration history aligned with the canonical company schema.
-- Company creation must go through this SECURITY DEFINER RPC because direct table writes are denied by RLS.

create or replace function public.create_company_for_current_user(p_legal_name text, p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_confirmed_at timestamptz;
  v_company public.companies;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select u.email_confirmed_at
    into v_confirmed_at
  from auth.users u
  where u.id = v_user_id;

  if v_confirmed_at is null then
    raise exception 'email_not_verified' using errcode = '42501';
  end if;

  if p_legal_name is null
     or char_length(trim(p_legal_name)) not between 2 and 160
     or p_slug is null
     or p_slug !~ '^[a-z0-9][a-z0-9-]{2,62}$' then
    raise exception 'invalid_company_input' using errcode = '22023';
  end if;

  insert into public.companies (legal_name, slug)
  values (trim(p_legal_name), lower(trim(p_slug)))
  returning * into v_company;

  insert into public.company_members (company_id, user_id, role, status)
  values (v_company.id, v_user_id, 'owner', 'active');

  insert into public.audit_logs (company_id, actor_user_id, event, metadata)
  values (
    v_company.id,
    v_user_id,
    'company.created',
    jsonb_build_object('company_id', v_company.id)
  );

  return jsonb_build_object(
    'id', v_company.id,
    'legal_name', v_company.legal_name,
    'slug', v_company.slug,
    'status', v_company.status,
    'trial_ends_at', v_company.trial_ends_at
  );
end;
$$;

revoke all on function public.create_company_for_current_user(text, text) from public, anon, authenticated;
grant execute on function public.create_company_for_current_user(text, text) to authenticated;
