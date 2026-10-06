import { getAuth, prototypeMode } from '@/server/auth';
import { getDatabase } from '@/server/db';
import { authHttpHandler } from '@/server/auth-http.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  if (prototypeMode()) return Response.json({ error: 'Accounts are unavailable in the sample-only preview.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  try { return await authHttpHandler(getAuth(), getDatabase(), process.env.AUTH_BASE_URL)(request); }
  catch { return Response.json({ error: 'Account service unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
export { handle as GET, handle as POST };
