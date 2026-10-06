import { getDatabase } from '@/server/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operational readiness only. No account, workspace or task contents are exposed.
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  if (!process.env.DATABASE_URL) {
    return Response.json({ status: 'prototype', database: 'not-configured' }, { headers });
  }
  try {
    await getDatabase().query("SELECT notes FROM task WHERE false");
    return Response.json({ status: 'ready' }, { headers });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
