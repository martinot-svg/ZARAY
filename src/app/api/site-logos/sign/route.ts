import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
import {allowedLogoFile,SITE_LOGO_BUCKET} from '@/lib/site-logo-library';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const respond=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});

export async function POST(request:NextRequest){
 if(request.headers.get('origin')!==request.nextUrl.origin)
  return respond({error:'Origine de la demande non autorisée.'},403);
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof body?.companyId==='string'?body.companyId:'';
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 const filename=typeof body?.filename==='string'?body.filename:'';
 const mime=typeof body?.mime==='string'?body.mime:'';
 const size=body?.size;
 const variant=body?.variant;
 if(!['light','dark'].includes(String(variant)))return respond({error:'Version du logo invalide.'},400);
 let extension:string;
 try{extension=allowedLogoFile(filename,mime,Number(size)).extension;}
 catch(e){return respond({error:e instanceof Error?e.message:'Fichier invalide.'},400);}
 const session=await createClient();
 const access=await authorizeTenant(session,companyId,siteId||null);
 if(!access.ok)return respond({error:access.error},access.status);
 if(!['owner','admin'].includes(access.member.role))
  return respond({error:'Réservé aux administrateurs de l’entreprise.'},403);
 const service=createServiceClient();
 if(!service)return respond({error:'Stockage indisponible.'},503);
 // Unique immutable object key. Never permit caller-controlled paths or upsert.
 const path=companyId+'/'+access.user.id+'/'+randomUUID()+'.'+extension;
 const {data,error}=await service.storage.from(SITE_LOGO_BUCKET).createSignedUploadUrl(path,{upsert:false});
 if(error||!data)return respond({error:'Impossible de préparer l’importation.'},503);
 return respond({path,token:data.token,bucket:SITE_LOGO_BUCKET,variant,expiresInSeconds:7200});
}
