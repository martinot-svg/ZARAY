import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Browser previews never fall back to production project credentials.
  if (process.env.NEXT_PUBLIC_VERCEL_ENV==='preview') {
    const ref=process.env.NEXT_PUBLIC_ZARAY_LAB_PROJECT_REF;
    let valid=false;
    try {
      const parsed=new URL(url||'');
      valid=!!ref&&/^[a-z]{20}$/.test(ref)&&ref!=='hosyeygtaksbahnxxiqf'&&
        parsed.protocol==='https:'&&parsed.hostname===ref+'.supabase.co'&&
        !parsed.username&&!parsed.password&&!parsed.port&&parsed.pathname==='/'&&!parsed.search&&!parsed.hash;
    } catch {}
    if(!valid) throw new Error('Preview Supabase isolée non configurée.');
  }
  if (!url || !key) throw new Error('Supabase public configuration is missing.');
  return createBrowserClient(url, key);
}
