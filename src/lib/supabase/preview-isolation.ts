/**
 * Fail closed when a Vercel Preview accidentally points to ZARAY production.
 * The laboratory reference is intentionally non-secret; keys remain in Vercel.
 */
const PROD_REF='hosyeygtaksbahnxxiqf';
type PreviewEnvironment=Record<string,string|undefined>;

export function checkPreviewSupabaseIsolation(env:PreviewEnvironment){
 if(env.VERCEL_ENV!=='preview')return {ok:true as const,reason:'not_preview'};
 const expected=env.ZARAY_PREVIEW_SUPABASE_REF||'';
 if(!/^[a-z]{20}$/.test(expected)||expected===PROD_REF)
  return {ok:false as const,reason:'missing_or_production_lab_ref'};
 const urls=[env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_URL];
 if(urls.some(x=>!x))return {ok:false as const,reason:'missing_preview_urls'};
 for(const url of urls){
  try{
   const parsed=new URL(url!);
   if(parsed.protocol!=='https:'||parsed.hostname!==expected+'.supabase.co'||
      parsed.username||parsed.password||parsed.port||parsed.pathname!=='/'||
      parsed.search||parsed.hash)
    return {ok:false as const,reason:'wrong_preview_project'};
  }catch{return {ok:false as const,reason:'invalid_preview_url'};}
 }
 return {ok:true as const,reason:'lab_project_matched'};
}
export function previewSupabaseIsolationReady(){
 return checkPreviewSupabaseIsolation(process.env).ok;
}
