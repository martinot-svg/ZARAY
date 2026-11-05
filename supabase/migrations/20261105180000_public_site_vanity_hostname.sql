-- Optional verified free-host mapping for white-label public sites.
-- This is distinct from registered DNS domains and from a user's display alias.
ALTER TABLE public.site_public_links
 ADD COLUMN IF NOT EXISTS public_hostname text;
CREATE UNIQUE INDEX IF NOT EXISTS site_public_links_hostname_unique
 ON public.site_public_links (public_hostname)
 WHERE public_hostname IS NOT NULL;
ALTER TABLE public.site_public_links
 ADD CONSTRAINT site_public_links_hostname_format CHECK (
  public_hostname IS NULL OR (
   public_hostname = lower(public_hostname)
   AND public_hostname ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.vercel\\.app$'
  )
 );
-- No privilege changes: service_role is the only writer.
