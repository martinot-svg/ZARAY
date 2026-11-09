-- Add safe, read-only RouterOS interface observations. Existing rows are preserved.
ALTER TABLE public.network_observations
 DROP CONSTRAINT IF EXISTS network_observations_observed_kind_check;
ALTER TABLE public.network_observations
 ADD CONSTRAINT network_observations_observed_kind_check
 CHECK (observed_kind IN ('hotspot','pppoe','dhcp','wifi','neighbor','radius','interface'));
