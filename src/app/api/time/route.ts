import { getAuth, prototypeMode } from '@/server/auth';
import { getDatabase } from '@/server/db';
import { timeHttpHandler } from '@/server/time-http.mjs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
  if (prototypeMode())
    return Response.json({ error: 'Time tracking requires accounts mode.' }, { status: 503, headers });
  try {
    return await timeHttpHandler(getDatabase(), getAuth(), { baseURL: process.env.AUTH_BASE_URL })(request);
  } catch {
    return Response.json({ error: 'Time service unavailable. Try again shortly.' }, { status: 503, headers });
  }
}
export { handle as GET, handle as POST };
