import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizeTenant } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

async function getVerifiedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, response: json('Connexion requise.', 401) };
  if (!user.email_confirmed_at) return { supabase, user: null, response: json('Vérifiez votre e-mail.', 403) };
  return { supabase, user, response: null };
}

function errorStatus(message: string, code?: string) {
  if (message.includes('role_not_authorized') || code === '42501') return json('Permission insuffisante pour utiliser la caisse.', 403);
  if (message.includes('site_not_active')) return json('Choisissez un site actif de cette entreprise.', 409);
  if (message.includes('offer_not_found') || message.includes('site_not_found') || code === 'P0002') return json('Offre ou site introuvable.', 404);
  if (message.includes('customer_name_required') || message.includes('invalid_payment_method') || message.includes('invalid_ticket_code') || message.includes('invalid_receipt_number')) return json('Données de vente invalides.', 400);
  if (message.includes('duplicate_walkin_sale') || code === '23505') return json('La vente n’a pas pu être enregistrée. Réessayez avec une nouvelle référence.', 409);
  return json('Impossible de générer le ticket.', 400);
}

export async function GET(request:NextRequest){
  const companyId=request.nextUrl.searchParams.get('companyId')??'';
  const siteId=request.nextUrl.searchParams.get('siteId')||null;
  if(!companyId)return json('Entreprise requise.',400);
  try{
    const supabase=await createClient();
    const access=await authorizeTenant(supabase,companyId,siteId);
    if(!access.ok)return json(access.error,access.status);

    let query=supabase.from('walkin_sales').select('id,company_id,site_id,receipt_number,ticket_code_prefix,customer_name,customer_phone,offer_name,amount,currency,duration_minutes,validity_days,max_devices,payment_method,ticket_status,valid_from,valid_until,created_at').eq('company_id',companyId);
    if(siteId)query=query.eq('site_id',siteId);
    const {data,error}=await query.order('created_at',{ascending:false}).limit(100);
    if(error)return json('Impossible de charger les ventes.',503);
    const now=Date.now();
    const sales=(data??[]).map(t=>({...t,ticket_status:t.ticket_status==='issued'&&new Date(t.valid_until).getTime()<=now?'expired':t.ticket_status}));
    return NextResponse.json({sales},{headers:{'Cache-Control':'no-store'}});
  }catch{return json('Service indisponible.',503);}
}
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.companyId !== 'string' || typeof body.offerId !== 'string' || typeof body.customerName !== 'string' || typeof body.siteId !== 'string' || body.paymentMethod !== 'cash') {
    return json('Entreprise, offre, client et mode de paiement sont requis.', 400);
  }
  try {
    const { supabase, response } = await getVerifiedUser();
    if (response) return response;

    const bytes = new Uint8Array(9);
    crypto.getRandomValues(bytes);
    const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const code = `ZRY-${raw.slice(0, 6)}-${raw.slice(6, 12)}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    const codeHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    const receiptNumber = `RC-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${raw.slice(-6)}`;

    const { data, error } = await supabase.rpc('create_walkin_sale', {
      p_company_id: body.companyId,
      p_site_id: typeof body.siteId === 'string' && body.siteId ? body.siteId : null,
      p_offer_id: body.offerId,
      p_customer_name: body.customerName,
      p_customer_phone: typeof body.customerPhone === 'string' ? body.customerPhone : null,
      p_payment_method: body.paymentMethod,
      p_code_hash: codeHash,
      p_code_prefix: code.slice(0, 10),
      p_receipt_number: receiptNumber,
    });
    if (error) return errorStatus(error.message ?? '', error.code);

    return NextResponse.json({ sale: data, code }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return json('Service indisponible.', 503);
  }
}
