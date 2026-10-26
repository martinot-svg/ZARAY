import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { authorizeManualPaymentReviewer } from '@/lib/manual-payment-auth';
import { authorizeTenant } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId') ?? '';
  const siteId = request.nextUrl.searchParams.get('siteId') || null;
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) return json({ error: 'Entreprise invalide.' }, 400);
  try {
    const session = await createClient();
    const authorization = await authorizeManualPaymentReviewer(session, companyId);
    if (!authorization.ok) return json({ error: authorization.error }, authorization.status);
    const tenant=await authorizeTenant(session,companyId,siteId);
    if(!tenant.ok)return json({error:tenant.error},tenant.status);
    const service = createServiceClient();
    if (!service) return json({ error: 'Service indisponible.' }, 503);
    const columns='id,company_id,order_id,provider,sender_phone,transaction_reference,amount,currency,proof_path,customer_note,status,reviewer_user_id,reviewed_at,review_note,created_at';
    let query=service.from('manual_payment_submissions').select(columns+(siteId?',subscription_orders!inner(site_id)':'')).eq('company_id',companyId);
    if(siteId)query=query.eq('subscription_orders.site_id',siteId);
    const {data:submissions,error}=await query.order('created_at',{ascending:false}).limit(100);
    if (error) {
      console.error('manual payment review list failed', { code: error.code });
      return json({ error: 'Impossible de charger les justificatifs.' }, 503);
    }
    const orderIds = [...new Set((submissions ?? []).map((item) => item.order_id))];
    const { data: orders, error: ordersError } = orderIds.length
      ? await service.from('subscription_orders').select('id,public_reference,customer_name,customer_email,offer_name,amount,currency,status,created_at').in('id', orderIds)
      : { data: [], error: null };
    if (ordersError) return json({ error: 'Impossible de charger les commandes.' }, 503);
    const orderById = new Map((orders ?? []).map((order) => [order.id, order]));
    const items = await Promise.all((submissions ?? []).map(async (submission) => {
      const { data: signed } = await service.storage.from('manual-payment-proofs').createSignedUrl(submission.proof_path, 300);
      return { ...submission, order: orderById.get(submission.order_id) ?? null, proofUrl: signed?.signedUrl ?? null };
    }));
    return json({ submissions: items });
  } catch { return json({ error: 'Service indisponible.' }, 503); }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const submissionId = typeof body?.submissionId === 'string' ? body.submissionId : '';
  const action = typeof body?.action === 'string' ? body.action : '';
  const reviewNote = typeof body?.reviewNote === 'string' ? body.reviewNote.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(submissionId) || !['approve','reject'].includes(action) || reviewNote.length > 1000) {
    return json({ error: 'Action de validation invalide.' }, 400);
  }
  try {
    const session = await createClient();
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) return json({ error: 'Connectez-vous pour continuer.' }, 401);
    if (!user.email_confirmed_at) return json({ error: 'Vérifiez votre adresse e-mail.' }, 403);
    const { data, error } = await session.rpc('review_manual_payment_submission', {
      p_submission_id: submissionId, p_action: action, p_review_note: reviewNote,
    });
    if (error) {
      if (error.code === '42501') return json({ error: 'Action réservée au dirigeant et aux administrateurs explicitement autorisés.' }, 403);
      if (error.code === 'P0002') return json({ error: 'Justificatif introuvable.' }, 404);
      if (error.code === '23505') return json({ error: 'Ce justificatif a déjà été traité ou la commande est déjà payée.' }, 409);
      if (error.code === '22023') return json({ error: 'Le montant ou la devise ne correspond pas à la commande.' }, 409);
      console.error('manual payment review action failed', { code: error.code });
      return json({ error: 'Impossible de traiter ce justificatif.' }, 503);
    }
    return json({ result: data });
  } catch { return json({ error: 'Service indisponible.' }, 503); }
}
