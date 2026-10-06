import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../src/server/database.mjs';
import { createFirstOwner, issueRecovery, revokeAccountSessions } from '../../src/server/account-operator.mjs';
import { localAuthConfig, root } from './config.mjs';

process.umask(0o077);
if (!process.stdin.isTTY) throw new Error('Run this operator command in an interactive local terminal.');
const config = await localAuthConfig();
const connection = (await readFile(`${root}.local/database.env`, 'utf8')).trim().slice('DATABASE_URL='.length);
const pool = createDatabase(connection);
const options = { secret: config.AUTH_SECRET, baseURL: config.AUTH_BASE_URL };
let muted = false;
const output = new Writable({ write(chunk, encoding, done) { if (!muted) process.stdout.write(chunk, encoding); done(); } });
const prompt = createInterface({ input: process.stdin, output, terminal: true });
async function secret(label) { process.stdout.write(label); muted = true; try { return await prompt.question(''); } finally { muted = false; process.stdout.write('\n'); } }
try {
  const action = process.argv[2];
  if (action === 'setup') {
    console.log('Create the first staff workspace owner. This does not grant customer-portal or NAS privileges.');
    const name = await prompt.question('Your name: ');
    const email = await prompt.question('Email (used for sign-in; no email will be sent): ');
    const password = await secret('Password (12–128 characters; hidden): ');
    if (password !== await secret('Repeat password: ')) throw new Error('Passwords did not match. Nothing was created.');
    await createFirstOwner(pool, options, { name, email, password });
    console.log('Owner created. Open http://127.0.0.1:3100/sign-in to sign in.');
  } else if (action === 'recover') {
    const email = (await prompt.question('Account email: ')).trim();
    if (await prompt.question('Have you independently verified this person’s identity? Type verified: ') !== 'verified') throw new Error('Identity verification is required before recovery.');
    const url = await issueRecovery(pool, options, email);
    await mkdir(`${root}.local/recovery`, { recursive: true, mode: 0o700 });
    const file = `${root}.local/recovery/${randomUUID()}.txt`;
    await writeFile(file, url+'\n', { mode: 0o600, flag: 'wx' });
    console.log(`A one-use, 15-minute recovery link was saved to ${file}. Share it directly with the verified person, then remove that local file. No email was sent.`);
  } else if (action === 'revoke' || action === 'disable') {
    const email = (await prompt.question('Account email: ')).trim();
    if (await prompt.question(`Type ${action} to ${action === 'disable' ? 'disable this account and revoke access' : 'sign out every session'}: `) !== action) throw new Error('Cancelled.');
    await revokeAccountSessions(pool, email, action === 'disable');
    console.log('Sessions and outstanding recovery links revoked.');
  } else throw new Error('Use setup, recover, revoke or disable.');
} catch (error) { console.error(error instanceof Error ? error.message : 'Operator action failed.'); process.exitCode = 1; }
finally { prompt.close(); await pool.end(); }
