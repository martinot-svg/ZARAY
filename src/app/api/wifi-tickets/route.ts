import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

async function getVerifiedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, response: json('Connexion requise.', 401) };
  if (!user.email_confirmed_at) return { supabase, user: null, response: json('Vérifiez votre e-mail.', 403) };
  return { supabase, user, response: null };
}
function messageStatus(message: string, code?: string) {
  if (message.includes('payment_not_confirmed')) return json('Paiement non confirmé : aucun ticket ne peut être émis.', 409);
  if (message.includes('ticket_already_issued') || code === '23505') return json('Un ticket existe déjà pour cette commande.', 409);
  if (message.includes('role_not_authorized') || code === '42501') return json('Permission insuffisante.', 403);
  if (message.includes('ticket_not_revokeable')) return json('Seul un ticket émis et non utilisé peut être révoqué.', 409);
  if (message.includes('ticket_not_found') || code === 'P0002') return json('Ticket ou commande introuvable.', 404);
  return json('Opération impossible.', 400);
}

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId') ?? '';
  if (!companyId) return json('Identifiant d’entreprise requis.', 400);
  try {
    const { supabase, response } = await getVerifiedUser();
    if (response) return response;
    const { data, error } = await supabase.from('wifi_tickets').select('id,company_id,subscription_order_id,code_prefix,status,duration_minutes,max_devices,valid_from,valid_until,redeemed_at,revoked_at,created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(200);
    if (error) { console.error('Wi-Fi tickets list failed', { code: error.code }); return json('Impossible de charger les tickets.', error.code === '42501' ? 403 : 500); }
    const now = Date.now();
    const tickets = (data ?? []).map((ticket) => ({ ...ticket, status: ticket.status === 'issued' && new Date(ticket.valid_until).getTime() <= now ? 'expired' : ticket.status }));
    return NextResponse.json({ tickets }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return json('Service indisponible.', 503); }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.orderId !== 'string') return json('Commande requise.', 400);
  try {
    const { supabase, response } = await getVerifiedUser();
    if (response) return response;
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const code = 'ZRY-' + raw;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    const codeHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    const { data, error } = await supabase.rpc('issue_wifi_ticket', { p_order_id: body.orderId, p_code_hash: codeHash, p_code_prefix: 'ZRY-' + raw.slice(0, 4) });
    if (error) { console.error('Wi-Fi ticket issuance failed', { code: error.code, message: error.message }); return messageStatus(error.message ?? '', error.code); }
    return NextResponse.json({ ticket: data, code, warning: 'Ce code ne sera plus affiché après cette réponse.' }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch { return json('Service indisponible.', 503); }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.ticketId !== 'string') return json('Ticket requis.', 400);
  try {
    const { supabase, response } = await getVerifiedUser();
    if (response) return response;
    const { error } = await supabase.rpc('revoke_wifi_ticket', { p_ticket_id: body.ticketId });
    if (error) { console.error('Wi-Fi ticket revoke failed', { code: error.code, message: error.message }); return messageStatus(error.message ?? '', error.code); }
    return NextResponse.json({ revoked: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return json('Service indisponible.', 503); }
}
