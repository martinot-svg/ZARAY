-- Explicit per-site notification delegation for active site managers.
-- Never infer access merely from a company membership or a client-supplied siteId.
create table if not exists public.site_notification_assignments (
 company_id uuid not null references public.companies(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade,
 user_id uuid not null,
 assigned_by uuid references auth.users(id) on delete set null,
 assigned_at timestamptz not null default now(),
 primary key(company_id,site_id,user_id),
 constraint site_notification_assignment_member
  foreign key(company_id,user_id) references public.company_members(company_id,user_id)
  on delete cascade
);
create index if not exists site_notification_assignment_user_idx
 on public.site_notification_assignments(user_id,company_id,site_id);

create or replace function public.enforce_site_notification_assignment()
returns trigger language plpgsql security invoker set search_path=''
as $fn$
begin
 if not exists (
  select 1 from public.sites s
  where s.id=new.site_id and s.company_id=new.company_id
 ) then
  raise exception 'notification_site_outside_company' using errcode='23503';
 end if;
 if not exists (
  select 1 from public.company_members m
  where m.company_id=new.company_id and m.user_id=new.user_id
   and m.status='active' and m.role='site_manager'
 ) then
  raise exception 'site_manager_required' using errcode='42501';
 end if;
 return new;
end;
$fn$;
drop trigger if exists site_notification_assignment_guard on public.site_notification_assignments;
create trigger site_notification_assignment_guard
 before insert or update on public.site_notification_assignments
 for each row execute function public.enforce_site_notification_assignment();
alter table public.site_notification_assignments enable row level security;
revoke all on public.site_notification_assignments from public,anon,authenticated;
grant select,insert,update,delete on public.site_notification_assignments to service_role;
revoke all on function public.enforce_site_notification_assignment() from public,anon,authenticated;
