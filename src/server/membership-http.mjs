import {
  MembershipError,
  readTeam,
  manageTeam,
  invitationDetails,
  acceptInvitation,
} from './membership-core.mjs';
const noStore = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
const reply = (value, status = 200) => Response.json(value, { status, headers: noStore });
async function inputJSON(request, baseURL) {
  if (request.headers.get('origin') !== baseURL || request.headers.get('sec-fetch-site') === 'cross-site')
    throw new MembershipError(403, 'Request not allowed.');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new MembershipError(415, 'JSON required.');
  const reader = request.body?.getReader();
  if (!reader) throw new MembershipError(400, 'Invalid request.');
  let size = 0,
    text = '';
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new MembershipError(413, 'Request too large.');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new MembershipError(400, 'Invalid request.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new MembershipError(400, 'Invalid request.');
  return data;
}
export function membershipHttpHandler(pool, auth, options) {
  return async (request) => {
    try {
      const url = new URL(request.url);
      if (url.pathname === '/api/team') {
        if (request.method === 'GET') return reply(await readTeam(pool, auth, request.headers));
        if (request.method === 'POST')
          return reply(
            await manageTeam(pool, auth, options, request.headers, await inputJSON(request, options.baseURL)),
          );
      } else if (url.pathname === '/api/invitations') {
        if (request.method === 'GET')
          return reply(await invitationDetails(pool, url.searchParams.get('token')));
        if (request.method === 'POST')
          return reply(
            await acceptInvitation(
              pool,
              auth,
              options,
              request.headers,
              await inputJSON(request, options.baseURL),
            ),
          );
      }
      return reply({ error: 'Not found.' }, 404);
    } catch (error) {
      if (error instanceof MembershipError) return reply({ error: error.message }, error.status);
      return reply({ error: 'Team service unavailable. Try again shortly.' }, 503);
    }
  };
}
