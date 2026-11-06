import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {authorizeTenant} from '@/lib/tenant-context';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});

type Payload={companyId?:unknown;siteId?:unknown;action?:unknown;confirmation?:unknown;acknowledge?:unknown};
async function access(body:Payload|null){
 const companyId=typeof body?.companyId==='string'?body.companyId:'';
 const siteId=typeof body?.siteId==='string'?body.siteId:'';
 const client=await createClient();
 const tenant=await authorizeTenant(client,companyId,siteId);
 if(!tenant.ok)return {error:json({error:tenant.error},tenant.status)};
 if(!tenant.site||!['owner','admin'].includes(tenant.member.role))
  return {error:json({error:'Action réservée au propriétaire ou à un administrateur de cette entreprise.'},403)};
 return {client,site:tenant.site,companyId,siteId};
}

export async function PATCH(request:NextRequest){
 const body=await request.json().catch(()=>null) as Payload|null;
 if(body?.action!=='deactivate'&&body?.action!=='reactivate')
  return json({error:'Action de site invalide.'},400);
 try{
  const permission=await access(body);
  if(permission.error)return permission.error;
  const {client,site,companyId,siteId}=permission;
  const status=body.action==='deactivate'?'suspended':'active';
  if(site!.status===status)return json({site,unchanged:true});
  const {data,error}=await client!.from('sites')
   .update({status})
   .eq('id',siteId!).eq('company_id',companyId!)
   .eq('status',site!.status)
   .select('id,company_id,name,status,created_at').maybeSingle();
  if(error)return json({error:'Modification du statut impossible.'},503);
  if(!data)return json({error:'Le site a été modifié entre-temps. Actualisez la liste.'},409);
  return json({site:data,message:status==='suspended'
   ?'Site désactivé dans ZARAY. Une coupure effective du Wi-Fi nécessite la synchronisation MikroTik.'
   :'Site réactivé dans ZARAY.'});
 }catch{return json({error:'Modification du site indisponible.'},503);}
}

export async function DELETE(request:NextRequest){
 const body=await request.json().catch(()=>null) as Payload|null;
 if(body?.acknowledge!==true||typeof body?.confirmation!=='string')
  return json({error:'Confirmez explicitement la suppression et saisissez le nom exact du site.'},400);
 try{
  const permission=await access(body);
  if(permission.error)return permission.error;
  const {client,site,companyId,siteId}=permission;
  if(site!.name!==body.confirmation)
   return json({error:'Le nom saisi ne correspond pas exactement au site.'},400);
  if(site!.status==='active')
   return json({error:'Désactivez le site avant de demander sa suppression définitive.'},409);
  const {data,error}=await client!.rpc('delete_company_site',{
   p_company_id:companyId!,p_site_id:siteId!,p_confirmation:body.confirmation
  });
  if(error){
   const code=error.message||'';
   if(code.includes('site_has_business_records')||error.code==='23503')
    return json({error:'Suppression bloquée : ce site possède des clients, tickets, paiements, historiques ou équipements associés. Désactivez-le pour conserver ces données.'},409);
   if(code.includes('site_must_be_inactive'))
    return json({error:'Désactivez d’abord ce site.'},409);
   if(code.includes('site_name_confirmation_mismatch'))
    return json({error:'Le nom de confirmation est incorrect.'},400);
   if(code.includes('site_permission_denied')||error.code==='42501')
    return json({error:'Suppression non autorisée pour cette entreprise.'},403);
   if(code.includes('site_not_found')||error.code==='P0002')
    return json({error:'Site introuvable.'},404);
   console.error('site deletion failed',{code:error.code});
   return json({error:'Impossible de supprimer ce site pour le moment.'},503);
  }
  return json({deleted:!!(data as {deleted?:boolean}|null)?.deleted,siteId});
 }catch{return json({error:'Suppression du site indisponible.'},503);}
}
