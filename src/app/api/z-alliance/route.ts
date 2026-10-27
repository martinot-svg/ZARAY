import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizeTenant } from '@/lib/tenant-context';
import { deliverInvitation, mailReadiness, markInvitationDelivery, type IssuedInvitation } from '@/lib/zalliance-email';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const reply = (error: string, status: number) => NextResponse.json({ error }, { status, headers });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roles = new Set(['admin','site_manager','support','technician','sales','finance']);
const emailValid = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

async function context(companyId: string) {
  const client = await createClient();
  const access = await authorizeTenant(client, companyId);
  if (!access.ok) return { client, access, error: reply(access.error, access.status) };
  if (!['owner','admin'].includes(access.member.role)) return { client, access, error: reply('Permission d’invitation requise.',403) };
  return { client, access, error: null };
}
function dbError(error: { code?: string }) {
  if (error.code === '42501') return reply('Action non autorisée.',403);
  if (error.code === '23505') return reply('Une invitation active existe déjà ou ce collaborateur est déjà membre.',409);
  if (error.code === '22023' || error.code === '22P02') return reply('Données d’invitation invalides.',400);
  if (error.code === 'P0001') return reply('Limite de tentatives atteinte. Réessayez plus tard.',429);
  if (error.code === 'P0002') return reply('Invitation introuvable.',404);
  return reply('Service des invitations temporairement indisponible.',503);
}

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId') ?? '';
  if (!UUID.test(companyId)) return reply('Entreprise invalide.',400);
  try {
    const { client, error } = await context(companyId);
    if (error) return error;
    const { data, error: rpcError } = await client.rpc('zalliance_list_invitations',{p_company_id:companyId});
    if (rpcError) return dbError(rpcError);
    return NextResponse.json({
      invitations: data?.invitations ?? [],
      emailConfigured: mailReadiness().ready,
    },{headers});
  } catch { return reply('Impossible de charger les invitations.',503); }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string,unknown> | null;
  if (!body || typeof body.companyId!=='string' || typeof body.email!=='string' || typeof body.role!=='string')
    return reply('Entreprise, adresse et rôle requis.',400);
  const companyId = body.companyId, email=body.email.trim().toLowerCase();
  const role = body.role;
  const message = typeof body.message==='string' ? body.message.trim() : '';
  if (!UUID.test(companyId) || !emailValid(email) || !roles.has(role) || message.length>500)
    return reply('Données d’invitation invalides.',400);
  if (!mailReadiness().ready) return reply('L’envoi automatique est indisponible : fournisseur d’e-mails non configuré.',503);
  try {
    const { client, access, error } = await context(companyId);
    if (error || !access.ok) return error ?? reply('Entreprise inaccessible.',403);
    const { data: company, error: companyError } = await client.from('companies')
      .select('legal_name').eq('id',companyId).single();
    if (companyError || !company) return reply('Entreprise indisponible.',503);
    const { data, error: rpcError } = await client.rpc('zalliance_issue_invitation', {
      p_company_id:companyId,p_email:email,p_role:role,p_message:message || null
    });
    if (rpcError) return dbError(rpcError);
    const invitation = data as IssuedInvitation;
    if (!invitation?.id || !invitation?.token) return reply('Création non confirmée.',503);
    try {
      await deliverInvitation(invitation, company.legal_name);
    } catch {
      await markInvitationDelivery(invitation,false).catch(()=>{});
      return reply('Invitation enregistrée, mais envoi e-mail non confirmé. Utilisez « Renvoyer » après vérification du fournisseur.',502);
    }
    try {
      await markInvitationDelivery(invitation,true);
    } catch {
      return reply('Le fournisseur a accepté l’e-mail, mais le suivi de livraison a échoué. Contactez l’assistance avant de renvoyer.',503);
    }
    return NextResponse.json({ invitation: {id:invitation.id,email:invitation.email,status:'pending',delivery_status:'sent'} },
      {status:201,headers});
  } catch { return reply('Erreur temporaire d’invitation.',503); }
}

export async function PATCH(request: NextRequest) {
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  if (!body || typeof body.companyId!=='string' || typeof body.invitationId!=='string'
    || !UUID.test(body.companyId) || !UUID.test(body.invitationId)
    || !['revoke','resend'].includes(String(body.action))) return reply('Action invalide.',400);
  const companyId=body.companyId, invitationId=body.invitationId, action=String(body.action);
  try {
    const {client,access,error}=await context(companyId);
    if (error || !access.ok) return error ?? reply('Accès refusé.',403);
    if (action==='revoke') {
      const {data,error:rpcError}=await client.rpc('zalliance_revoke_invitation',{p_invitation_id:invitationId});
      if(rpcError)return dbError(rpcError);
      return NextResponse.json({revoked:data===true},{headers});
    }
    if (!mailReadiness().ready) return reply('Le fournisseur e-mail n’est pas configuré.',503);
    const {data:company,error:companyError}=await client.from('companies').select('legal_name').eq('id',companyId).single();
    if(companyError||!company)return reply('Entreprise inaccessible.',503);
    const {data,error:rpcError}=await client.rpc('zalliance_resend_invitation',{p_invitation_id:invitationId});
    if(rpcError)return dbError(rpcError);
    const invitation=data as IssuedInvitation;
    if(invitation?.company_id!==companyId) return reply('Entreprise de l’invitation non correspondante.',403);
    try {await deliverInvitation(invitation,company.legal_name);}
    catch {
      await markInvitationDelivery(invitation,false).catch(()=>{});
      return reply('Le fournisseur n’a pas confirmé ce nouvel envoi.',502);
    }
    try {await markInvitationDelivery(invitation,true);}
    catch{return reply('Envoi accepté, suivi de livraison non confirmé.',503);}
    return NextResponse.json({resent:true},{headers});
  }catch{return reply('Service temporairement indisponible.',503);}
}
