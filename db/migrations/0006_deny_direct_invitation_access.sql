-- Explicit deny policy documents that invitation rows are only accessed through audited RPCs.
drop policy if exists "no direct access to company invitations" on public.company_invitations;
create policy "no direct access to company invitations" on public.company_invitations
  for all to authenticated using (false) with check (false);
