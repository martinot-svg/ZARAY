\set ON_ERROR_STOP on
-- Real PostgreSQL RLS, one-at-a-time writes, and tenant isolation.
DO $audit$
BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.network_managed_config_jobs'::regclass)
 THEN RAISE EXCEPTION 'Configuration job RLS is disabled'; END IF;
 IF has_table_privilege('authenticated','public.network_managed_config_jobs','INSERT') OR
    has_table_privilege('authenticated','public.network_managed_config_jobs','UPDATE') OR
    has_table_privilege('authenticated','public.network_managed_config_jobs','DELETE')
 THEN RAISE EXCEPTION 'Browser can mutate RouterOS job table'; END IF;
END $audit$;
INSERT INTO public.network_managed_config_jobs(
 id,company_id,router_id,actor_user_id,category,operation,requested_values,reason
) VALUES
 ('cccccccc-0000-4000-8000-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','dns-static','create',
  '{"name":"lab.example","address":"192.0.2.9"}','Créer un DNS pour le laboratoire'),
 ('dddddddd-0000-4000-8000-dddddddddddd',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-2000-4000-8000-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222','vlan','create',
  '{"name":"vlan100","interface":"ether1","vlan-id":"100"}','Créer un VLAN pour le laboratoire');
DO $singleflight$
BEGIN
 BEGIN
  INSERT INTO public.network_managed_config_jobs(
   company_id,router_id,actor_user_id,category,operation,requested_values,reason
  ) VALUES (
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111','dns-static','create',
   '{"name":"duplicate.example","address":"192.0.2.11"}','Deuxième commande simultanée');
  RAISE EXCEPTION 'Simultaneous RouterOS changes incorrectly accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
END $singleflight$;
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $tenant_a$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.network_managed_config_jobs;
 IF n<>1 THEN RAISE EXCEPTION 'Tenant A should see one own job, got %',n; END IF;
END $tenant_a$;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $tenant_b$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.network_managed_config_jobs;
 IF n<>1 THEN RAISE EXCEPTION 'Tenant B should see one own job, got %',n; END IF;
END $tenant_b$;
RESET ROLE;
RESET request.jwt.claim.sub;
UPDATE public.network_managed_config_jobs
 SET status='manual_review',completed_at=now(),outcome='Pending manual verification'
 WHERE id='cccccccc-0000-4000-8000-cccccccccccc';
DO $unknownstate$
BEGIN
 BEGIN
  INSERT INTO public.network_managed_config_jobs(
   company_id,router_id,actor_user_id,category,operation,requested_values,reason
  ) VALUES (
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111','dns-static','create',
   '{"name":"unsafe.example","address":"192.0.2.12"}','Écriture interdite car résultat inconnu');
  RAISE EXCEPTION 'Manual review did not lock the router';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
END $unknownstate$;
UPDATE public.network_managed_config_jobs SET status='failed'
 WHERE id='cccccccc-0000-4000-8000-cccccccccccc';
INSERT INTO public.network_managed_config_jobs(
 company_id,router_id,actor_user_id,category,operation,requested_values,reason
) VALUES(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa',
 '11111111-1111-4111-8111-111111111111','dns-static','create',
 '{"name":"next.example","address":"192.0.2.12"}','Nouvelle commande autorisée');
