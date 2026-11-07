-- Unified, tenant-scoped dual logo library. Legacy ticket_templates logo remains
-- intact and is kept as a compatibility snapshot for older portals.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('zaray-site-logo-originals','zaray-site-logo-originals',false,15728640,
 array['image/png','image/svg+xml','image/webp']::text[])
on conflict (id) do nothing;

create unique index if not exists sites_id_company_unique_for_logo
 on public.sites(id,company_id);

create table if not exists public.site_brand_assets (
 site_id uuid primary key,
 company_id uuid not null,
 light_original_path text not null,
 dark_original_path text not null,
 light_data_uri text not null,
 dark_data_uri text not null,
 updated_at timestamptz not null default now(),
 constraint site_brand_assets_site_tenant_fk foreign key(site_id,company_id)
  references public.sites(id,company_id) on delete cascade,
 constraint site_brand_light_preview_valid check
  (char_length(light_data_uri) between 30 and 175000 and
   light_data_uri ~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'),
 constraint site_brand_dark_preview_valid check
  (char_length(dark_data_uri) between 30 and 175000 and
   dark_data_uri ~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'),
 constraint site_brand_light_path_valid check
  (char_length(light_original_path) between 60 and 250 and
   light_original_path !~ '[[:space:]]'),
 constraint site_brand_dark_path_valid check
  (char_length(dark_original_path) between 60 and 250 and
   dark_original_path !~ '[[:space:]]')
);
create index if not exists site_brand_assets_company_idx on public.site_brand_assets(company_id);
alter table public.site_brand_assets enable row level security;
revoke all on table public.site_brand_assets from public, anon, authenticated;
grant select,insert,update,delete on table public.site_brand_assets to service_role;

-- Wrap the verified existing site creation RPC in one transaction, adding
-- both logo versions without making an incompletely configured site visible.
create or replace function public.create_site_with_logo_variants(
 p_company_id uuid,p_actor_user_id uuid,p_name text,p_address text,
 p_email text,p_phone text,p_light_data_uri text,p_dark_data_uri text,
 p_light_path text,p_dark_path text,
 p_primary_color text,p_secondary_color text,p_accent_color text,
 p_title_color text,p_border_color text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_site jsonb;
begin
 if p_light_path=p_dark_path or
    p_light_data_uri is null or p_dark_data_uri is null or
    char_length(p_light_data_uri)>175000 or char_length(p_dark_data_uri)>175000 then
  raise exception 'site_logos_invalid' using errcode='22023';
 end if;
 -- Existing RPC validates the actor, company membership, contact fields,
 -- origin signature and corporate colors, and atomically creates template.
 v_site:=public.create_site_with_branding(
  p_company_id,p_actor_user_id,p_name,p_address,p_email,p_phone,
  p_light_data_uri,p_primary_color,p_secondary_color,p_accent_color,
  p_title_color,p_border_color);
 insert into public.site_brand_assets(
  company_id,site_id,light_original_path,dark_original_path,light_data_uri,dark_data_uri)
 values(p_company_id,(v_site->>'id')::uuid,p_light_path,p_dark_path,p_light_data_uri,p_dark_data_uri);
 return v_site;
end;
$$;
revoke all on function public.create_site_with_logo_variants(
 uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text)
 from public, anon, authenticated;
grant execute on function public.create_site_with_logo_variants(
 uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text)
 to service_role;

-- Updated variants are validated before entering the RPC. Never modify
-- one site or template belonging to a different tenant.
create or replace function public.update_site_logo_variants(
 p_company_id uuid,p_site_id uuid,p_actor_user_id uuid,
 p_light_path text,p_dark_path text,p_light_data_uri text,p_dark_data_uri text
) returns boolean
language plpgsql security definer set search_path=''
as $$
begin
 if not exists(select 1 from auth.users u
    where u.id=p_actor_user_id and u.email_confirmed_at is not null) or
    not exists(select 1 from public.company_members m
      where m.company_id=p_company_id and m.user_id=p_actor_user_id
       and m.status='active' and m.role in ('owner','admin')) or
    not exists(select 1 from public.sites s
      where s.id=p_site_id and s.company_id=p_company_id) then
  raise exception 'site_logo_access_denied' using errcode='42501';
 end if;
 if p_light_path=p_dark_path or
    char_length(p_light_data_uri) not between 30 and 175000 or
    char_length(p_dark_data_uri) not between 30 and 175000 or
    p_light_data_uri !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' or
    p_dark_data_uri !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' then
  raise exception 'site_logo_invalid' using errcode='22023';
 end if;
 update public.ticket_templates set
  logo_data_uri=p_light_data_uri,updated_at=now()
  where company_id=p_company_id and site_id=p_site_id and offer_id is null;
 if not found then
  raise exception 'site_default_template_missing' using errcode='23503';
 end if;
 insert into public.site_brand_assets(company_id,site_id,
  light_original_path,dark_original_path,light_data_uri,dark_data_uri)
 values(p_company_id,p_site_id,p_light_path,p_dark_path,p_light_data_uri,p_dark_data_uri)
 on conflict(site_id) do update set
  light_original_path=excluded.light_original_path,
  dark_original_path=excluded.dark_original_path,
  light_data_uri=excluded.light_data_uri,
  dark_data_uri=excluded.dark_data_uri,
  updated_at=now()
 where public.site_brand_assets.company_id=excluded.company_id;
 return true;
end;
$$;
revoke all on function public.update_site_logo_variants(
 uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.update_site_logo_variants(
 uuid,uuid,uuid,text,text,text,text) to service_role;
