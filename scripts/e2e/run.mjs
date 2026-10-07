import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { cp, mkdir, mkdtemp, open, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { openLocalCluster, provisionLocalDatabase, grantApplicationAccess } from '../db/local.mjs';
import { migrate } from '../db/migrate.mjs';
import { createDatabase } from '../../src/server/database.mjs';
import { createAuthentication } from '../../src/server/auth-core.mjs';
import { createFirstOwner } from '../../src/server/account-operator.mjs';

// Deliberately accepts no database URL, preview credentials, port, or external host.
const root = resolve(import.meta.dirname, '../..');
process.umask(0o077);
const args = process.argv.slice(2);
const grep = args.length === 2 && args[0] === '--grep' && args[1].length <= 500 ? args[1] : null;
if (
  !grep &&
  (args.some((arg) => !['--setup-check', '--serve', '--restart-check'].includes(arg)) || args.length > 1)
)
  throw new Error(
    'Usage: node scripts/e2e/run.mjs [--setup-check | --serve | --restart-check | --grep pattern]',
  );
await readFile(join(root, '.next/BUILD_ID'), 'utf8');
await mkdir(join(root, '.local/e2e'), { recursive: true, mode: 0o700 });
const directory = await mkdtemp(join(root, '.local/e2e/run-'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function unusedPort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close((error) => (error ? reject(error) : resolve())));
  if (port === 3100 || port === 55432) return unusedPort();
  return port;
}
let local, admin, pool, server, runner, log;
let serverFailure;
let resultCode = 1;
let stopping = false;
async function stopChild(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  for (let attempt = 0; attempt < 50 && child.exitCode === null && child.signalCode === null; attempt++)
    await sleep(100);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await once(child, 'exit');
  }
}
async function cleanup() {
  if (stopping) return;
  stopping = true;
  await stopChild(runner);
  await stopChild(server);
  await pool?.end();
  await admin?.end();
  await local?.cluster.stop();
  await log?.close();
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  });
try {
  const dbPort = await unusedPort();
  let port = await unusedPort();
  while (port === dbPort) port = await unusedPort();
  const baseURL = `http://127.0.0.1:${port}`;
  local = await openLocalCluster(join(directory, 'postgres'), dbPort);
  await local.cluster.start();
  await provisionLocalDatabase(local);
  admin = createDatabase(local.adminUrl);
  await migrate(admin);
  await grantApplicationAccess(admin);
  pool = createDatabase(local.appUrl);
  const options = { secret: randomBytes(48).toString('hex'), baseURL };
  const password = `Fictional-${randomBytes(24).toString('hex')}`;
  const people = {};
  const ownerId = await createFirstOwner(pool, options, {
    name: 'QA Owner',
    email: 'qa-owner@example.test',
    password,
  });
  const workspace = (await admin.query('SELECT workspace_id FROM membership WHERE user_id=$1', [ownerId]))
    .rows[0].workspace_id;
  people.owner = { id: ownerId, name: 'QA Owner', email: 'qa-owner@example.test' };
  const signup = createAuthentication(pool, { ...options, allowSignup: true });
  for (const [key, role, name] of [
    ['editor', 'editor', 'QA Editor'],
    ['viewer', 'viewer', 'QA Viewer'],
    ['colleague', 'editor', 'QA Colleague'],
  ]) {
    const email = `qa-${key}@example.test`;
    const user = (await signup.api.signUpEmail({ body: { name, email, password } })).user;
    await admin.query('INSERT INTO membership(workspace_id,user_id,role) VALUES($1,$2,$3)', [
      workspace,
      user.id,
      role,
    ]);
    people[key] = { id: user.id, name, email };
  }
  const release = join(directory, 'release');
  await cp(join(root, '.next/standalone'), release, { recursive: true, verbatimSymlinks: true });
  await cp(join(root, '.next/static'), join(release, '.next/static'), { recursive: true });
  await cp(join(root, 'public'), join(release, 'public'), { recursive: true });
  const attachments = join(directory, 'attachments');
  await mkdir(attachments, { mode: 0o700 });
  // These explicit settings always override any inherited development configuration.
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    HOSTNAME: '127.0.0.1',
    PORT: String(port),
    DATABASE_URL: local.appUrl,
    AUTH_SECRET: options.secret,
    AUTH_BASE_URL: baseURL,
    ATTACHMENT_ROOT: attachments,
    WORKSPACE_MODE: 'accounts',
  };
  log = await open(join(directory, 'server.log'), 'a', 0o600);
  async function startServer() {
    server = spawn(process.execPath, [join(release, 'server.js')], {
      cwd: release,
      env,
      stdio: ['ignore', log.fd, log.fd],
    });
    server.on('error', (error) => {
      serverFailure = error;
    });
    await once(server, 'spawn');
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (serverFailure) throw serverFailure;
      if (server.exitCode !== null || server.signalCode !== null)
        throw new Error('Isolated app exited; inspect the run server.log.');
      try {
        const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(500) });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* bounded readiness retry */
      }
      await sleep(100);
    }
    if (!ready) throw new Error('Isolated app did not start.');
  }
  await startServer();
  for (const [key, person] of Object.entries(people)) {
    // Only this disposable server receives generated fictional credentials. No browser password entry.
    const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { origin: baseURL, 'content-type': 'application/json' },
      body: JSON.stringify({ email: person.email, password }),
    });
    if (!response.ok) throw new Error(`Disposable ${key} login failed (${response.status}).`);
    const cookies = response.headers.getSetCookie().map((header) => {
      const pair = header.split(';', 1)[0],
        split = pair.indexOf('=');
      return {
        name: pair.slice(0, split),
        value: pair.slice(split + 1),
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
        expires: -1,
      };
    });
    person.storageState = join(directory, `${key}-session.json`);
    await writeFile(person.storageState, JSON.stringify({ cookies, origins: [] }), { mode: 0o600 });
    // A successful authenticated snapshot ties readiness to this database and account,
    // not merely a response from an unrelated service that raced for the ephemeral port.
    const snapshot = await fetch(`${baseURL}/api/work`, {
      headers: { cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ') },
    });
    if (!snapshot.ok || (await snapshot.json()).actor.id !== person.id)
      throw new Error('Isolated server identity check failed.');
  }
  const manifest = join(directory, 'manifest.json');
  await writeFile(manifest, JSON.stringify({ directory, baseURL, adminURL: local.adminUrl, people }), {
    mode: 0o600,
  });
  console.log(`Disposable browser-test environment ready at ${baseURL}. Artifacts: ${directory}`);
  if (args[0] === '--setup-check') {
    console.log(
      'Setup check passed: isolated database, migrations, four accounts, app and authenticated snapshots. No browser launched.',
    );
    resultCode = 0;
  } else if (args[0] === '--restart-check') {
    process.env.PLAYWRIGHT_BROWSERS_PATH = join(root, '.local/playwright-browsers');
    const { checkAppRestart } = await import('./restart-check.mjs');
    await checkAppRestart({
      directory,
      baseURL,
      people,
      restart: async () => {
        if (!server?.pid || server.exitCode !== null || server.signalCode !== null)
          throw new Error('Expected the owned disposable app to be running.');
        const oldPid = server.pid;
        const exited = once(server, 'exit');
        server.kill('SIGKILL');
        await exited;
        // Real downtime with no app process; the PostgreSQL fixture stays up.
        await sleep(1250);
        serverFailure = null;
        await startServer();
        if (server.pid === oldPid) throw new Error('Expected a new app process.');
        return { before: oldPid, after: server.pid };
      },
    });
    resultCode = 0;
  } else if (args[0] === '--serve') {
    await writeFile(
      join(directory, 'fictional-logins.json'),
      JSON.stringify({
        password,
        people: Object.fromEntries(Object.entries(people).map(([key, person]) => [key, person.email])),
      }),
      { mode: 0o600 },
    );
    console.log(
      'Fixture server only; no browser launched. Use the supported browser and fictional-logins.json. Stop with Ctrl+C.',
    );
    await new Promise(() => {});
  } else {
    runner = spawn(
      process.execPath,
      [
        join(root, 'node_modules/@playwright/test/cli.js'),
        'test',
        '--config',
        join(root, 'playwright.config.mjs'),
        ...(grep ? ['--grep', grep] : []),
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          PLAYWRIGHT_BROWSERS_PATH: join(root, '.local/playwright-browsers'),
          WORKSPACE_E2E_MANIFEST: manifest,
        },
        stdio: 'inherit',
      },
    );
    const [code] = await once(runner, 'exit');
    resultCode = code ?? 1;
    if (serverFailure) throw serverFailure;
  }
} catch (error) {
  resultCode = 1;
  console.error(
    'Isolated browser checks could not finish:',
    error instanceof Error ? error.message : String(error),
  );
} finally {
  try {
    await cleanup();
    console.log(
      'Disposable app/database stopped. Retained artifacts contain fictional sessions; keep .local private.',
    );
  } catch (error) {
    resultCode = 1;
    console.error(
      'Disposable environment cleanup failed; inspect this run before removing it:',
      error instanceof Error ? error.message : String(error),
    );
  }
  // The pinned dependency's async-exit-hook forces beforeExit to code 0.
  // All owned resources are already stopped; flush our output and preserve
  // the actual test result explicitly instead of entering that hook.
  await new Promise((resolve) => process.stdout.write('', resolve));
  await new Promise((resolve) => process.stderr.write('', resolve));
  process.exit(resultCode);
}
