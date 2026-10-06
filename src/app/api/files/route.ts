import { getAuth, prototypeMode } from '@/server/auth';
import { getDatabase } from '@/server/db';
import { filesHttpHandler } from '@/server/files-http.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
async function handle(request: Request) {
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
  if (prototypeMode())
    return Response.json({ error: 'Saved files require accounts mode.' }, { status: 503, headers });
  try {
    return await filesHttpHandler(getDatabase(), getAuth(), {
      baseURL: process.env.AUTH_BASE_URL,
      storageRoot: process.env.ATTACHMENT_ROOT,
    })(request);
  } catch {
    return Response.json({ error: 'File service unavailable. Try again shortly.' }, { status: 503, headers });
  }
}
export { handle as GET, handle as POST };
