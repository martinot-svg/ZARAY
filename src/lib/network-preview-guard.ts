/**
 * A Vercel Preview can reuse production Supabase credentials.
 * Keep the entire network management write surface read-only unless the
 * preview is explicitly attached to an isolated lab and opted in.
 */
export function networkWritesBlockedInPreview(){
 return process.env.VERCEL_ENV==='preview'&&process.env.ZARAY_PREVIEW_NETWORK_MUTATIONS!=='enabled';
}
