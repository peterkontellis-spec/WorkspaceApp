const noStore = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
export function authHttpHandler(auth, pool, baseURL) {
  return async (request) => {
    const url = new URL(request.url);
    const action = url.pathname.slice('/api/auth/'.length);
    if (request.method !== 'POST' || !['sign-in/email', 'sign-out', 'reset-password'].includes(action))
      return Response.json({ error: 'Not found' }, { status: 404, headers: noStore });
    if (request.headers.get('origin') !== baseURL || request.headers.get('sec-fetch-site') === 'cross-site')
      return Response.json({ error: 'Request not allowed' }, { status: 403, headers: noStore });
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return Response.json({ error: 'JSON required' }, { status: 415, headers: noStore });
    // Bound input before JSON parsing. The reader is cancelled on overflow.
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: 'Invalid request' }, { status: 400, headers: noStore });
    let body = '',
      bytes = 0;
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) {
        await reader.cancel();
        return Response.json({ error: 'Request too large' }, { status: 413, headers: noStore });
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    const headers = new Headers(request.headers);
    headers.set('x-workspace-client-ip', '127.0.0.1');
    headers.delete('content-length');
    try {
      const response = await auth.handler(
        new Request(`${baseURL}${url.pathname}`, { method: 'POST', headers, body }),
      );
      const outputHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(noStore)) outputHeaders.set(key, value);
      if (action === 'sign-in/email' && response.ok) {
        const data = await response.json();
        const member = await pool.query(
          `SELECT 1 FROM app_user u JOIN membership m ON m.user_id=u.id
          WHERE u.auth_user_id=$1 AND u.disabled_at IS NULL`,
          [data.user?.id],
        );
        if (!member.rowCount) {
          await pool.query('DELETE FROM auth_session WHERE "userId"=$1', [data.user?.id]);
          return Response.json(
            { error: 'Sign-in unavailable for this account.' },
            { status: 403, headers: noStore },
          );
        }
        return Response.json({ ok: true }, { headers: outputHeaders });
      }
      return new Response(response.body, { status: response.status, headers: outputHeaders });
    } catch {
      return Response.json(
        { error: 'Account service unavailable. Try again shortly.' },
        { status: 503, headers: noStore },
      );
    }
  };
}
