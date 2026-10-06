import { FilesError, listFiles, uploadFile, downloadFile } from './files-core.mjs';
const noStore = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};
const reply = (value, status = 200) => Response.json(value, { status, headers: noStore });
export function filesHttpHandler(pool, auth, options) {
  return async (request) => {
    try {
      const url = new URL(request.url);
      if (url.pathname === '/api/files') {
        if (request.method === 'GET')
          return reply(await listFiles(pool, auth, request.headers, url.searchParams.get('taskId')));
        if (request.method === 'POST') {
          if (
            !options.baseURL ||
            request.headers.get('origin') !== options.baseURL ||
            request.headers.get('sec-fetch-site') === 'cross-site'
          )
            throw new FilesError(403, 'Request not allowed.');
          if (request.headers.get('content-type')?.toLowerCase() !== 'application/octet-stream')
            throw new FilesError(415, 'A raw file upload is required.');
          let name;
          try {
            name = decodeURIComponent(request.headers.get('x-upload-name') ?? '');
          } catch {
            throw new FilesError(400, 'Invalid filename.');
          }
          return reply(
            await uploadFile(pool, auth, request, options, url.searchParams.get('taskId'), name),
            201,
          );
        }
        return reply({ error: 'Method not allowed.' }, 405);
      }
      const match = /^\/api\/files\/([^/]+)$/.exec(url.pathname);
      if (!match) return reply({ error: 'Not found.' }, 404);
      if (request.method !== 'GET') return reply({ error: 'Method not allowed.' }, 405);
      const file = await downloadFile(pool, auth, request.headers, options, match[1]);
      const encoded = encodeURIComponent(file.name).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      );
      return new Response(file.stream, {
        headers: {
          ...noStore,
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(file.byteSize),
          'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encoded}`,
          'Content-Security-Policy': "sandbox; default-src 'none'",
          'Cross-Origin-Resource-Policy': 'same-origin',
        },
      });
    } catch (error) {
      if (request.method === 'POST' && request.body && !request.body.locked)
        void request.body.cancel().catch(() => {});
      if (error instanceof FilesError) return reply({ error: error.message }, error.status);
      return reply({ error: 'File service unavailable. Try again shortly.' }, 503);
    }
  };
}
