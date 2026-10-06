import { WorkError, readWork, manageWork } from './work-core.mjs';
const noStore = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
const reply = (value, status = 200) => Response.json(value, { status, headers: noStore });
async function inputJSON(request, baseURL) {
  if (request.headers.get('origin') !== baseURL || request.headers.get('sec-fetch-site') === 'cross-site') throw new WorkError(403, 'Request not allowed.');
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new WorkError(415, 'JSON required.');
  const reader = request.body?.getReader();
  if (!reader) throw new WorkError(400, 'Invalid request.');
  let size = 0, text = ''; const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 512 * 1024) { await reader.cancel(); throw new WorkError(413, 'Request too large.'); }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  let data;
  try { data = JSON.parse(text); } catch { throw new WorkError(400, 'Invalid request.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new WorkError(400, 'Invalid request.');
  return data;
}
export function workHttpHandler(pool, auth, options) {
  return async request => {
    try {
      if (new URL(request.url).pathname !== '/api/work') return reply({ error: 'Not found.' }, 404);
      if (request.method === 'GET') return reply(await readWork(pool, auth, request.headers));
      if (request.method === 'POST') return reply(await manageWork(pool, auth, request.headers, await inputJSON(request, options.baseURL)));
      return reply({ error: 'Method not allowed.' }, 405);
    } catch (error) {
      if (error instanceof WorkError) return reply({ error: error.message, ...(error.status === 409 ? { conflict: true } : {}) }, error.status);
      return reply({ error: 'Work service unavailable. Try again shortly.' }, 503);
    }
  };
}
