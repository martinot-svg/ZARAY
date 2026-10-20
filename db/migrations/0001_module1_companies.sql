-- Zaray module 1: initial minimal multi-tenant schema.
-- Apply only through reviewed migration after Neon preview validation.
CREATE TABLE IF NOT EXISTS public.companies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 legal_name text NOT NULL CHECK (char_length(trim(legal_name)) BETWEEN 2 AND 160),
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
 status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','grace','suspended','closed')),
 trial_started_at timestamptz NOT NULL DEFAULT now(),
 trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '31 days'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.company_members (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK (role IN ('owner','admin','site_manager','support','technician','sales','finance')),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.sites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
 status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','suspended','archived')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,name)
);
CREATE TABLE IF NOT EXISTS public.audit_logs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
 actor_user_id uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
 event text NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_company_members_user ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_sites_company ON public.sites(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_company_date ON public.audit_logs(company_id,created_at DESC);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.companies, public.company_members, public.sites, public.audit_logs FROM PUBLIC;
