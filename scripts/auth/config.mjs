import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../../', import.meta.url));
export async function localAuthConfig() {
  await mkdir(`${root}.local`, { recursive: true, mode: 0o700 });
  const file = `${root}.local/auth.env`;
  try { await writeFile(file, `AUTH_SECRET=${randomBytes(48).toString('hex')}\nAUTH_BASE_URL=http://127.0.0.1:3100\nWORKSPACE_MODE=accounts\n`, { mode: 0o600, flag: 'wx' }); }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
  return Object.fromEntries((await readFile(file,'utf8')).trim().split('\n').map((line) => line.split('=')));
}
