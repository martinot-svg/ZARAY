import {NextResponse} from 'next/server';
import {checkPreviewSupabaseIsolation} from '@/lib/supabase/preview-isolation';
import {networkWritesBlockedInPreview} from '@/lib/network-preview-guard';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};

/**
 * Public non-secret indicator for deployment health checks.
 * It does not certify hardware tests, schema availability or database access.
 */
export async function GET(){
 if(process.env.VERCEL_ENV!=='preview')
  return NextResponse.json({error:'Disponible uniquement en prévisualisation.'},{status:404,headers});
 const config=checkPreviewSupabaseIsolation(process.env);
 return NextResponse.json({
  environment:'preview',
  isolatedConfiguration:config.ok,
  networkWritesBlocked:networkWritesBlockedInPreview(),
  labDatabaseReachability:'not_tested',
  routerosHardwareValidation:'not_tested',
  message:config.ok?'Configuration d’isolation cohérente. Connectivité et droits à vérifier.':
   'Base Supabase de laboratoire non configurée : aucune écriture autorisée.'
 },{status:config.ok?200:503,headers});
}
