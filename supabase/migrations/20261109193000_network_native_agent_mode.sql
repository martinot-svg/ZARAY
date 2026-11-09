-- RouterOS-native is optional and never enables control on existing installations.
-- This is diagnostic metadata, not an authorization bypass.
ALTER TABLE public.network_routers
 ADD COLUMN IF NOT EXISTS agent_kind text NOT NULL DEFAULT 'unreported';
ALTER TABLE public.network_routers
 DROP CONSTRAINT IF EXISTS network_routers_agent_kind_check;
ALTER TABLE public.network_routers
 ADD CONSTRAINT network_routers_agent_kind_check
 CHECK (agent_kind IN ('unreported','node-local','routeros-native'));
COMMENT ON COLUMN public.network_routers.agent_kind IS
 'Last authenticated connector implementation; does not imply connection or authorization.';
