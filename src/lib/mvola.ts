import { randomUUID } from 'node:crypto';

const API_BASE = process.env.MVOLA_ENV === 'production'
  ? 'https://api.mvola.mg'
  : 'https://devapi.mvola.mg';

export function getMvolaConfig() {
  const consumerKey = process.env.MVOLA_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.MVOLA_CONSUMER_SECRET?.trim();
  const partnerMsisdn = process.env.MVOLA_PARTNER_MSISDN?.trim();
  const partnerName = process.env.MVOLA_PARTNER_NAME?.trim();
  if (!consumerKey || !consumerSecret || !partnerMsisdn || !partnerName) return null;
  if (!/^03\d{8}$/.test(partnerMsisdn) || partnerName.length > 100) return null;
  return { consumerKey, consumerSecret, partnerMsisdn, partnerName, apiBase: API_BASE };
}

export async function getMvolaAccessToken(config: NonNullable<ReturnType<typeof getMvolaConfig>>) {
  const credentials = Buffer.from(config.consumerKey + ':' + config.consumerSecret, 'utf8').toString('base64');
  const response = await fetch(config.apiBase + '/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + credentials,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'EXT_INT_MVOLA_SCOPE' }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('mvola_token_failed');
  const data = await response.json() as { access_token?: unknown; expires_in?: unknown };
  if (typeof data.access_token !== 'string' || !data.access_token) throw new Error('mvola_token_invalid');
  return data.access_token;
}

export function mvolaHeaders(config: NonNullable<ReturnType<typeof getMvolaConfig>>, token: string, payerPhone: string) {
  return {
    Authorization: 'Bearer ' + token,
    Version: '1.0',
    'X-CorrelationID': randomUUID(),
    UserLanguage: 'FR',
    UserAccountIdentifier: 'msisdn;' + payerPhone,
    partnerName: config.partnerName,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };
}

export function normalizeMvolaStatus(value: unknown): 'completed' | 'pending' | 'failed' | 'cancelled' | null {
  const status = typeof value === 'string' ? value.toLowerCase().trim() : '';
  if (['completed', 'success', 'succeeded', 'paid'].includes(status)) return 'completed';
  if (['pending', 'initiated', 'processing', 'in_progress'].includes(status)) return 'pending';
  if (['failed', 'rejected', 'error', 'declined'].includes(status)) return 'failed';
  if (['cancelled', 'canceled'].includes(status)) return 'cancelled';
  return null;
}
