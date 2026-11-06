-- Company lifecycle: this flag distinguishes a voluntary pause from a
-- subscription/billing suspension that must not be overridden by administrators.
alter table public.companies
 add column if not exists lifecycle_previous_status text
 check (lifecycle_previous_status is null or lifecycle_previous_status in ('trial','active','grace'));

create or replace function public.manage_company_lifecycle(
 p_company_id uuid,p_action text,p_confirmation text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid := auth.uid();
 v_company public.companies%rowtype;
 v_role text;
 v_next text;
 v_fk record;
 v_has_rows boolean;
begin
 if v_actor is null or not exists(
    select 1 from auth.users u where u.id=v_actor and u.email_confirmed_at is not null
 ) then raise exception 'company_auth_required' using errcode='42501'; end if;
 select m.role into v_role from public.company_members m
  where m.company_id=p_company_id and m.user_id=v_actor and m.status='active';
 if v_role not in ('owner','admin') or v_role is null
 then raise exception 'company_permission_denied' using errcode='42501'; end if;
 select * into v_company from public.companies c where c.id=p_company_id for update;
 if v_company.id is null then raise exception 'company_not_found' using errcode='P0002'; end if;

 if p_action='deactivate' then
  if v_company.status not in ('trial','active','grace') then
    raise exception 'company_not_eligible_for_pause' using errcode='P0001';
  end if;
  update public.companies set status='suspended',
    lifecycle_previous_status=v_company.status,updated_at=now()
    where id=p_company_id;
  insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(p_company_id,v_actor,'company.deactivated',
    pg_catalog.jsonb_build_object('previous_status',v_company.status));
  return pg_catalog.jsonb_build_object('status','suspended','changed',true);

 elsif p_action='reactivate' then
  if v_company.status<>'suspended' or v_company.lifecycle_previous_status is null then
    raise exception 'company_not_reactivatable' using errcode='P0001';
  end if;
  v_next=v_company.lifecycle_previous_status;
  -- Reopening an expired trial does not renew the trial or bypass billing.
  if v_next='trial' and v_company.trial_ends_at<=now() then v_next='grace'; end if;
  update public.companies set status=v_next,
    lifecycle_previous_status=null,updated_at=now() where id=p_company_id;
  insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(p_company_id,v_actor,'company.reactivated',
    pg_catalog.jsonb_build_object('new_status',v_next));
  return pg_catalog.jsonb_build_object('status',v_next,'changed',true);

 elsif p_action='delete' then
  if v_role<>'owner' or v_company.owner_user_id is distinct from v_actor
    then raise exception 'company_owner_required' using errcode='42501'; end if;
  if v_company.status<>'suspended' or v_company.lifecycle_previous_status is null then
    raise exception 'company_must_be_paused_first' using errcode='P0001'; end if;
  if p_confirmation is distinct from v_company.legal_name then
    raise exception 'company_confirmation_incorrect' using errcode='22023'; end if;
  if exists(select 1 from public.company_members m where m.company_id=p_company_id
      and (m.user_id<>v_actor or m.role<>'owner'))
    then raise exception 'company_has_other_members' using errcode='23503'; end if;

  -- Block deletion whenever ANY table (including future tables) references
  -- this company, apart from the owner's membership and retained audit rows.
  for v_fk in
    select distinct cls.relname as table_name,ns.nspname as schema_name,
     att.attname as column_name
    from pg_catalog.pg_constraint co
    join pg_catalog.pg_class cls on cls.oid=co.conrelid
    join pg_catalog.pg_namespace ns on ns.oid=cls.relnamespace
    join pg_catalog.pg_attribute att on att.attrelid=co.conrelid
      and att.attnum=co.conkey[1]
    where co.contype='f' and co.confrelid='public.companies'::regclass
      and pg_catalog.array_length(co.conkey,1)=1
      and ns.nspname='public'
      and cls.relname not in ('company_members','audit_logs')
  loop
    execute pg_catalog.format('select exists(select 1 from %I.%I where %I=$1)',
      v_fk.schema_name,v_fk.table_name,v_fk.column_name)
      into v_has_rows using p_company_id;
    if v_has_rows then
      raise exception 'company_has_business_records' using errcode='23503'; end if;
  end loop;
  insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(p_company_id,v_actor,'company.deleted',pg_catalog.jsonb_build_object(
    'company_id',p_company_id,'name',v_company.legal_name,'slug',v_company.slug));
  -- Preserve immutable audit history while allowing the company FK to vanish.
  update public.audit_logs set company_id=null where company_id=p_company_id;
  delete from public.company_members where company_id=p_company_id;
  delete from public.companies where id=p_company_id;
  if not found then raise exception 'company_not_found' using errcode='P0002'; end if;
  return pg_catalog.jsonb_build_object('deleted',true,'company_id',p_company_id);
 end if;
 raise exception 'invalid_company_action' using errcode='22023';
end;
$$;
revoke all on function public.manage_company_lifecycle(uuid,text,text) from public,anon,authenticated;
grant execute on function public.manage_company_lifecycle(uuid,text,text) to authenticated;

