-- Recovered from original GitHub commit eb46fa1f4ce0d2b8bdc01fa84392a80483a74051.
-- Replace public mutation RPCs with RLS-governed inserts/updates and private trigger functions.
-- All tables must remain empty of sample/demo business data.

alter table public.companies add column if not exists owner_user_id uuid references auth.users(id) on delete restrict;

update public.companies c
set owner_user_id = m.user_id
from public.company_members m
where m.company_id = c.id and m.role = 'owner' and c.owner_user_id is null;

alter table public.companies alter column owner_user_id set not null;

create or replace function public.on_company_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> new.owner_user_id then
    raise exception 'owner_must_be_current_user' using errcode = '42501';
  end if;

  insert into public.company_members (company_id, user_id, role, status)
  values (new.id, new.owner_user_id, 'owner', 'active');

  insert into public.audit_logs (company_id, actor_user_id, event, metadata)
  values (new.id, new.owner_user_id, 'company.created', jsonb_build_object('company_id', new.id));
  return new;
end;
$$;

drop trigger if exists companies_after_insert_create_owner on public.companies;
create trigger companies_after_insert_create_owner
after insert on public.companies
for each row execute function public.on_company_created();

create or replace function public.audit_site_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if tg_op = 'INSERT' then v_event := 'site.created'; else v_event := 'site.updated'; end if;

  insert into public.audit_logs (company_id, actor_user_id, event, metadata)
  values (new.company_id, auth.uid(), v_event,
    jsonb_build_object('site_id', new.id, 'site_name', new.name, 'status', new.status));
  return new;
end;
$$;

drop trigger if exists sites_audit_insert on public.sites;
create trigger sites_audit_insert after insert on public.sites
for each row execute function public.audit_site_mutation();

drop trigger if exists sites_audit_update on public.sites;
create trigger sites_audit_update after update on public.sites
for each row execute function public.audit_site_mutation();

drop policy if exists "users can create their own company" on public.companies;
create policy "users can create their own company" on public.companies
  for insert to authenticated with check (owner_user_id = (select auth.uid()));

drop policy if exists "members can create sites with edit role" on public.sites;
create policy "members can create sites with edit role" on public.sites
  for insert to authenticated
  with check (exists (
    select 1 from public.company_members m
    where m.company_id = sites.company_id and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role in ('owner', 'admin', 'site_manager')
  ));

drop policy if exists "members can update sites with edit role" on public.sites;
create policy "members can update sites with edit role" on public.sites
  for update to authenticated
  using (exists (
    select 1 from public.company_members m
    where m.company_id = sites.company_id and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role in ('owner', 'admin', 'site_manager')
  ))
  with check (exists (
    select 1 from public.company_members m
    where m.company_id = sites.company_id and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role in ('owner', 'admin', 'site_manager')
  ));

grant insert on public.companies to authenticated;
grant insert, update on public.sites to authenticated;

revoke all on function public.on_company_created() from public, anon, authenticated;
revoke all on function public.audit_site_mutation() from public, anon, authenticated;
drop function if exists public.create_company_for_current_user(text, text);
drop function if exists public.create_site_for_current_user(uuid, text);
drop function if exists public.update_site_for_current_user(uuid, text, text);
