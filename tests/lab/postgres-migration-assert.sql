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
