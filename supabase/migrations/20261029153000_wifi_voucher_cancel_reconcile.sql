
do $$
declare original_definition text; updated_definition text;
begin
 select pg_get_functiondef('network_internal.reconcile_wifi_vouchers()'::regprocedure) into original_definition;
 updated_definition:=replace(original_definition,
  'v.status=''expired'' and n.network_state','v.status in (''expired'',''cancelled'') and n.network_state');
 updated_definition:=replace(updated_definition,
  'r.status=''expired'' then','r.status in (''expired'',''cancelled'') then');
 if updated_definition=original_definition or updated_definition not like '%cancelled%' then
  raise exception 'Unable to update voucher reconciliation safely';
 end if;
 execute updated_definition;
end $$;
