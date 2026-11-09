-- Read-only router resource metrics for ZARAY's integrated WinBox-style diagnostics.
-- The authenticated app sees tenant-scoped statistics; only the privileged connector API writes.
CREATE TABLE IF NOT EXISTS public.network_router_resources (
 router_id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 cpu_load_percent integer NOT NULL CHECK(cpu_load_percent BETWEEN 0 AND 100),
 total_memory_bytes bigint NOT NULL CHECK(total_memory_bytes >= 0),
 free_memory_bytes bigint NOT NULL CHECK(free_memory_bytes >= 0 AND free_memory_bytes <= total_memory_bytes),
 router_uptime text NOT NULL CHECK(length(router_uptime) BETWEEN 1 AND 64),
 observed_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (router_id,company_id)
   REFERENCES public.network_routers(id,company_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS network_router_resources_company_idx
 ON public.network_router_resources(company_id,observed_at DESC);
ALTER TABLE public.network_router_resources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.network_router_resources FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.network_router_resources TO authenticated;
DROP POLICY IF EXISTS network_router_resources_tenant_read ON public.network_router_resources;
CREATE POLICY network_router_resources_tenant_read
 ON public.network_router_resources FOR SELECT TO authenticated
 USING (EXISTS(
  SELECT 1 FROM public.company_members m
  WHERE m.company_id=network_router_resources.company_id
  AND m.user_id=(SELECT auth.uid()) AND m.status='active'
 ));
