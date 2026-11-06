-- New sites are created atomically together with their site-wide visual identity.
-- Existing sites remain unaffected: contact columns are nullable for legacy rows.
alter table public.sites add column if not exists address text;
alter table public.sites add column if not exists contact_email text;
alter table public.sites add column if not exists contact_phone text;
alter table public.ticket_templates add column if not exists email text;

alter table public.sites
 add constraint sites_contact_address_length check (address is null or char_length(address) between 3 and 160),
 add constraint sites_contact_email_format check (contact_email is null or (char_length(contact_email)<=254 and contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')),
 add constraint sites_contact_phone_length check (contact_phone is null or char_length(contact_phone) between 5 and 32);

create or replace function public.create_site_with_branding(
 p_company_id uuid,
 p_actor_user_id uuid,
 p_name text,
 p_address text,
 p_email text,
 p_phone text,
 p_logo_data_uri text,
 p_primary_color text,
 p_secondary_color text,
 p_accent_color text,
 p_title_color text,
 p_border_color text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 v_company_status text;
 v_site public.sites%rowtype;
 v_name text:=pg_catalog.btrim(p_name);
 v_address text:=pg_catalog.btrim(p_address);
 v_email text:=pg_catalog.lower(pg_catalog.btrim(p_email));
 v_phone text:=pg_catalog.btrim(p_phone);
begin
 -- Only the backend with the service_role token can invoke this function.
 -- It passes the currently authenticated, email-confirmed actor user ID.
 if p_actor_user_id is null or not exists(
    select 1 from auth.users u where u.id=p_actor_user_id and u.email_confirmed_at is not null
 ) then raise exception 'site_creator_unverified' using errcode='42501'; end if;
 if not exists(
   select 1 from public.company_members m where m.company_id=p_company_id
     and m.user_id=p_actor_user_id and m.status='active' and m.role in ('owner','admin')
 ) then raise exception 'site_creator_denied' using errcode='42501'; end if;
 select c.status into v_company_status from public.companies c
  where c.id=p_company_id for share;
 if v_company_status not in ('trial','active') or v_company_status is null then
   raise exception 'site_company_inactive' using errcode='23514'; end if;
 if v_name is null or v_name !~ '^[[:alnum:] .,''’()&-]{2,120}$'
    or v_address is null or char_length(v_address) not between 3 and 160
    or v_email is null or char_length(v_email)>254
    or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or v_phone is null or char_length(v_phone) not between 5 and 32
    or v_phone !~ '^[+0-9(). /-]+$'
 then raise exception 'site_fields_invalid' using errcode='22023'; end if;
 if p_logo_data_uri is null or char_length(p_logo_data_uri) not between 50 and 175000
    or p_logo_data_uri !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'
 then raise exception 'site_logo_invalid' using errcode='22023'; end if;
 if not (
  p_primary_color~'^#[0-9a-fA-F]{6}$'
  and p_secondary_color~'^#[0-9a-fA-F]{6}$'
  and p_accent_color~'^#[0-9a-fA-F]{6}$'
  and p_title_color~'^#[0-9a-fA-F]{6}$'
  and p_border_color~'^#[0-9a-fA-F]{6}$'
 ) then raise exception 'site_colors_invalid' using errcode='22023'; end if;
 -- The existing site audit trigger requires auth.uid(). Make the verified
 -- actor visible to that trigger within this database transaction only.
 perform pg_catalog.set_config('request.jwt.claim.sub',p_actor_user_id::text,true);
 insert into public.sites(company_id,name,status,address,contact_email,contact_phone)
 values(p_company_id,v_name,'planned',v_address,v_email,v_phone)
 returning * into v_site;
 insert into public.ticket_templates(
  company_id,site_id,offer_id,logo_data_uri,brand_name,
  address,phone,email,primary_color,secondary_color,accent_color,
  title_color,border_color,font_family,username_length,password_length,
  template_key,gradient_enabled,decorations_enabled,
  welcome_message,show_price,show_duration,show_ticket_id,show_wifi_ssid
 ) values(
  p_company_id,v_site.id,null,p_logo_data_uri,pg_catalog.left(v_name,90),
  v_address,v_phone,v_email,p_primary_color,p_secondary_color,p_accent_color,
  p_title_color,p_border_color,'Arial',5,5,
  'classic',false,true,'',true,true,false,false
 );
 return pg_catalog.jsonb_build_object('id',v_site.id,'company_id',v_site.company_id,
  'name',v_site.name,'status',v_site.status,'created_at',v_site.created_at,
  'address',v_address,'contact_email',v_email,'contact_phone',v_phone);
end;
$$;
revoke all on function public.create_site_with_branding(uuid,uuid,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_site_with_branding(uuid,uuid,text,text,text,text,text,text,text,text,text,text) to service_role;
