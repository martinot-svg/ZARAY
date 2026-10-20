import 'server-only';
import { createNeonAuth } from '@neondatabase/auth/next/server';

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

export function getAuth() {
  if (!baseUrl || !cookieSecret || cookieSecret.length < 32) {
    throw new Error('Neon Auth is not configured (NEON_AUTH_BASE_URL and a 32+ character NEON_AUTH_COOKIE_SECRET required).');
  }
  return createNeonAuth({ baseUrl, cookies: { secret: cookieSecret } });
}
