import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer Supabase's current server-only secret key when configured; retain the legacy service-role fallback.
  const key = process.env.zaray_SUPABASE_SECRET_KEY || process.env.zaray_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
