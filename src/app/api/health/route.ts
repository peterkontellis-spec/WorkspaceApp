import { getDatabase } from '@/server/db';
import { getAuth, prototypeMode } from '@/server/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operational readiness only. No account, workspace or task contents are exposed.
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  if (!process.env.DATABASE_URL) {
    return prototypeMode()
      ? Response.json({ status: 'prototype', database: 'not-configured' }, { headers })
      : Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
  try {
    await getDatabase().query("SELECT notes FROM task WHERE false");
    if (!prototypeMode()) {
      getAuth();
      await getDatabase().query('SELECT u.auth_user_id, s.id, i.token_hash FROM app_user u CROSS JOIN auth_session s CROSS JOIN workspace_invitation i WHERE false');
    }
    return Response.json({ status: 'ready' }, { headers });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
