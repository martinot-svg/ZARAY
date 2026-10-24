-- Restrict direct audit-log reads to explicitly authorized company roles.
drop policy if exists "members can read company audit logs" on public.audit_logs;
create policy "authorized roles can read company audit logs" on public.audit_logs
  for select to authenticated
  using (
    company_id is not null and exists (
      select 1 from public.company_members m
      where m.company_id = audit_logs.company_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role in ('owner','admin','finance')
    )
  );
