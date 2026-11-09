-- ZARAY RADIUS bridge foundation. No existing router is activated by this migration.
-- All access is service-role only; never expose password derivatives or gateway tokens to clients.
CREATE TABLE IF NOT EXISTS public.network_radius_gateways (
 router_id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 secret_hash text NOT NULL CHECK (secret_hash ~ '^[a-f0-9]{64}$'),
 enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 last_auth_at timestamptz,
 FOREIGN KEY (router_id,company_id) REFERENCES public.network_routers(id,company_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.network_radius_credentials (
 account_id uuid PRIMARY KEY REFERENCES public.network_access_accounts(id) ON DELETE CASCADE,
 router_id uuid NOT NULL,
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 password_salt text NOT NULL CHECK (password_salt ~ '^[a-f0-9]{32}$'),
 password_hash text NOT NULL CHECK (password_hash ~ '^[a-f0-9]{128}$'),
 rotated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (router_id,company_id) REFERENCES public.network_routers(id,company_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS network_radius_credentials_router_idx ON public.network_radius_credentials(router_id);
CREATE INDEX IF NOT EXISTS network_access_accounts_router_login_idx ON public.network_access_accounts(router_id,protocol,username);
ALTER TABLE public.network_radius_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_radius_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.network_radius_gateways,public.network_radius_credentials FROM PUBLIC,anon,authenticated;
-- Prevent cross-tenant and cross-router credential reassignments even by privileged API mistakes.
CREATE OR REPLACE FUNCTION network_internal.radius_credential_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.network_access_accounts a
   WHERE a.id=NEW.account_id AND a.company_id=NEW.company_id AND a.router_id=NEW.router_id
 ) THEN RAISE EXCEPTION 'RADIUS credential/account tenant mismatch' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION network_internal.radius_credential_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS network_radius_credential_guard_trigger ON public.network_radius_credentials;
CREATE TRIGGER network_radius_credential_guard_trigger BEFORE INSERT OR UPDATE ON public.network_radius_credentials
 FOR EACH ROW EXECUTE FUNCTION network_internal.radius_credential_guard();
