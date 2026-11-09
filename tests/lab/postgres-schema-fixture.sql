\set ON_ERROR_STOP on
-- Disposable CI PostgreSQL schema. No production data or credentials.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.company_members (
 company_id uuid NOT NULL,user_id uuid NOT NULL,status text NOT NULL,
 PRIMARY KEY(company_id,user_id)
);
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_members_self ON public.company_members
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
GRANT SELECT ON public.company_members TO authenticated;
CREATE TABLE public.network_routers(
 id uuid PRIMARY KEY,company_id uuid NOT NULL,
 UNIQUE(id,company_id)
);
CREATE TABLE public.network_observations(
 id uuid PRIMARY KEY, company_id uuid NOT NULL,router_id uuid NOT NULL,
 observed_kind text NOT NULL,identity_key text NOT NULL,observed_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT network_observations_observed_kind_check
 CHECK (observed_kind IN ('interface','hotspot','pppoe'))
);
ALTER TABLE public.network_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY network_observations_tenant ON public.network_observations
 FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.company_members m
   WHERE m.company_id=network_observations.company_id
    AND m.user_id=(SELECT auth.uid()) AND m.status='active')
 );
GRANT SELECT ON public.network_observations TO authenticated;
CREATE TABLE public.network_commands(
 id uuid PRIMARY KEY,router_id uuid NOT NULL,
 action text NOT NULL, session_id text,status text NOT NULL
);
-- The two synthetic tenants. None of these UUIDs represent a real user.
INSERT INTO public.company_members(company_id,user_id,status) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','active'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','active');
INSERT INTO public.network_routers(id,company_id) VALUES
 ('aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-2000-4000-8000-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.network_observations(id,company_id,router_id,observed_kind,identity_key,observed_at)
SELECT ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','interface','ether'||i,
 now()-make_interval(secs=>i)
FROM generate_series(1,53) i;
INSERT INTO public.network_observations(id,company_id,router_id,observed_kind,identity_key)
VALUES ('00000000-0000-4000-8000-999999999999','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'bbbbbbbb-2000-4000-8000-bbbbbbbbbbbb','interface','ether1');
