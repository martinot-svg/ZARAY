-- ZARAY's online-only administration relies on a router-initiated HTTPS agent.
-- This feature flag is set only by the authenticated agent's capability poll,
-- never by user/browser writes. Existing scripts remain unsupported by default.
ALTER TABLE public.network_routers
 ADD COLUMN IF NOT EXISTS native_ping_supported boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.network_routers.native_ping_supported IS
 'Authenticated RouterOS native agent explicitly advertised bounded ping diagnostics.';

-- network_routers already has a broad authenticated UPDATE grant for legitimate
-- admin settings. A column-specific REVOKE would not override that grant.
-- Block clients from forging online capabilities even if they have table UPDATE.
CREATE OR REPLACE FUNCTION public.network_routers_native_ping_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $guard$
BEGIN
 IF NEW.native_ping_supported IS DISTINCT FROM OLD.native_ping_supported
    AND current_user NOT IN ('service_role','postgres','supabase_admin') THEN
  RAISE EXCEPTION 'Connector-owned native Ping capability cannot be edited by clients'
   USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END
$guard$;
REVOKE ALL ON FUNCTION public.network_routers_native_ping_guard()
 FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS network_routers_native_ping_guard
 ON public.network_routers;
CREATE TRIGGER network_routers_native_ping_guard
 BEFORE UPDATE OF native_ping_supported ON public.network_routers
 FOR EACH ROW EXECUTE FUNCTION public.network_routers_native_ping_guard();
