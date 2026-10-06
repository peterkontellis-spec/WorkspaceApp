import { getAuth, prototypeMode } from '@/server/auth';
import { getDatabase } from '@/server/db';
import { membershipHttpHandler } from '@/server/membership-http.mjs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
  if (prototypeMode()) return Response.json({ error: 'Real team management requires accounts mode.' }, { status: 503, headers });
  try {
    return await membershipHttpHandler(getDatabase(), getAuth(), { secret: process.env.AUTH_SECRET, baseURL: process.env.AUTH_BASE_URL })(request);
  } catch { return Response.json({ error: 'Team service unavailable. Try again shortly.' }, { status: 503, headers }); }
}
export { handle as GET, handle as POST };
