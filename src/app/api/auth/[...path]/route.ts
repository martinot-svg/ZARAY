import { getAuth } from '@/lib/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return getAuth().handler().GET(request as never);
}
export async function POST(request: Request) {
  return getAuth().handler().POST(request as never);
}
