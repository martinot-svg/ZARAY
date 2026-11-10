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
