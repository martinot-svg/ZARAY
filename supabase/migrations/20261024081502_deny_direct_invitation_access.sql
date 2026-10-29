-- Reconstructed from the live invitation access policy and table privileges.
-- Invitation rows are only accessible through the guarded SECURITY DEFINER RPCs.
revoke all on public.company_invitations from public, anon, authenticated;
drop policy if exists "no direct access to company invitations" on public.company_invitations;
create policy "no direct access to company invitations" on public.company_invitations
for all to authenticated
using (false)
with check (false);
