-- ZARAY MikroTik administration: scoped, read-only inventory with explicit collection completeness.
-- This migration is additive and must be applied before enabling expanded sources.
ALTER TABLE public.network_observations
 DROP CONSTRAINT IF EXISTS network_observations_observed_kind_check;
ALTER TABLE public.network_observations
 ADD CONSTRAINT network_observations_observed_kind_check CHECK (observed_kind IN (
  'hotspot','pppoe','dhcp','wifi','neighbor','radius','interface',
  'hotspot-user','hotspot-profile','ppp-secret','ppp-profile',
  'ip-address','ip-pool','dhcp-server','dhcp-client','vlan','arp','queue','firewall-filter',
  'firewall-nat','route','bridge','bridge-port','dhcp-network','dns-static','firewall-address-list','queue-tree','wireguard-interface','wireguard-peer','routing-rule','ipv6-address'
 ));

-- Only approved read-only RouterOS properties are stored for the WinBox-like
-- properties inspector. This avoids saving raw RouterOS configuration objects.
ALTER TABLE public.network_observations
 ADD COLUMN IF NOT EXISTS safe_properties jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.network_observations
 ADD CONSTRAINT network_observations_safe_properties_check
 CHECK (jsonb_typeof(safe_properties)='object' AND octet_length(safe_properties::text)<=2048);

CREATE TABLE IF NOT EXISTS public.network_inventory_sources (
 router_id uuid NOT NULL,
 company_id uuid NOT NULL,
 observed_kind text NOT NULL,
 reported_count integer NOT NULL CHECK (reported_count BETWEEN 0 AND 100000),
 collected_count integer NOT NULL CHECK (collected_count BETWEEN 0 AND 500),
 complete boolean NOT NULL DEFAULT false,
 observed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (router_id,observed_kind),
 FOREIGN KEY (router_id,company_id) REFERENCES public.network_routers(id,company_id) ON DELETE CASCADE,
 CONSTRAINT network_inventory_kind_check CHECK (observed_kind IN (
  'hotspot','pppoe','dhcp','wifi','neighbor','radius','interface',
  'hotspot-user','hotspot-profile','ppp-secret','ppp-profile',
  'ip-address','ip-pool','dhcp-server','dhcp-client','vlan','arp','queue','firewall-filter','firewall-nat','route','bridge','bridge-port','dhcp-network','dns-static','firewall-address-list','queue-tree','wireguard-interface','wireguard-peer','routing-rule','ipv6-address'
 )),
 CONSTRAINT network_inventory_count_check CHECK (collected_count <= reported_count OR NOT complete)
);
CREATE INDEX IF NOT EXISTS network_inventory_sources_company_idx
 ON public.network_inventory_sources(company_id,router_id,observed_at DESC);
ALTER TABLE public.network_inventory_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.network_inventory_sources FROM public,anon,authenticated;
GRANT SELECT ON public.network_inventory_sources TO authenticated;
DROP POLICY IF EXISTS network_inventory_sources_tenant_read ON public.network_inventory_sources;
CREATE POLICY network_inventory_sources_tenant_read
 ON public.network_inventory_sources FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.company_members m
   WHERE m.company_id=network_inventory_sources.company_id
   AND m.user_id=(SELECT auth.uid()) AND m.status='active')
 );
-- Do not add write privileges for clients. Only the authenticated connector backend writes.
CREATE UNIQUE INDEX IF NOT EXISTS network_session_pending_disconnect
 ON public.network_commands(router_id,action,session_id)
 WHERE action IN ('disconnect_hotspot','disconnect_ppp')
 AND session_id IS NOT NULL AND status IN ('queued','dispatched');

-- WinBox-style cross-page inventory search. SECURITY INVOKER preserves
-- network_observations tenant RLS; no SERVICE ROLE / SECURITY DEFINER bypass.
-- Positional search treats user-supplied percent, underscore and punctuation
-- literally, rather than constructing PostgREST OR filter expressions.
CREATE OR REPLACE FUNCTION public.network_inventory_search(
 p_company_id uuid, p_router_id uuid, p_kind text, p_term text, p_page integer
) RETURNS TABLE(
 id uuid, router_id uuid, observed_kind text, identity_key text,
 ip_address inet, mac_address macaddr, client_label text,
 active boolean, observed_at timestamptz, safe_properties jsonb, total_count bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $inventory_search$
 WITH matching AS (
  SELECT n.id,n.router_id,n.observed_kind,n.identity_key,n.ip_address,
   n.mac_address,n.client_label,n.active,n.observed_at,n.safe_properties
  FROM public.network_observations AS n
  WHERE n.company_id=p_company_id AND n.router_id=p_router_id AND n.observed_kind=p_kind
   AND p_term IS NOT NULL AND length(btrim(p_term)) BETWEEN 1 AND 64
   AND (
    position(lower(btrim(p_term)) in lower(coalesce(n.client_label,'')))>0
    OR position(lower(btrim(p_term)) in lower(n.identity_key))>0
    OR position(lower(btrim(p_term)) in lower(coalesce(host(n.ip_address),'')))>0
    OR position(lower(btrim(p_term)) in lower(coalesce(n.mac_address::text,'')))>0
   )
 )
 SELECT m.id,m.router_id,m.observed_kind,m.identity_key,m.ip_address,
  m.mac_address,m.client_label,m.active,m.observed_at,m.safe_properties,count(*) OVER() AS total_count
 FROM matching AS m
 ORDER BY m.observed_at DESC,m.id DESC
 LIMIT 50 OFFSET (greatest(1,least(coalesce(p_page,1),10000))-1)*50;
$inventory_search$;
REVOKE ALL ON FUNCTION public.network_inventory_search(uuid,uuid,text,text,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.network_inventory_search(uuid,uuid,text,text,integer)
 TO authenticated;


-- Read-only, on-demand router inventory refresh. A request merely asks the
-- paired LOCAL Node connector to collect an approved source at its next poll.
-- No RouterOS configuration writes or Vercel background jobs are introduced.
CREATE TABLE IF NOT EXISTS public.network_inventory_refresh_requests (
 router_id uuid NOT NULL,
 company_id uuid NOT NULL,
 observed_kind text NOT NULL,
 requested_at timestamptz NOT NULL DEFAULT now(),
 fulfilled_at timestamptz,
 PRIMARY KEY(router_id,observed_kind),
 FOREIGN KEY(router_id,company_id) REFERENCES public.network_routers(id,company_id) ON DELETE CASCADE,
 CONSTRAINT network_inventory_refresh_kind CHECK(observed_kind IN (
  'hotspot','pppoe','dhcp','wifi','neighbor','radius','interface',
  'hotspot-user','hotspot-profile','ppp-secret','ppp-profile','ip-address',
  'ip-pool','dhcp-server','dhcp-client','vlan','arp','queue','firewall-filter',
  'firewall-nat','route','bridge','bridge-port','dhcp-network','dns-static',
  'firewall-address-list','queue-tree','wireguard-interface','wireguard-peer',
  'routing-rule','ipv6-address'
 ))
);
CREATE INDEX IF NOT EXISTS network_inventory_refresh_pending_idx
 ON public.network_inventory_refresh_requests(router_id,requested_at)
 WHERE fulfilled_at IS NULL;
ALTER TABLE public.network_inventory_refresh_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.network_inventory_refresh_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.network_inventory_refresh_requests TO authenticated;
DROP POLICY IF EXISTS network_inventory_refresh_tenant_read ON public.network_inventory_refresh_requests;
CREATE POLICY network_inventory_refresh_tenant_read
 ON public.network_inventory_refresh_requests FOR SELECT TO authenticated USING(
  EXISTS (SELECT 1 FROM public.company_members m
   WHERE m.company_id=network_inventory_refresh_requests.company_id
    AND m.user_id=(SELECT auth.uid()) AND m.status='active')
 );

-- A single atomic, tightly-scoped SECURITY DEFINER request function is needed:
-- authenticated users have NO direct INSERT/UPDATE/DELETE on the request table.
-- Validate the user, role and router in the function; lock the router record
-- to serialize simultaneous requests and enforce a per-router cooldown.
CREATE OR REPLACE FUNCTION public.request_network_inventory_refresh(
 p_company_id uuid,p_router_id uuid,p_kind text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $refresh$
DECLARE n integer;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR p_company_id IS NULL OR p_router_id IS NULL
    OR p_kind IS NULL OR length(p_kind)>40 THEN RETURN false; END IF;
 PERFORM 1 FROM public.network_routers r
 JOIN public.company_members m ON m.company_id=r.company_id
 WHERE r.id=p_router_id AND r.company_id=p_company_id AND r.agent_kind='node-local'
  AND m.user_id=(SELECT auth.uid()) AND m.status='active'
  AND m.role IN ('owner','admin')
 FOR UPDATE OF r;
 IF NOT FOUND THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.network_inventory_refresh_requests q
  WHERE q.router_id=p_router_id AND q.requested_at > now()-interval '60 seconds')
 THEN RETURN false; END IF;
 INSERT INTO public.network_inventory_refresh_requests(
  router_id,company_id,observed_kind,requested_at,fulfilled_at)
 VALUES (p_router_id,p_company_id,p_kind,now(),NULL)
 ON CONFLICT (router_id,observed_kind) DO UPDATE
  SET requested_at=EXCLUDED.requested_at,fulfilled_at=NULL;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n=1;
EXCEPTION WHEN check_violation THEN
 RETURN false;
END
$refresh$;
REVOKE ALL ON FUNCTION public.request_network_inventory_refresh(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_network_inventory_refresh(uuid,uuid,text)
 TO authenticated;

-- Safe, bounded RouterOS ping operation. The destination is selected server-side
-- from a recent observation belonging to the authorized company and router.
CREATE TABLE IF NOT EXISTS public.network_diagnostic_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL,
 router_id uuid NOT NULL,
 observation_id uuid NOT NULL,
 requested_by uuid NOT NULL,
 kind text NOT NULL DEFAULT 'ping' CHECK(kind='ping'),
 target inet NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','dispatched','success','failed')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 dispatched_at timestamptz,
 completed_at timestamptz,
 reply jsonb NOT NULL DEFAULT '[]'::jsonb,
 error_message text,
 FOREIGN KEY(router_id,company_id) REFERENCES public.network_routers(id,company_id) ON DELETE CASCADE,
 CONSTRAINT network_diagnostic_reply_check CHECK(jsonb_typeof(reply)='array' AND octet_length(reply::text)<2048)
);
CREATE UNIQUE INDEX IF NOT EXISTS network_diagnostic_one_pending
 ON public.network_diagnostic_jobs(router_id)
 WHERE status IN ('queued','dispatched');
CREATE INDEX IF NOT EXISTS network_diagnostic_company_recent
 ON public.network_diagnostic_jobs(company_id,router_id,requested_at DESC);
ALTER TABLE public.network_diagnostic_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.network_diagnostic_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.network_diagnostic_jobs TO authenticated;
DROP POLICY IF EXISTS network_diagnostic_tenant_read ON public.network_diagnostic_jobs;
CREATE POLICY network_diagnostic_tenant_read
 ON public.network_diagnostic_jobs FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.company_members m
  WHERE m.company_id=network_diagnostic_jobs.company_id
   AND m.user_id=(SELECT auth.uid()) AND m.status='active')
);
