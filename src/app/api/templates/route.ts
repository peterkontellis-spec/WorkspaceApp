import { getAuth, prototypeMode } from '@/server/auth';
import { getDatabase } from '@/server/db';
import { templatesHttpHandler } from '@/server/templates-http.mjs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
  if (prototypeMode())
    return Response.json({ error: 'Templates require accounts mode.' }, { status: 503, headers });
  try {
    return await templatesHttpHandler(getDatabase(), getAuth(), { baseURL: process.env.AUTH_BASE_URL })(
      request,
    );
  } catch {
    return Response.json(
      { error: 'Template service unavailable. Try again shortly.' },
      { status: 503, headers },
    );
  }
}
export { handle as GET, handle as POST };
