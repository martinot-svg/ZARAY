import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Backend-only admin client. This must never be imported into browser code.
 * Both legacy ZARAY-prefixed and provider-created Supabase environment
 * variables are accepted, without copying secret values into source code.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.zaray_SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.zaray_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
