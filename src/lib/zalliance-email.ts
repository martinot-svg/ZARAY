import 'server-only';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

export type IssuedInvitation = {
  id: string; token: string; email: string; company_id: string;
  role: string; expires_at: string; personal_message?: string | null;
};

export function mailReadiness() {
  const apiKey = process.env.ZARAY_RESEND_API_KEY || process.env.RESEND_API_KEY;
  const sender = process.env.ZARAY_INVITE_FROM;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!apiKey || !sender || !appUrl) return { ready: false as const };
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return { ready: false as const };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) return { ready: false as const };
    return { ready: true as const, apiKey, sender, baseUrl: parsed.origin };
  } catch { return { ready: false as const }; }
}

/** Service credentials remain on the server and are never bundled into browser code. */
function administrativeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.zaray_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Service de livraison non configuré.');
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function markInvitationDelivery(invitation: IssuedInvitation, success: boolean) {
  const tokenHash = createHash('sha256').update(invitation.token).digest('hex');
  const { data, error } = await administrativeClient().rpc('zalliance_mark_delivery', {
    p_invitation_id: invitation.id, p_token_hash: tokenHash, p_success: success,
  });
  if (error || data !== true) throw new Error('État de livraison non confirmé.');
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character] || character));

export async function deliverInvitation(invitation: IssuedInvitation, companyName: string) {
  const mail = mailReadiness();
  if (!mail.ready) throw new Error('Le service e-mail de Z’Alliance n’est pas encore configuré.');
  // Fragment tokens are not transmitted as part of HTTP request URLs, so they do not
  // appear in server route query strings or request logs.
  const url = mail.baseUrl + '/z-alliance/accepter#token=' + invitation.token;
  const title = 'Vous êtes invité à rejoindre ZARAY';
  const message = [
    'Bonjour,',
    '',
    'Vous avez été invité à rejoindre un espace de travail sur ZARAY' + (companyName ? ' (' + companyName + ')' : '') + '.',
    'Pour consulter votre invitation et rejoindre cet espace, utilisez le lien ci-dessous.',
    url,
    ...(invitation.personal_message ? ['', 'Message personnel :', invitation.personal_message] : []),
    'Cette invitation est personnelle, limitée dans le temps et utilisable une seule fois.',
    'Si vous ne reconnaissez pas cette invitation, ignorez ce message.',
    '',
    'L’équipe ZARAY'
  ].join('\n');
  const email = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + mail.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: mail.sender, to: [invitation.email], subject: title, text: message,
      html: '<p>Bonjour,</p><p>Vous avez été invité à rejoindre un espace de travail sur ZARAY' +
        (companyName ? ' (' + escapeHtml(companyName) + ')' : '') +
        '.</p><p>Pour consulter votre invitation :</p><p><a href="' + escapeHtml(url) +
        '">Accepter l’invitation</a></p><p>Cette invitation est personnelle, limitée dans le temps et utilisable une seule fois.</p>' +
        '<p>Si vous ne reconnaissez pas cette invitation, ignorez ce message.</p><p>L’équipe ZARAY</p>',
    }),
    cache: 'no-store',
  });
  if (!email.ok) throw new Error('Le fournisseur e-mail a refusé le message.');
  const payload = await email.json().catch(() => null) as { id?: string } | null;
  if (!payload?.id) throw new Error('Confirmation de l’envoi indisponible.');
}
