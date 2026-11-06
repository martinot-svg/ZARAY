-- Irreversible site deletion is allowed ONLY when historical business
-- records and physical router bindings do not exist. Other tenants are untouched.
-- SECURITY DEFINER is necessary because public.sites has no DELETE policy;
-- access is verified explicitly using the authenticated caller and tenant.
create or replace function public.delete_company_site(
 p_company_id uuid,
 p_site_id uuid,
 p_confirmation text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_user uuid := auth.uid();
 v_site public.sites%rowtype;
begin
 if v_user is null or not exists (
   select 1 from auth.users u
   where u.id=v_user and u.email_confirmed_at is not null
 ) then
   raise exception 'site_auth_required' using errcode='42501';
 end if;
 if not exists (
   select 1 from public.company_members m
   where m.company_id=p_company_id
     and m.user_id=v_user
     and m.status='active'
     and m.role in ('owner','admin')
 ) then
   raise exception 'site_permission_denied' using errcode='42501';
 end if;
 select s.* into v_site
 from public.sites s
 where s.id=p_site_id and s.company_id=p_company_id
 for update;
 if v_site.id is null then
   raise exception 'site_not_found' using errcode='P0002';
 end if;
 if v_site.status='active' then
   raise exception 'site_must_be_inactive' using errcode='P0001';
 end if;
 if p_confirmation is distinct from v_site.name then
   raise exception 'site_name_confirmation_mismatch' using errcode='22023';
 end if;
 -- Never silently erase customer, payment, voucher, network or communication
 -- history, or a router binding that may still be running outside ZARAY.
 if exists (select 1 from public.customers c where c.site_id=p_site_id)
 or exists (select 1 from public.residential_subscriptions r where r.site_id=p_site_id)
 or exists (select 1 from public.subscription_orders o where o.site_id=p_site_id)
 or exists (select 1 from public.wifi_vouchers v where v.site_id=p_site_id)
 or exists (select 1 from public.wifi_voucher_sales vs where vs.site_id=p_site_id)
 or exists (select 1 from public.wifi_voucher_network vn where vn.site_id=p_site_id)
 or exists (select 1 from public.wifi_voucher_activations va where va.site_id=p_site_id)
 or exists (select 1 from public.walkin_sales ws where ws.site_id=p_site_id)
 or exists (select 1 from public.network_routers nr where nr.site_id=p_site_id)
 or exists (select 1 from public.site_notifications sn where sn.site_id=p_site_id)
 or exists (select 1 from public.residential_notification_email_jobs ej where ej.site_id=p_site_id)
 -- External DNS/host associations require a separate host removal.
 or exists (select 1 from public.site_custom_domains d where d.site_id=p_site_id and d.status='active')
 or exists (select 1 from public.site_public_links l where l.site_id=p_site_id and l.public_hostname is not null)
 then
   raise exception 'site_has_business_records' using errcode='23503';
 end if;
 -- In this one transaction, FK cascades remove only site configuration
 -- (ticket templates, aliases and non-historical site preferences).
 insert into public.audit_logs(company_id,actor_user_id,event,metadata)
 values(p_company_id,v_user,'site.deleted',
  pg_catalog.jsonb_build_object('site_id',p_site_id,'site_name',v_site.name,'previous_status',v_site.status));
 delete from public.sites where id=p_site_id and company_id=p_company_id;
 if not found then
   raise exception 'site_not_found' using errcode='P0002';
 end if;
 return pg_catalog.jsonb_build_object('deleted',true,'site_id',p_site_id);
end;
$$;
revoke all on function public.delete_company_site(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.delete_company_site(uuid,uuid,text) to authenticated;
