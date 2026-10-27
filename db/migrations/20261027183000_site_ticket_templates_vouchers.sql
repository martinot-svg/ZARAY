-- ZARAY: site/offer ticket identity and securely scoped pre-printed voucher inventory.
-- Additive only; existing subscription Wi-Fi tickets and purchase flow remain unchanged.
CREATE UNIQUE INDEX IF NOT EXISTS sites_id_company_unique ON public.sites(id,company_id);
CREATE UNIQUE INDEX IF NOT EXISTS offers_id_company_unique ON public.offers(id,company_id);

CREATE TABLE IF NOT EXISTS public.ticket_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  site_id uuid NOT NULL,
  offer_id uuid,
  logo_data_uri text,
  primary_color text,
  secondary_color text,
  title_color text,
  border_color text,
  font_family text,
  username_length smallint,
  password_length smallint,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (site_id, offer_id),
  FOREIGN KEY (site_id,company_id) REFERENCES public.sites(id,company_id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id,company_id) REFERENCES public.offers(id,company_id) ON DELETE CASCADE,
  CHECK (logo_data_uri IS NULL OR (offer_id IS NULL AND length(logo_data_uri)<=180000 AND logo_data_uri ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')),
  CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9a-fA-F]{6}$'),
  CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  CHECK (title_color IS NULL OR title_color ~ '^#[0-9a-fA-F]{6}$'),
  CHECK (border_color IS NULL OR border_color ~ '^#[0-9a-fA-F]{6}$'),
  CHECK (font_family IS NULL OR font_family IN ('Arial','Georgia','Verdana','Tahoma')),
  CHECK (username_length IS NULL OR username_length BETWEEN 3 AND 5),
  CHECK (password_length IS NULL OR password_length BETWEEN 12 AND 32)
);
CREATE INDEX IF NOT EXISTS ticket_templates_company_idx ON public.ticket_templates(company_id,site_id);
ALTER TABLE public.ticket_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ticket_templates FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.ticket_templates TO authenticated;
CREATE POLICY "member reads ticket templates" ON public.ticket_templates FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id=ticket_templates.company_id AND m.user_id=(SELECT auth.uid()) AND m.status='active'));
CREATE POLICY "manager creates ticket templates" ON public.ticket_templates FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id=ticket_templates.company_id AND m.user_id=(SELECT auth.uid()) AND m.status='active' AND m.role IN ('owner','admin','site_manager')));
CREATE POLICY "manager updates ticket templates" ON public.ticket_templates FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id=ticket_templates.company_id AND m.user_id=(SELECT auth.uid()) AND m.status='active' AND m.role IN ('owner','admin','site_manager')))
WITH CHECK (EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id=ticket_templates.company_id AND m.user_id=(SELECT auth.uid()) AND m.status='active' AND m.role IN ('owner','admin','site_manager')));

CREATE TABLE IF NOT EXISTS public.wifi_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL,
  offer_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  username text NOT NULL CHECK (username ~ '^[A-Z0-9]{3,5}$'),
  credential_hash text NOT NULL UNIQUE CHECK (credential_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','paid','active','expired','cancelled')),
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 525600),
  validity_days integer NOT NULL CHECK (validity_days BETWEEN 1 AND 3650),
  paid_at timestamptz,
  activated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  FOREIGN KEY (site_id,company_id) REFERENCES public.sites(id,company_id) ON DELETE RESTRICT,
  FOREIGN KEY (offer_id,company_id) REFERENCES public.offers(id,company_id) ON DELETE RESTRICT,
  UNIQUE(site_id,username),
  CHECK (status <> 'active' OR (paid_at IS NOT NULL AND activated_at IS NOT NULL)),
  CHECK (expires_at IS NULL OR activated_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS wifi_vouchers_company_site_batch_idx ON public.wifi_vouchers(company_id,site_id,batch_id);
ALTER TABLE public.wifi_vouchers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wifi_vouchers FROM public,anon,authenticated;
GRANT SELECT,INSERT ON public.wifi_vouchers TO authenticated;
CREATE POLICY "member reads vouchers" ON public.wifi_vouchers FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id=wifi_vouchers.company_id AND m.user_id=(SELECT auth.uid()) AND m.status='active'));
CREATE POLICY "manager creates vouchers" ON public.wifi_vouchers FOR INSERT TO authenticated
WITH CHECK (status='available' AND paid_at IS NULL AND activated_at IS NULL AND expires_at IS NULL
AND created_by=(SELECT auth.uid())
AND EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id=wifi_vouchers.company_id AND m.user_id=(SELECT auth.uid()) AND m.status='active' AND m.role IN ('owner','admin','site_manager')));
-- No direct voucher updates: payment/activation requires a future verified transactional workflow.
