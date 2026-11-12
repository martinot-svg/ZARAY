-- Recovered from original GitHub commit a69adfb89ce6a19b2f730839c8e4c36f0cff2d57.
-- ZARAY: company membership administration, invitation acceptance and audited RBAC.
create table if not exists public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  email text not null check (email = lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  role text not null check (role in ('admin','site_manager','support','technician','sales','finance')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);
create index if not exists idx_company_invitations_company_status on public.company_invitations(company_id,status,created_at desc);
create index if not exists idx_company_invitations_email_status on public.company_invitations(email,status,expires_at);
create unique index if not exists idx_company_invitations_pending_unique on public.company_invitations(company_id,email) where status = 'pending';
alter table public.company_invitations enable row level security;
revoke all on public.company_invitations from public, anon, authenticated;

create or replace function public.list_company_members(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_role text; v_result jsonb;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select m.role into v_role from public.company_members m
   where m.company_id=p_company_id and m.user_id=v_user_id and m.status='active';
  if v_role is null then raise exception 'permission_denied' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',m.user_id,'email',u.email,'role',m.role,'status',m.status,'created_at',m.created_at
  ) order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, u.email),'[]'::jsonb)
  into v_result from public.company_members m join auth.users u on u.id=m.user_id
  where m.company_id=p_company_id;
  return jsonb_build_object('members',v_result,'current_role',v_role);
end; $$;

create or replace function public.list_my_company_invitations()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_email text; v_result jsonb;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select lower(u.email) into v_email from auth.users u
   where u.id=v_user_id and u.email_confirmed_at is not null;
  if v_email is null then raise exception 'email_not_verified' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'company_id',i.company_id,'company_name',c.legal_name,'role',i.role,'created_at',i.created_at,'expires_at',i.expires_at
  ) order by i.created_at desc),'[]'::jsonb)
  into v_result from public.company_invitations i join public.companies c on c.id=i.company_id
  where i.email=v_email and i.status='pending' and i.expires_at>now();
  return jsonb_build_object('invitations',v_result);
end; $$;

create or replace function public.create_company_invitation(p_company_id uuid,p_email text,p_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_actor_role text; v_email text := lower(trim(p_email)); v_inv public.company_invitations;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_role not in ('admin','site_manager','support','technician','sales','finance')
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_invitation_input' using errcode='22023';
  end if;
  if not exists(select 1 from auth.users u where u.id=v_user_id and u.email_confirmed_at is not null) then
    raise exception 'email_not_verified' using errcode='42501';
  end if;
  select m.role into v_actor_role from public.company_members m
   where m.company_id=p_company_id and m.user_id=v_user_id and m.status='active';
  if v_actor_role is null or v_actor_role not in ('owner','admin') then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  if v_actor_role <> 'owner' and p_role in ('admin','finance') then
    raise exception 'role_assignment_not_allowed' using errcode='42501';
  end if;
  if exists(select 1 from public.company_members m join auth.users u on u.id=m.user_id
     where m.company_id=p_company_id and lower(u.email)=v_email and m.status='active') then
    raise exception 'user_already_member' using errcode='23505';
  end if;
  insert into public.company_invitations(company_id,email,role,invited_by)
  values(p_company_id,v_email,p_role,v_user_id)
  on conflict (company_id,email) where status='pending'
  do update set role=excluded.role, invited_by=excluded.invited_by,
    created_at=now(), expires_at=now()+interval '7 days'
  returning * into v_inv;
  insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(p_company_id,v_user_id,'member.invitation_created',
    jsonb_build_object('invitation_id',v_inv.id,'email',v_inv.email,'role',v_inv.role));
  return jsonb_build_object('id',v_inv.id,'email',v_inv.email,'role',v_inv.role,'status',v_inv.status,'expires_at',v_inv.expires_at);
end; $$;

create or replace function public.accept_company_invitation(p_invitation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_email text; v_inv public.company_invitations; v_company_name text;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select lower(u.email) into v_email from auth.users u
   where u.id=v_user_id and u.email_confirmed_at is not null;
  if v_email is null then raise exception 'email_not_verified' using errcode='42501'; end if;
  select * into v_inv from public.company_invitations i where i.id=p_invitation_id for update;
  if not found or v_inv.email<>v_email or v_inv.status<>'pending' or v_inv.expires_at<=now() then
    raise exception 'invitation_invalid_or_expired' using errcode='42501';
  end if;
  insert into public.company_members(company_id,user_id,role,status)
  values(v_inv.company_id,v_user_id,v_inv.role,'active')
  on conflict(company_id,user_id) do nothing;
  if not exists(select 1 from public.company_members m where m.company_id=v_inv.company_id and m.user_id=v_user_id and m.status='active') then
    raise exception 'membership_conflict' using errcode='23505';
  end if;
  update public.company_invitations set status='accepted',accepted_at=now() where id=v_inv.id;
  select c.legal_name into v_company_name from public.companies c where c.id=v_inv.company_id;
  insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(v_inv.company_id,v_user_id,'member.invitation_accepted',
    jsonb_build_object('invitation_id',v_inv.id,'role',v_inv.role));
  return jsonb_build_object('company_id',v_inv.company_id,'company_name',v_company_name,'role',v_inv.role);
end; $$;

create or replace function public.update_company_member(p_company_id uuid,p_member_user_id uuid,p_role text,p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_actor_role text; v_target public.company_members; v_new_role text:=p_role; v_new_status text:=p_status;
begin
  if v_actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if v_new_role not in ('owner','admin','site_manager','support','technician','sales','finance')
     or v_new_status not in ('active','suspended') then
    raise exception 'invalid_member_update' using errcode='22023';
  end if;
  select m.role into v_actor_role from public.company_members m
   where m.company_id=p_company_id and m.user_id=v_actor and m.status='active';
  if v_actor_role not in ('owner','admin') or v_actor_role is null then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  select * into v_target from public.company_members m
   where m.company_id=p_company_id and m.user_id=p_member_user_id for update;
  if not found then raise exception 'member_not_found' using errcode='P0002'; end if;
  if v_target.role='owner' or p_member_user_id=v_actor then
    raise exception 'owner_or_self_change_forbidden' using errcode='42501';
  end if;
  if v_actor_role<>'owner' and (v_target.role='admin' or v_new_role in ('owner','admin','finance')) then
    raise exception 'role_assignment_not_allowed' using errcode='42501';
  end if;
  if v_new_role='owner' then raise exception 'owner_transfer_requires_dedicated_flow' using errcode='42501'; end if;
  update public.company_members set role=v_new_role,status=v_new_status
   where company_id=p_company_id and user_id=p_member_user_id;
  insert into public.audit_logs(company_id,actor_user_id,event,metadata)
  values(p_company_id,v_actor,'member.updated',jsonb_build_object(
    'member_user_id',p_member_user_id,'old_role',v_target.role,'new_role',v_new_role,
    'old_status',v_target.status,'new_status',v_new_status));
  return jsonb_build_object('user_id',p_member_user_id,'role',v_new_role,'status',v_new_status);
end; $$;

create or replace function public.list_company_audit_logs(p_company_id uuid,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid:=auth.uid(); v_role text; v_result jsonb;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select m.role into v_role from public.company_members m
   where m.company_id=p_company_id and m.user_id=v_user_id and m.status='active';
  if v_role is null or v_role not in ('owner','admin','finance') then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'event',a.event,'actor_email',u.email,'metadata',a.metadata,'created_at',a.created_at
  ) order by a.created_at desc),'[]'::jsonb)
  into v_result from (
    select * from public.audit_logs where company_id=p_company_id order by created_at desc limit greatest(1,least(coalesce(p_limit,50),100))
  ) a left join auth.users u on u.id=a.actor_user_id;
  return jsonb_build_object('events',v_result);
end; $$;

revoke all on function public.list_company_members(uuid) from public,anon,authenticated;
revoke all on function public.list_my_company_invitations() from public,anon,authenticated;
revoke all on function public.create_company_invitation(uuid,text,text) from public,anon,authenticated;
revoke all on function public.accept_company_invitation(uuid) from public,anon,authenticated;
revoke all on function public.update_company_member(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.list_company_audit_logs(uuid,integer) from public,anon,authenticated;
grant execute on function public.list_company_members(uuid) to authenticated;
grant execute on function public.list_my_company_invitations() to authenticated;
grant execute on function public.create_company_invitation(uuid,text,text) to authenticated;
grant execute on function public.accept_company_invitation(uuid) to authenticated;
grant execute on function public.update_company_member(uuid,uuid,text,text) to authenticated;
grant execute on function public.list_company_audit_logs(uuid,integer) to authenticated;
