import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {authorizeTenant} from '@/lib/tenant-context';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});
type Input={companyId?:unknown;action?:unknown;confirmation?:unknown;acknowledge?:unknown};
const permitted=new Set(['deactivate','reactivate','delete']);

export async function POST(request:NextRequest){
 const body=await request.json().catch(()=>null) as Input|null;
 const companyId=typeof body?.companyId==='string'?body.companyId:'';
 const action=typeof body?.action==='string'?body.action:'';
 if(!permitted.has(action))return reply({error:'Action non reconnue.'},400);
 if(action==='delete'&&(body?.acknowledge!==true||typeof body?.confirmation!=='string'))
  return reply({error:'Confirmez la suppression et saisissez le nom exact de l’entreprise.'},400);
 try{
  const client=await createClient();
  const auth=await authorizeTenant(client,companyId);
  if(!auth.ok)return reply({error:auth.error},auth.status);
  if(!['owner','admin'].includes(auth.member.role))
   return reply({error:'Action réservée au propriétaire ou à un administrateur.'},403);
  if(action==='delete'&&auth.member.role!=='owner')
   return reply({error:'Seul le propriétaire peut supprimer définitivement l’entreprise.'},403);
  const {data:company,error:companyError}=await client.from('companies')
   .select('id,legal_name,status,lifecycle_previous_status').eq('id',companyId).maybeSingle();
  if(companyError)return reply({error:'Statut de l’entreprise indisponible.'},503);
  if(!company)return reply({error:'Entreprise introuvable.'},404);
  if(action==='delete'&&body?.confirmation!==company.legal_name)
   return reply({error:'Le nom de confirmation est incorrect.'},400);
  const {data,error}=await client.rpc('manage_company_lifecycle',{
   p_company_id:companyId,p_action:action,
   p_confirmation:action==='delete'?body?.confirmation:null
  });
  if(error){
   const message=error.message||'';
   if(error.code==='23503'||message.includes('company_has_business_records')||message.includes('company_has_other_members'))
    return reply({error:'Suppression impossible : retirez d’abord les sites, membres supplémentaires, invitations et autres dossiers liés. Les historiques métier doivent être conservés.'},409);
   if(message.includes('company_not_reactivatable'))
    return reply({error:'Cette suspension ne peut pas être levée ici : contactez le responsable de la facturation si nécessaire.'},409);
   if(message.includes('company_not_eligible_for_pause'))
    return reply({error:'Cette entreprise ne peut pas être désactivée depuis son état actuel.'},409);
   if(message.includes('company_must_be_paused_first'))
    return reply({error:'Désactivez volontairement cette entreprise avant toute suppression.'},409);
   if(message.includes('company_confirmation_incorrect'))return reply({error:'Nom de confirmation incorrect.'},400);
   if(error.code==='42501')return reply({error:'Vous n’êtes pas autorisé à effectuer cette action.'},403);
   if(error.code==='P0002')return reply({error:'Entreprise introuvable.'},404);
   console.error('company lifecycle error',{code:error.code});
   return reply({error:'Impossible de modifier cette entreprise.'},503);
  }
  return reply({companyId,...data});
 }catch{return reply({error:'Gestion de l’entreprise indisponible.'},503);}
}
