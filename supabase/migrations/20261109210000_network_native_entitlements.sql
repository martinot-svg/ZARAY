-- Optional, account-scoped bandwidth snapshots. Existing orders and accounts are unchanged.
ALTER TABLE public.offers
 ADD COLUMN IF NOT EXISTS upload_kbps integer NULL,
 ADD COLUMN IF NOT EXISTS download_kbps integer NULL;
ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_bandwidth_limits_check;
ALTER TABLE public.offers ADD CONSTRAINT offers_bandwidth_limits_check CHECK (
 (upload_kbps IS NULL AND download_kbps IS NULL) OR
 (upload_kbps BETWEEN 64 AND 10000000 AND download_kbps BETWEEN 64 AND 10000000)
);
ALTER TABLE public.network_access_accounts
 ADD COLUMN IF NOT EXISTS upload_kbps integer NULL,
 ADD COLUMN IF NOT EXISTS download_kbps integer NULL;
ALTER TABLE public.network_access_accounts DROP CONSTRAINT IF EXISTS network_accounts_bandwidth_check;
ALTER TABLE public.network_access_accounts ADD CONSTRAINT network_accounts_bandwidth_check CHECK (
 (upload_kbps IS NULL AND download_kbps IS NULL) OR
 (upload_kbps BETWEEN 64 AND 10000000 AND download_kbps BETWEEN 64 AND 10000000)
);
COMMENT ON COLUMN public.network_access_accounts.upload_kbps IS
 'Subscribed upload limit snapshot in kbit/s. NULL means preserve RouterOS existing profile.';
COMMENT ON COLUMN public.network_access_accounts.download_kbps IS
 'Subscribed download limit snapshot in kbit/s. NULL means preserve RouterOS existing profile.';
