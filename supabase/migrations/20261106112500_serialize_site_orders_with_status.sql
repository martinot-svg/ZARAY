-- Serialize new site orders with status transitions; a concurrent suspension
-- cannot slip in between eligibility check and order insertion.
create or replace function public.guard_order_site_is_active()
returns trigger language plpgsql set search_path='' as $$
declare v_active_id uuid;
begin
 if new.site_id is not null then
   select s.id into v_active_id from public.sites s
   where s.id=new.site_id and s.company_id=new.company_id
     and s.status='active'
   for share;
   if v_active_id is null then
     raise exception 'site_not_available' using errcode='23514';
   end if;
 end if;
 return new;
end;
$$;