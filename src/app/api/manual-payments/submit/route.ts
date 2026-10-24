import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const PROVIDERS = new Set(['orange_money','mvola']);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function validFileSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (file.type === 'image/webp') return String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  if (file.type === 'application/pdf') return String.fromCharCode(...bytes.slice(0,4)) === '%PDF';
  return false;
}

export async function POST(request: NextRequest) {
  const service = createServiceClient();
  if (!service) return json({ error: 'Le service de paiement est temporairement indisponible.' }, 503);
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: 'Formulaire de paiement invalide.' }, 400); }

  const reference = String(form.get('reference') ?? '').trim().toUpperCase();
  const provider = String(form.get('provider') ?? '');
  const customerEmail = String(form.get('customerEmail') ?? '').trim().toLowerCase();
  const senderPhone = String(form.get('senderPhone') ?? '').trim();
  const transactionReference = String(form.get('transactionReference') ?? '').trim();
  const customerNote = String(form.get('customerNote') ?? '').trim();
  const proof = form.get('proof');
  if (!/^[A-F0-9]{12}$/.test(reference) || !PROVIDERS.has(provider)) return json({ error: 'Référence de commande ou moyen de paiement invalide.' }, 400);
  if (customerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return json({ error: 'Adresse e-mail invalide.' }, 400);
  if (!/^03[0-9]{8}$/.test(senderPhone)) return json({ error: 'Le numéro utilisé pour envoyer l’argent doit être au format 03XXXXXXXX.' }, 400);
  if (transactionReference.length < 2 || transactionReference.length > 120 || customerNote.length > 1000) return json({ error: 'Référence de transaction ou note invalide.' }, 400);
  if (!(proof instanceof File) || proof.size < 1 || proof.size > MAX_FILE_SIZE) return json({ error: 'Ajoutez un justificatif de 5 Mo maximum.' }, 400);
  if (!await validFileSignature(proof)) return json({ error: 'Format de justificatif refusé. Utilisez une image JPG, PNG, WEBP ou un PDF valide.' }, 400);

  const { data: order, error: orderError } = await service.from('subscription_orders')
    .select('id,public_reference,company_id,customer_email,amount,currency,status,paid_at')
    .eq('public_reference', reference).maybeSingle();
  if (orderError) return json({ error: 'Impossible de vérifier la commande.' }, 503);
  if (!order) return json({ error: 'Commande introuvable.' }, 404);
  if (order.customer_email !== customerEmail) return json({ error: 'L’adresse e-mail ne correspond pas à cette commande.' }, 403);
  if (order.status !== 'pending_payment' || order.paid_at) return json({ error: 'Cette commande n’accepte plus de paiement.' }, 409);
  if (order.currency !== 'MGA' || !Number.isSafeInteger(Number(order.amount)) || Number(order.amount) < 1) return json({ error: 'Le paiement manuel Orange Money/MVola exige un montant en ariary (MGA).' }, 409);

  const { data: method, error: methodError } = await service.from('manual_payment_methods')
    .select('id').eq('company_id', order.company_id).eq('provider', provider).eq('is_active', true).maybeSingle();
  if (methodError) return json({ error: 'Impossible de vérifier le moyen de paiement.' }, 503);
  if (!method) return json({ error: 'Ce moyen de paiement n’est pas activé pour ce portail.' }, 409);

  const { data: existing, error: existingError } = await service.from('manual_payment_submissions')
    .select('id,status').eq('order_id', order.id).in('status', ['submitted','approved']).limit(1).maybeSingle();
  if (existingError) return json({ error: 'Impossible de vérifier les justificatifs précédents.' }, 503);
  if (existing?.status === 'approved') return json({ error: 'Cette commande est déjà payée.' }, 409);
  if (existing?.status === 'submitted') return json({ error: 'Un justificatif est déjà en attente de vérification.' }, 409);

  const extension = ({ 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'application/pdf':'pdf' } as Record<string,string>)[proof.type];
  const path = order.company_id + '/' + order.id + '/' + randomUUID() + '.' + extension;
  const upload = await service.storage.from('manual-payment-proofs').upload(path, proof, { contentType: proof.type, upsert: false });
  if (upload.error) {
    console.error('manual payment proof upload failed', { message: upload.error.message });
    return json({ error: 'Impossible de téléverser le justificatif. Réessayez.' }, 503);
  }

  const { data: submission, error: insertError } = await service.from('manual_payment_submissions').insert({
    company_id: order.company_id,
    order_id: order.id,
    provider,
    sender_phone: senderPhone,
    transaction_reference: transactionReference,
    amount: Number(order.amount),
    currency: order.currency,
    proof_path: path,
    customer_note: customerNote,
    status: 'submitted',
  }).select('id,status,created_at').single();
  if (insertError) {
    await service.storage.from('manual-payment-proofs').remove([path]);
    if (insertError.code === '23505') return json({ error: 'Un justificatif est déjà en attente pour cette commande.' }, 409);
    console.error('manual payment submission insert failed', { code: insertError.code });
    return json({ error: 'Impossible d’enregistrer le justificatif.' }, 503);
  }
  return json({ submission: { id: submission.id, status: submission.status, createdAt: submission.created_at }, message: 'Justificatif transmis. Le paiement sera confirmé après vérification par un dirigeant ou un administrateur autorisé.' }, 201);
}
