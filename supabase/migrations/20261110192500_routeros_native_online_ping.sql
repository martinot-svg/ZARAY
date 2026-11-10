-- ZARAY's online-only administration relies on a router-initiated HTTPS agent.
-- This feature flag is set only by the authenticated agent's capability poll,
-- never by user/browser writes. Existing scripts remain unsupported by default.
ALTER TABLE public.network_routers
 ADD COLUMN IF NOT EXISTS native_ping_supported boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.network_routers.native_ping_supported IS
 'Authenticated RouterOS native agent explicitly advertised bounded ping diagnostics.';
