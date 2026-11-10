\set ON_ERROR_STOP on
-- Applied after the ACTUAL proposed migration, in an isolated CI PostgreSQL service.
INSERT INTO public.network_inventory_sources(
 router_id,company_id,observed_kind,reported_count,collected_count,complete,observed_at
) VALUES
 ('aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','interface',70,25,false,now()),
 ('aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','firewall-filter',5,5,true,now()-interval '5 minutes'),
 ('bbbbbbbb-2000-4000-8000-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','interface',2,2,true,now());
INSERT INTO public.network_observations(id,company_id,router_id,observed_kind,identity_key)
VALUES('00000000-0000-4000-8000-999999999998','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','hotspot-profile','zaray-plan-test');
DO $$
DECLARE n int;
BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.network_inventory_sources'::regclass)
  THEN RAISE EXCEPTION 'Inventory source RLS is disabled'; END IF;
 IF has_table_privilege('authenticated','public.network_inventory_sources','INSERT')
 OR has_table_privilege('authenticated','public.network_inventory_sources','UPDATE')
 OR has_table_privilege('authenticated','public.network_inventory_sources','DELETE')
  THEN RAISE EXCEPTION 'Browser has unsafe write privileges'; END IF;
 SELECT count(*) INTO n FROM public.network_observations
  WHERE router_id='aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa';
 IF n<>54 THEN RAISE EXCEPTION 'Expected 54 A observations, got %',n; END IF;
 SELECT count(*) INTO n FROM (
  SELECT id FROM public.network_observations
  WHERE router_id='aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa'
  ORDER BY observed_at DESC LIMIT 50 OFFSET 50
 ) p;
 IF n<>4 THEN RAISE EXCEPTION 'Second page expected 4, got %',n; END IF;
 SELECT count(*) INTO n FROM public.network_inventory_sources
  WHERE observed_kind='firewall-filter' AND observed_at<now()-interval '3 minutes';
 IF n<>1 THEN RAISE EXCEPTION 'Stale inventory source not detectable'; END IF;
 SELECT count(*) INTO n FROM public.network_inventory_sources
  WHERE observed_kind='interface' AND complete=false AND collected_count<reported_count;
 IF n<>1 THEN RAISE EXCEPTION 'Partial source not detectable'; END IF;
END $$;

-- Test tenant policies under REAL PostgreSQL SET ROLE and auth.uid() stub.
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM public.network_inventory_sources;
 IF n<>2 THEN RAISE EXCEPTION 'A source visibility expected 2, got %',n; END IF;
 SELECT count(*) INTO n FROM public.network_inventory_sources
  WHERE company_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 IF n<>0 THEN RAISE EXCEPTION 'Tenant A can read tenant B sources'; END IF;
 SELECT count(*) INTO n FROM public.network_observations
  WHERE company_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 IF n<>0 THEN RAISE EXCEPTION 'Tenant A can read tenant B observations'; END IF;
 SELECT count(*) INTO n FROM public.network_observations;
 IF n<>54 THEN RAISE EXCEPTION 'Tenant A should see 54 observations, got %',n; END IF;
END $$;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM public.network_inventory_sources;
 IF n<>1 THEN RAISE EXCEPTION 'B source visibility expected 1, got %',n; END IF;
 SELECT count(*) INTO n FROM public.network_observations;
 IF n<>1 THEN RAISE EXCEPTION 'B observation visibility expected 1, got %',n; END IF;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;

-- The inspector persists only bounded JSON objects; legacy agents default to {}.
UPDATE public.network_observations
 SET safe_properties='{"name":"ether1","type":"ether","running":"true"}'::jsonb
 WHERE id='00000000-0000-4000-8000-000000000001';
DO $properties$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.network_observations
  WHERE id='00000000-0000-4000-8000-000000000001'
   AND safe_properties->>'name'='ether1';
 IF n<>1 THEN RAISE EXCEPTION 'Safe RouterOS property was not stored'; END IF;
 BEGIN
  UPDATE public.network_observations
   SET safe_properties=jsonb_build_object('label',repeat('x',3000))
   WHERE id='00000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Oversized property object incorrectly accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $properties$;

-- Search must operate on typed INET/MACADDR fields without bypassing RLS.
UPDATE public.network_observations
 SET ip_address='192.0.2.10',mac_address='aa:bb:cc:dd:ee:ff',
     client_label='Test Router A'
 WHERE id='00000000-0000-4000-8000-000000000001';
DO $$
BEGIN
 IF NOT has_function_privilege('authenticated',
  'public.network_inventory_search(uuid,uuid,text,text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'Inventory search is not granted to authenticated'; END IF;
 IF has_function_privilege('anon',
  'public.network_inventory_search(uuid,uuid,text,text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous role can execute inventory search'; END IF;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $$
DECLARE n integer; t bigint;
BEGIN
 SELECT count(*) INTO n FROM public.network_inventory_search(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','interface','192.0.2',1);
 IF n<>1 THEN RAISE EXCEPTION 'INET substring search returned %, expected 1',n; END IF;
 SELECT count(*) INTO n FROM public.network_inventory_search(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','interface','aa:bb:cc',1);
 IF n<>1 THEN RAISE EXCEPTION 'MAC substring search returned %, expected 1',n; END IF;
 SELECT count(*) INTO n FROM public.network_inventory_search(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','interface','%',1);
 IF n<>0 THEN RAISE EXCEPTION 'Percent wildcard should be treated literally'; END IF;
 SELECT total_count INTO t FROM public.network_inventory_search(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','interface','ether1',1) LIMIT 1;
 IF t<>11 THEN RAISE EXCEPTION 'Wrong cross-page count %, expected 11',t; END IF;
 SELECT count(*) INTO n FROM public.network_inventory_search(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','interface','ether',2);
 IF n<>3 THEN RAISE EXCEPTION 'Second page should contain 3, found %',n; END IF;
 SELECT count(*) INTO n FROM public.network_inventory_search(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-2000-4000-8000-bbbbbbbbbbbb','interface','ether',1);
 IF n<>0 THEN RAISE EXCEPTION 'Cross-tenant search leaked tenant B'; END IF;
END $$;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.network_inventory_search(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-2000-4000-8000-bbbbbbbbbbbb','interface','ether',1);
 IF n<>1 THEN RAISE EXCEPTION 'Tenant B should see its own record, found %',n; END IF;
 SELECT count(*) INTO n FROM public.network_inventory_search(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','interface','ether',1);
 IF n<>0 THEN RAISE EXCEPTION 'Cross-tenant search leaked tenant A'; END IF;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;

-- Rate-limited on-demand source refresh: owners only, scoped to one router,
-- and never directly writable from the browser.
DO $refreshprivs$
BEGIN
 IF has_table_privilege('authenticated','public.network_inventory_refresh_requests','INSERT')
 OR has_table_privilege('authenticated','public.network_inventory_refresh_requests','UPDATE')
 OR has_table_privilege('authenticated','public.network_inventory_refresh_requests','DELETE')
 THEN RAISE EXCEPTION 'Browser may directly alter refresh requests'; END IF;
 IF has_function_privilege('anon',
  'public.request_network_inventory_refresh(uuid,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous refresh requests allowed'; END IF;
END $refreshprivs$;
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $refreshowner$
DECLARE ok boolean; count_rows integer;
BEGIN
 SELECT public.request_network_inventory_refresh(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','dhcp') INTO ok;
 IF NOT ok THEN RAISE EXCEPTION 'Owner refresh request was rejected'; END IF;
 SELECT public.request_network_inventory_refresh(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','interface') INTO ok;
 IF ok THEN RAISE EXCEPTION 'Per-router cooldown was bypassed'; END IF;
 SELECT public.request_network_inventory_refresh(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-2000-4000-8000-bbbbbbbbbbbb','interface') INTO ok;
 IF ok THEN RAISE EXCEPTION 'Cross-tenant refresh was accepted'; END IF;
 SELECT count(*) INTO count_rows FROM public.network_inventory_refresh_requests
  WHERE router_id='aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa';
 IF count_rows<>1 THEN RAISE EXCEPTION 'Expected exactly one request, got %',count_rows; END IF;
END $refreshowner$;
RESET ROLE;
RESET request.jwt.claim.sub;
UPDATE public.company_members SET role='viewer'
 WHERE company_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET ROLE authenticated;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $refreshviewer$
DECLARE ok boolean;
BEGIN
 SELECT public.request_network_inventory_refresh(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-2000-4000-8000-bbbbbbbbbbbb','interface') INTO ok;
 IF ok THEN RAISE EXCEPTION 'Read-only tenant member can refresh RouterOS'; END IF;
END $refreshviewer$;
RESET ROLE;
RESET request.jwt.claim.sub;

-- Two simultaneous pending disconnect commands for same session are forbidden.
INSERT INTO public.network_commands(id,router_id,action,session_id,status)
VALUES('c0000000-0000-4000-8000-000000000001','aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa',
 'disconnect_hotspot','*A','queued');
DO $$
BEGIN
 INSERT INTO public.network_commands(id,router_id,action,session_id,status)
 VALUES('c0000000-0000-4000-8000-000000000002','aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa',
 'disconnect_hotspot','*A','dispatched');
 RAISE EXCEPTION 'Duplicate pending disconnect incorrectly accepted';
EXCEPTION WHEN unique_violation THEN NULL;
END $$;
UPDATE public.network_commands SET status='success'
WHERE id='c0000000-0000-4000-8000-000000000001';
INSERT INTO public.network_commands(id,router_id,action,session_id,status)
VALUES('c0000000-0000-4000-8000-000000000003','aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa',
 'disconnect_hotspot','*A','queued');
SELECT 'PASS: isolation, 50-row pagination, stale/partial metadata, read-only RLS and pending disconnect index' AS result;
