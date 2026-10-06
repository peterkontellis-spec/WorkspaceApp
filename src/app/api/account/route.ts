import { currentAccount, activeAccount, prototypeMode } from '@/server/auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  if (prototypeMode())
    return Response.json({ error: 'No real accounts in prototype mode.' }, { status: 401, headers });
  try {
    const account = await currentAccount();
    return Response.json(account ? { account } : { error: 'Sign in required.' }, {
      status: account ? 200 : 401,
      headers,
    });
  } catch {
    return Response.json({ error: 'Account service unavailable.' }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (
    request.headers.get('origin') !== process.env.AUTH_BASE_URL ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return Response.json({ error: 'Request not allowed.' }, { status: 403, headers });
  if (prototypeMode()) return Response.json({ error: 'No real accounts.' }, { status: 401, headers });
  try {
    const account = await activeAccount();
    return Response.json(account ? { account } : { error: 'Sign in required.' }, {
      status: account ? 200 : 401,
      headers,
    });
  } catch {
    return Response.json({ error: 'Account service unavailable.' }, { status: 503, headers });
  }
}
