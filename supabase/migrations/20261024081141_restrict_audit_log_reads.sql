-- Reconstructed from the live audit-log policy and grants.
-- Audit records are readable only by active owner/admin/finance members of that company.
revoke all on public.audit_logs from public, anon, authenticated;
grant select on public.audit_logs to authenticated;

drop policy if exists "authorized roles can read company audit logs" on public.audit_logs;
create policy "authorized roles can read company audit logs" on public.audit_logs
for select to authenticated
using (
  company_id is not null
  and exists (
    select 1
    from public.company_members m
    where m.company_id = audit_logs.company_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner','admin','finance')
  )
);
