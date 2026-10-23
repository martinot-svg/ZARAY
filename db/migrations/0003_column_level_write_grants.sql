-- Restrict authenticated writes to the exact fields the application is allowed to set.
revoke insert on public.companies from authenticated;
grant insert (legal_name, slug, owner_user_id) on public.companies to authenticated;

revoke insert, update on public.sites from authenticated;
grant insert (company_id, name) on public.sites to authenticated;
grant update (name, status) on public.sites to authenticated;
