import { cp, mkdir, readFile, writeFile, open } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';

// Run a snapshot, never the .next directory that the next build will replace.
const root = resolve(import.meta.dirname, '..');
const local = join(root, '.local');
const build = (await readFile(join(root, '.next/BUILD_ID'), 'utf8')).trim();
if (!/^[\w-]+$/.test(build)) throw new Error('Unexpected build identifier.');
const release = join(local, 'preview-releases', `${Date.now()}-${build}`);
await mkdir(release, { recursive: true });
await cp(join(root, '.next/standalone'), release, { recursive: true, verbatimSymlinks: true });
await cp(join(root, '.next/static'), join(release, '.next/static'), { recursive: true });
await cp(join(root, 'public'), join(release, 'public'), { recursive: true });
const env = { ...process.env };
for (const file of ['database.env', 'auth.env']) {
  for (const line of (await readFile(join(local, file), 'utf8')).split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const split = line.indexOf('=');
    if (split < 1) throw new Error('Invalid local configuration.');
    env[line.slice(0, split)] = line.slice(split + 1);
  }
}
// Local configuration must not accidentally expose this preview to the LAN.
env.HOSTNAME = '127.0.0.1'; env.PORT = '3100';
const pidFile = join(local, 'preview-server.pid');
const releaseFile = join(local, 'preview-release.txt');
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
function output(command, args) {
  try { return execFileSync(command, args, { encoding: 'utf8' }); }
  catch (error) { if (error.status === 1) return ''; throw error; }
}
function exists(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}
function listeners() {
  return [...new Set(output('/usr/sbin/lsof', ['-nP', '-iTCP:3100', '-sTCP:LISTEN', '-Fp'])
    .split('\n').filter(line => /^p[0-9]+$/.test(line)).map(line => Number(line.slice(1))))];
}
let previous;
try {
  const recorded = (await readFile(pidFile, 'utf8')).trim();
  if (!/^[1-9][0-9]*$/.test(recorded) || !Number.isSafeInteger(Number(recorded))) throw new Error('Invalid recorded preview PID; leaving processes alone.');
  previous = Number(recorded);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const currentListeners = listeners();
if (currentListeners.some(pid => pid !== previous)) throw new Error('Port 3100 is used by another process; leaving it alone.');
if (previous && exists(previous)) {
  const command = output('ps', ['-p', String(previous), '-o', 'command=']).trim();
  const cwd = output('/usr/sbin/lsof', ['-a', '-p', String(previous), '-d', 'cwd', '-Fn'])
    .split('\n').find(line => line.startsWith('n'))?.slice(1);
  let recordedRelease;
  try { recordedRelease = (await readFile(releaseFile, 'utf8')).trim(); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const releaseRoot = join(local, 'preview-releases');
  const safeRecordedRelease = recordedRelease && resolve(recordedRelease).startsWith(`${releaseRoot}/`) && resolve(recordedRelease) === recordedRelease;
  const legacyCwd = join(root, '.next', 'standalone');
  if (command !== 'next-server (v16.3.6)' || !cwd || !(cwd === legacyCwd || (safeRecordedRelease && cwd === recordedRelease))) {
    throw new Error('Recorded process does not belong to this project preview; leaving it alone.');
  }
  process.kill(previous, 'SIGTERM');
  for (let attempt = 0; attempt < 50 && exists(previous); attempt++) await sleep(100);
  if (exists(previous)) throw new Error('Previous preview has not stopped; no replacement was started.');
}
if (listeners().length) throw new Error('Port 3100 is still occupied; no replacement was started.');
const log = await open(join(local, 'preview-server.log'), 'a', 0o600);
const child = spawn(process.execPath, [join(release, 'server.js')], { cwd: release, env, detached: true, stdio: ['ignore', log.fd, log.fd] });
let exited = false;
child.once('exit', () => { exited = true; });
try {
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  await log.close();
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (exited || child.exitCode !== null || child.signalCode !== null || !exists(child.pid)) throw new Error('New preview exited during startup; inspect .local/preview-server.log.');
    const owners = listeners();
    if (owners.some(pid => pid !== child.pid)) throw new Error('Another process took port 3100; preview was not activated.');
    if (owners.length === 1 && owners[0] === child.pid) {
      try {
        const response = await fetch('http://127.0.0.1:3100/api/health', { signal: AbortSignal.timeout(1000) });
        const confirmedOwners = listeners();
        if (response.ok && !exited && child.exitCode === null && child.signalCode === null && confirmedOwners.length === 1 && confirmedOwners[0] === child.pid) { ready = true; break; }
      } catch { /* Retry only while this child remains alive and owns the port. */ }
    }
    await sleep(200);
  }
  if (!ready) throw new Error('Preview did not become ready; inspect .local/preview-server.log.');
  // Keep old active records intact until the replacement demonstrably owns 3100.
  await writeFile(releaseFile, release);
  await writeFile(pidFile, String(child.pid));
  child.unref();
  console.log(`Preview ready at http://127.0.0.1:3100 (PID ${child.pid}). Its build snapshot is isolated from future builds.`);
} catch (error) {
  if (child.pid && !exited && child.exitCode === null && child.signalCode === null && exists(child.pid)) child.kill('SIGTERM');
  await log.close();
  throw error;
}
