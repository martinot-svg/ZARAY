-- ZARAY native web administration for ZARAY-owned DNS and VLAN entries.
-- No raw terminal, no blanket permissions, no alteration of existing unknown configuration.
CREATE TABLE IF NOT EXISTS public.network_managed_config_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL,
 router_id uuid NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES auth.users(id),
 category text NOT NULL CHECK(category IN ('dns-static','vlan')),
 operation text NOT NULL CHECK(operation IN ('create','update','enable','disable','delete')),
 target_id text,
 requested_values jsonb NOT NULL DEFAULT '{}'::jsonb,
 reason text NOT NULL CHECK(length(reason) BETWEEN 5 AND 220),
 status text NOT NULL DEFAULT 'queued'
  CHECK(status IN ('queued','dispatched','success','failed','manual_review')),
 created_at timestamptz NOT NULL DEFAULT now(),
 dispatched_at timestamptz,
 completed_at timestamptz,
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '10 minutes'),
 before_state jsonb,
 after_state jsonb,
 outcome text,
 CONSTRAINT network_managed_config_router_fk FOREIGN KEY(router_id,company_id)
  REFERENCES public.network_routers(id,company_id) ON DELETE CASCADE,
 CONSTRAINT network_managed_config_target_check CHECK(
  (operation='create' AND target_id IS NULL) OR
  (operation<>'create' AND target_id IS NOT NULL AND length(target_id) BETWEEN 2 AND 32)
 ),
 CONSTRAINT network_managed_config_values_check CHECK(
  jsonb_typeof(requested_values)='object' AND octet_length(requested_values::text)<=512
 ),
 CONSTRAINT network_managed_config_state_check CHECK(
  (before_state IS NULL OR (jsonb_typeof(before_state)='object' AND octet_length(before_state::text)<1024))
  AND
  (after_state IS NULL OR (jsonb_typeof(after_state)='object' AND octet_length(after_state::text)<1024))
 )
);
CREATE UNIQUE INDEX IF NOT EXISTS network_managed_config_exclusive_router_idx
 ON public.network_managed_config_jobs(router_id)
 WHERE status IN ('queued','dispatched','manual_review');
CREATE INDEX IF NOT EXISTS network_managed_config_company_recent_idx
 ON public.network_managed_config_jobs(company_id,router_id,created_at DESC);
ALTER TABLE public.network_managed_config_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.network_managed_config_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.network_managed_config_jobs TO authenticated;
DROP POLICY IF EXISTS network_managed_config_read_tenant ON public.network_managed_config_jobs;
CREATE POLICY network_managed_config_read_tenant
 ON public.network_managed_config_jobs FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.company_members m
  WHERE m.company_id=network_managed_config_jobs.company_id
   AND m.user_id=(SELECT auth.uid()) AND m.status='active'));
-- Only the server-side service role can queue and acknowledge. Each request is
-- re-authorized in Next.js and then checked again by the paired local agent.
