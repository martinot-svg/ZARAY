-- Defense in depth: even a privileged API bug cannot store a site's draft or
-- published history under a different company.
-- Additive only; no existing site or portal data is rewritten.
create or replace function public.guard_site_portal_tenant()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
 if not exists (
  select 1 from public.sites s
  where s.id=new.site_id and s.company_id=new.company_id
 ) then
  raise exception 'site_tenant_mismatch' using errcode='23514';
 end if;
 return new;
end;
$$;

revoke all on function public.guard_site_portal_tenant()
 from public, anon, authenticated;
grant execute on function public.guard_site_portal_tenant() to service_role;

create trigger site_portal_configs_tenant_guard
 before insert or update on public.site_portal_configs
 for each row execute function public.guard_site_portal_tenant();

create trigger site_portal_versions_tenant_guard
 before insert or update on public.site_portal_versions
 for each row execute function public.guard_site_portal_tenant();
