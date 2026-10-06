import { readFileSync, realpathSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const manifestPath = process.env.WORKSPACE_E2E_MANIFEST;
if (!manifestPath)
  throw new Error('Use node scripts/e2e/run.mjs; direct Playwright runs cannot target the preview.');
const canonical = realpathSync(manifestPath);
if (!canonical.startsWith(`${realpathSync(resolve(root, '.local/e2e'))}${sep}run-`))
  throw new Error('E2E manifest must be in a disposable project run directory.');
export const environment = JSON.parse(readFileSync(canonical, 'utf8'));
if (realpathSync(environment.directory) !== dirname(canonical))
  throw new Error('Mismatched E2E run directory.');
const url = new URL(environment.baseURL);
const database = new URL(environment.adminURL);
if (
  url.protocol !== 'http:' ||
  url.hostname !== '127.0.0.1' ||
  !url.port ||
  url.port === '3100' ||
  database.hostname !== '127.0.0.1' ||
  !database.port ||
  database.port === '55432'
)
  throw new Error('E2E requires separate loopback app and database ports.');
for (const person of Object.values(environment.people)) {
  if (dirname(realpathSync(person.storageState)) !== environment.directory)
    throw new Error('Session file is outside the disposable run.');
}
