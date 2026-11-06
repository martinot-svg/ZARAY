-- Enforce site lifecycle status at database level, including direct API calls.
-- Status changes require an active owner/admin of the same company.
create or replace function public.guard_site_lifecycle_status()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_actor uuid := auth.uid();
begin
 if new.status is distinct from old.status then
   if new.status not in ('planned','active','suspended','archived') then
      raise exception 'site_invalid_status' using errcode='22023';
   end if;
   if v_actor is null then
     -- Trusted migrations / service-role maintenance, not anonymous web users.
     if session_user <> 'postgres'
       and coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then
       raise exception 'site_status_requires_admin' using errcode='42501';
     end if;
   elsif not exists (
      select 1 from public.company_members m
      where m.user_id=v_actor and m.company_id=old.company_id
        and m.status='active' and m.role in ('owner','admin')
   ) then
      raise exception 'site_status_requires_admin' using errcode='42501';
   end if;
 end if;
 return new;
end;
$$;
drop trigger if exists sites_lifecycle_authorization on public.sites;
create trigger sites_lifecycle_authorization
before update of status on public.sites
for each row execute function public.guard_site_lifecycle_status();

-- Public catalogue must never advertise a site that cannot take new orders.
create or replace function public.get_public_residential_sites(p_company_slug text)
returns table(site_id uuid,site_name text,site_status text)
language sql stable security definer set search_path=''
as $$
 select s.id,s.name,s.status
 from public.sites s
 join public.companies c on c.id=s.company_id
 where c.slug=pg_catalog.lower(pg_catalog.btrim(p_company_slug))
   and c.status in ('trial','active')
   and s.status='active'
 order by s.name,s.id limit 100;
$$;

-- Server-enforced checkout rule, including existing RPCs and direct inserts.
create or replace function public.guard_order_site_is_active()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.site_id is not null and not exists (
   select 1 from public.sites s
   where s.id=new.site_id and s.company_id=new.company_id
     and s.status='active'
 ) then
   raise exception 'site_not_available' using errcode='23514';
 end if;
 return new;
end;
$$;
drop trigger if exists subscription_order_active_site on public.subscription_orders;
create trigger subscription_order_active_site
before insert on public.subscription_orders
for each row execute function public.guard_order_site_is_active();
