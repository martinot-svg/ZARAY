-- Z’Alliance: additive invitation token security; preserve existing company invitation RPCs.
alter table public.company_invitations
  add column if not exists token_hash text,
  add column if not exists delivery_status text not null default 'not_sent',
  add column if not exists sent_at timestamptz,
  add column if not exists send_attempts integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists personal_message text;
alter table public.company_invitations
  add constraint zalliance_delivery_state_check check (delivery_status in ('not_sent','sent','failed')),
  add constraint zalliance_attempts_check check (send_attempts between 0 and 10),
  add constraint zalliance_personal_message_check check (personal_message is null or char_length(personal_message) <= 500),
  add constraint zalliance_token_hash_check check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$');
create unique index if not exists zalliance_unique_invitation_token_hash
  on public.company_invitations(token_hash) where token_hash is not null;

-- Only the existing role-checked, verified-email functions can issue invitations.
create or replace function public.zalliance_issue_invitation(
 p_company_id uuid, p_email text, p_role text, p_message text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_actor uuid := auth.uid(); v_role text; v_email text := lower(trim(p_email));
 v_token text; v_record public.company_invitations;
begin
 if v_actor is null or not exists(
   select 1 from auth.users where id=v_actor and email_confirmed_at is not null
 ) then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_role is null or p_role not in ('admin','site_manager','support','technician','sales','finance')
    or v_email is null or length(v_email)>254 or
       v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or coalesce(length(p_message),0)>500
 then raise exception 'invalid_invitation_data' using errcode='22023'; end if;
 select role into v_role from public.company_members
  where company_id=p_company_id and user_id=v_actor and status='active';
 if v_role is null or v_role not in ('owner','admin')
   or (v_role<>'owner' and p_role in ('admin','finance')) then
    raise exception 'permission_denied' using errcode='42501'; end if;
 -- Serialize invitations per company + address to prevent duplicate concurrent requests.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text||':'||v_email,0));
 if (select count(*) from public.audit_logs
     where actor_user_id=v_actor and event='zalliance.invitation_created'
       and created_at > now() - interval '1 hour') >= 20
 then raise exception 'too_many_invitations' using errcode='P0001'; end if;
 if exists (select 1 from public.company_members m join auth.users u on u.id=m.user_id
    where m.company_id=p_company_id and lower(u.email)=v_email and m.status='active')
 then raise exception 'already_member' using errcode='23505'; end if;
 update public.company_invitations set status='expired'
   where company_id=p_company_id and email=v_email and status='pending' and expires_at<=now();
 if exists (select 1 from public.company_invitations
    where company_id=p_company_id and email=v_email and status='pending')
 then raise exception 'invitation_pending' using errcode='23505'; end if;
 v_token := pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
 insert into public.company_invitations
   (company_id,email,role,invited_by,token_hash,delivery_status,send_attempts,last_attempt_at,personal_message)
 values(p_company_id,v_email,p_role,v_actor,
   pg_catalog.encode(extensions.digest(v_token,'sha256'),'hex'),'not_sent',1,now(),nullif(trim(p_message),''))
 returning * into v_record;
 insert into public.audit_logs(company_id,actor_user_id,event,metadata)
 values(p_company_id,v_actor,'zalliance.invitation_created',
   pg_catalog.jsonb_build_object('invitation_id',v_record.id,'role',v_record.role,'email',v_record.email));
 -- Token is returned only to the role-checked caller; the trusted API never relays it to the browser.
 return pg_catalog.jsonb_build_object('id',v_record.id,'token',v_token,'email',v_record.email,
   'company_id',v_record.company_id,'role',v_record.role,'expires_at',v_record.expires_at,'personal_message',v_record.personal_message);
end; $$;

create or replace function public.zalliance_list_invitations(p_company_id uuid)
 returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_role text; v_result jsonb;
begin
 if v_actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select role into v_role from public.company_members
  where company_id=p_company_id and user_id=v_actor and status='active';
 if v_role is null or v_role not in ('owner','admin') then
  raise exception 'permission_denied' using errcode='42501'; end if;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'id',i.id,'email',i.email,'role',i.role,
  'status',case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end,
  'delivery_status',i.delivery_status,'created_at',i.created_at,'expires_at',i.expires_at,
  'sent_at',i.sent_at,'accepted_at',i.accepted_at,'send_attempts',i.send_attempts
 ) order by i.created_at desc),'[]'::jsonb)
 into v_result from (select * from public.company_invitations where company_id=p_company_id
    order by created_at desc limit 100) i;
 return pg_catalog.jsonb_build_object('invitations',v_result);
end; $$;

create or replace function public.zalliance_resend_invitation(p_invitation_id uuid)
 returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_role text; v_inv public.company_invitations; v_token text;
begin
 if v_actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select * into v_inv from public.company_invitations where id=p_invitation_id for update;
 if not found then raise exception 'not_found' using errcode='P0002'; end if;
 select role into v_role from public.company_members
  where company_id=v_inv.company_id and user_id=v_actor and status='active';
 if v_role is null or v_role not in ('owner','admin')
   or (v_role<>'owner' and v_inv.role in ('admin','finance')) then
  raise exception 'permission_denied' using errcode='42501'; end if;
 if v_inv.status<>'pending' then raise exception 'not_pending' using errcode='22023'; end if;
 if v_inv.send_attempts>=5 or (v_inv.last_attempt_at is not null and v_inv.last_attempt_at>now()-interval '2 minutes') then
  raise exception 'retry_limited' using errcode='P0001'; end if;
 v_token := pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
 update public.company_invitations set token_hash=pg_catalog.encode(extensions.digest(v_token,'sha256'),'hex'),
   expires_at=now()+interval '7 days',delivery_status='not_sent',sent_at=null,
   last_attempt_at=now(),send_attempts=send_attempts+1
 where id=v_inv.id;
 insert into public.audit_logs(company_id,actor_user_id,event,metadata)
 values(v_inv.company_id,v_actor,'zalliance.invitation_reissued',
   pg_catalog.jsonb_build_object('invitation_id',v_inv.id));
 return pg_catalog.jsonb_build_object('id',v_inv.id,'token',v_token,'email',v_inv.email,
   'company_id',v_inv.company_id,'role',v_inv.role,'expires_at',now()+interval '7 days','personal_message',v_inv.personal_message);
end; $$;

-- Delivery is marked by the trusted server only. Comparing token hashes blocks stale race updates.
create or replace function public.zalliance_mark_delivery(p_invitation_id uuid,p_token_hash text,p_success boolean)
 returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
 if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return false; end if;
 update public.company_invitations set delivery_status=case when p_success then 'sent' else 'failed' end,
   sent_at=case when p_success then now() else null end
 where id=p_invitation_id and token_hash=p_token_hash and status='pending'
   and delivery_status='not_sent';
 get diagnostics v_count = row_count;
 return v_count=1;
end; $$;

create or replace function public.zalliance_accept_invitation(p_token text)
 returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_email text; v_hash text; v_inv public.company_invitations;
 v_company_name text;
begin
 if v_actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select lower(email) into v_email from auth.users where id=v_actor and email_confirmed_at is not null;
 if v_email is null then raise exception 'email_unverified' using errcode='42501'; end if;
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
  raise exception 'invitation_invalid' using errcode='42501'; end if;
 v_hash:=pg_catalog.encode(extensions.digest(p_token,'sha256'),'hex');
 select * into v_inv from public.company_invitations where token_hash=v_hash for update;
 if not found or v_inv.status<>'pending' or v_inv.expires_at<=now()
   or v_inv.email<>v_email or v_inv.delivery_status<>'sent'
 then raise exception 'invitation_invalid' using errcode='42501'; end if;
 insert into public.company_members(company_id,user_id,role,status)
 values(v_inv.company_id,v_actor,v_inv.role,'active') on conflict(company_id,user_id) do nothing;
 if not exists (select 1 from public.company_members
   where company_id=v_inv.company_id and user_id=v_actor and status='active')
 then raise exception 'membership_conflict' using errcode='23505'; end if;
 update public.company_invitations
 set status='accepted',accepted_at=now(),token_hash=null where id=v_inv.id;
 select legal_name into v_company_name from public.companies where id=v_inv.company_id;
 insert into public.audit_logs(company_id,actor_user_id,event,metadata)
 values(v_inv.company_id,v_actor,'zalliance.invitation_accepted',
  pg_catalog.jsonb_build_object('invitation_id',v_inv.id,'role',v_inv.role));
 return pg_catalog.jsonb_build_object('company_name',v_company_name,
  'company_id',v_inv.company_id,'role',v_inv.role);
end; $$;

create or replace function public.zalliance_revoke_invitation(p_invitation_id uuid)
 returns boolean language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_inv public.company_invitations; v_role text;
begin
 if v_actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select * into v_inv from public.company_invitations where id=p_invitation_id for update;
 if not found then raise exception 'not_found' using errcode='P0002'; end if;
 select role into v_role from public.company_members
 where company_id=v_inv.company_id and user_id=v_actor and status='active';
 if v_role is null or v_role not in ('owner','admin')
   or (v_role<>'owner' and v_inv.role in ('admin','finance')) then
  raise exception 'permission_denied' using errcode='42501'; end if;
 if v_inv.status<>'pending' then return false; end if;
 update public.company_invitations set status='revoked',token_hash=null where id=v_inv.id;
 insert into public.audit_logs(company_id,actor_user_id,event,metadata)
 values(v_inv.company_id,v_actor,'zalliance.invitation_revoked',
  pg_catalog.jsonb_build_object('invitation_id',v_inv.id));
 return true;
end; $$;

-- Recipient-only preview: read before consent, no membership mutation.
create or replace function public.zalliance_preview_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_email text; v_inv public.company_invitations; v_company_name text;
begin
 if v_actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select lower(email) into v_email from auth.users where id=v_actor and email_confirmed_at is not null;
 if v_email is null then raise exception 'email_unverified' using errcode='42501'; end if;
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'invitation_invalid' using errcode='42501'; end if;
 select * into v_inv from public.company_invitations
 where token_hash=pg_catalog.encode(extensions.digest(p_token,'sha256'),'hex');
 if not found or v_inv.email<>v_email or v_inv.status<>'pending' or
  v_inv.expires_at<=now() or v_inv.delivery_status<>'sent' then
  raise exception 'invitation_invalid' using errcode='42501'; end if;
 select legal_name into v_company_name from public.companies where id=v_inv.company_id;
 return pg_catalog.jsonb_build_object('company_name',v_company_name,
  'role',v_inv.role,'expires_at',v_inv.expires_at);
end; $$;

revoke all on function public.zalliance_preview_invitation(text) from public,anon,authenticated;
grant execute on function public.zalliance_preview_invitation(text) to authenticated;
revoke all on function public.zalliance_issue_invitation(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.zalliance_list_invitations(uuid) from public,anon,authenticated;
revoke all on function public.zalliance_resend_invitation(uuid) from public,anon,authenticated;
revoke all on function public.zalliance_mark_delivery(uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.zalliance_accept_invitation(text) from public,anon,authenticated;
revoke all on function public.zalliance_revoke_invitation(uuid) from public,anon,authenticated;
grant execute on function public.zalliance_issue_invitation(uuid,text,text,text) to authenticated;
grant execute on function public.zalliance_list_invitations(uuid) to authenticated;
grant execute on function public.zalliance_resend_invitation(uuid) to authenticated;
grant execute on function public.zalliance_accept_invitation(text) to authenticated;
grant execute on function public.zalliance_revoke_invitation(uuid) to authenticated;
grant execute on function public.zalliance_mark_delivery(uuid,text,boolean) to service_role;
 then
  raise exception 'invitation_invalid' using errcode='42501'; end if;
 select * into v_inv from public.company_invitations
 where token_hash=pg_catalog.encode(extensions.digest(p_token,'sha256'),'hex');
 if not found or v_inv.email<>v_email or v_inv.status<>'pending' or
  v_inv.expires_at<=now() or v_inv.delivery_status<>'sent' then
  raise exception 'invitation_invalid' using errcode='42501'; end if;
 select legal_name into v_company_name from public.companies where id=v_inv.company_id;
 return pg_catalog.jsonb_build_object('company_name',v_company_name,
  'role',v_inv.role,'expires_at',v_inv.expires_at);
end; $;

revoke all on function public.zalliance_preview_invitation(text) from public,anon,authenticated;
grant execute on function public.zalliance_preview_invitation(text) to authenticated;

revoke all on function public.zalliance_issue_invitation(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.zalliance_list_invitations(uuid) from public,anon,authenticated;
revoke all on function public.zalliance_resend_invitation(uuid) from public,anon,authenticated;
revoke all on function public.zalliance_mark_delivery(uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.zalliance_accept_invitation(text) from public,anon,authenticated;
revoke all on function public.zalliance_revoke_invitation(uuid) from public,anon,authenticated;
grant execute on function public.zalliance_issue_invitation(uuid,text,text,text) to authenticated;
grant execute on function public.zalliance_list_invitations(uuid) to authenticated;
grant execute on function public.zalliance_resend_invitation(uuid) to authenticated;
grant execute on function public.zalliance_accept_invitation(text) to authenticated;
grant execute on function public.zalliance_revoke_invitation(uuid) to authenticated;
grant execute on function public.zalliance_mark_delivery(uuid,text,boolean) to service_role;
