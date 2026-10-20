import { getAuth } from '@/lib/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type AuthContext = { params: Promise<{ path: string[] }> };
export async function GET(request: Request, context: AuthContext) {
  return getAuth().handler().GET(request as never, context as never);
}
export async function POST(request: Request, context: AuthContext) {
  return getAuth().handler().POST(request as never, context as never);
}
