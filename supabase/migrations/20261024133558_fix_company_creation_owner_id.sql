-- Fix company creation: owner_user_id is required and the AFTER INSERT trigger creates membership/audit rows.
-- The RPC remains the only authenticated creation path; no existing rows are altered.
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

  select u.email_confirmed_at into v_confirmed_at
  from auth.users u
  where u.id = v_user_id;

  if v_confirmed_at is null then
    raise exception 'email_not_verified' using errcode = '42501';
  end if;

  if p_legal_name is null
     or char_length(trim(p_legal_name)) not between 2 and 160
     or p_slug is null
     or lower(trim(p_slug)) !~ '^[a-z0-9][a-z0-9-]{2,62}$' then
    raise exception 'invalid_company_input' using errcode = '22023';
  end if;

  insert into public.companies (legal_name, slug, owner_user_id)
  values (trim(p_legal_name), lower(trim(p_slug)), v_user_id)
  returning * into v_company;

  -- companies_after_insert_create_owner atomically creates the owner membership and audit entry.
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
