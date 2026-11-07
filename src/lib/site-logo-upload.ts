'use client';
import {createClient} from '@/lib/supabase/client';
export type SiteLogoVariant='light'|'dark';
export function validateLogoFile(file:File){
 const ext=file.name.toLowerCase().split('.').pop();
 const allowed:Record<string,string>={png:'image/png',svg:'image/svg+xml',webp:'image/webp'};
 if(!ext||allowed[ext]!==file.type)
  throw Error('Format non accepté : veuillez importer un fichier PNG ou SVG compatible (WebP transparent accepté).');
 const max=ext==='svg'?2*1024*1024:15*1024*1024;
 if(file.size<16||file.size>max)
  throw Error('Fichier trop volumineux : la taille du fichier dépasse la limite autorisée.');
 return ext;
}
export async function uploadOriginalSiteLogo(file:File,companyId:string,variant:SiteLogoVariant,siteId?:string){
 validateLogoFile(file);
 const response=await fetch('/api/site-logos/sign',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({companyId,siteId,variant,filename:file.name,mime:file.type,size:file.size})
 });
 const signed=await response.json().catch(()=>({}));
 if(!response.ok||!signed.path||!signed.token)throw Error(signed.error||'Impossible de préparer l’importation.');
 const client=createClient();
 const {error}=await client.storage.from('zaray-site-logo-originals')
  .uploadToSignedUrl(signed.path,signed.token,file,{contentType:file.type,cacheControl:'3600'});
 if(error)throw Error('Impossible de transférer le logo original vers le stockage sécurisé.');
 return signed.path as string;
}
