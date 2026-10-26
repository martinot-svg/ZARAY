revoke execute on function public.create_walkin_sale(uuid,uuid,uuid,text,text,text,text,text,text) from public;
revoke execute on function public.create_walkin_sale(uuid,uuid,uuid,text,text,text,text,text,text) from anon;
grant execute on function public.create_walkin_sale(uuid,uuid,uuid,text,text,text,text,text,text) to authenticated;
