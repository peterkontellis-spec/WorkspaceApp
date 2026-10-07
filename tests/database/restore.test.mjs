import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdir, mkdtemp, cp, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { join } from 'node:path';
import {
  localRoot,
  openLocalCluster,
  provisionLocalDatabase,
  grantApplicationAccess,
} from '../../scripts/db/local.mjs';
import { migrate } from '../../scripts/db/migrate.mjs';
import { createDatabase } from '../../src/server/database.mjs';
import { createAuthentication, verifiedActor } from '../../src/server/auth-core.mjs';
import { createFirstOwner } from '../../src/server/account-operator.mjs';
import { authHttpHandler } from '../../src/server/auth-http.mjs';
import { workHttpHandler } from '../../src/server/work-http.mjs';
import { timeHttpHandler } from '../../src/server/time-http.mjs';
import { filesHttpHandler } from '../../src/server/files-http.mjs';

// No external database/configuration arguments: only fictional records and
// fresh loopback clusters under the ignored test root are accepted.
async function unusedPort() {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close((error) => (error ? reject(error) : resolve())));
  return [3100, 55432].includes(port) ? unusedPort() : port;
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function digestFiles(directory) {
  const values = [];
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name),
      info = await stat(path);
    assert.ok(info.isFile());
    values.push({ path: name, bytes: info.size, sha256: hash(await readFile(path)) });
  }
  return values;
}
async function fingerprints(pool) {
  const result = {};
  for (const { tablename } of (
    await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
  ).rows) {
    assert.match(tablename, /^[a-z_]+$/);
    const rows = (
      await pool.query(
        `SELECT row_to_json(t)::text AS value FROM "${tablename}" t ORDER BY row_to_json(t)::text`,
      )
    ).rows;
    result[tablename] = { count: rows.length, sha256: hash(JSON.stringify(rows.map((row) => row.value))) };
  }
  return result;
}
const cookies = (response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
function request(baseURL, route, cookie, body) {
  return new Request(`${baseURL}${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { cookie: cookie ?? '', origin: baseURL, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function jsonOK(response, expected = 200) {
  assert.equal(response.status, expected, await response.clone().text());
  return response.json();
}
async function login(pool, auth, options, email, password) {
  const response = await authHttpHandler(
    auth,
    pool,
    options.baseURL,
  )(request(options.baseURL, '/api/auth/sign-in/email', '', { email, password }));
  assert.equal(response.status, 200, await response.clone().text());
  return cookies(response);
}

test(
  'cold physical backup restores a fresh isolated cluster, identities, work, time audit and attachment bytes',
  { timeout: 90000 },
  async () => {
    process.umask(0o077);
    await mkdir(`${localRoot}tests`, { recursive: true, mode: 0o700 });
    const directory = await mkdtemp(`${localRoot}tests/restore-`);
    const sourceRoot = join(directory, 'source'),
      backupRoot = join(directory, 'backup'),
      restoredRoot = join(directory, 'restored');
    const sourcePort = await unusedPort();
    let restoredPort = await unusedPort();
    while (restoredPort === sourcePort) restoredPort = await unusedPort();
    let source,
      restored,
      admin,
      pool,
      restoredAdmin,
      restoredPool,
      sourceStopped = false;
    const options = { secret: randomBytes(48).toString('hex'), baseURL: 'http://127.0.0.1:3100' };
    const password = `Fictional-restore-${randomBytes(24).toString('hex')}`,
      sourceStorage = join(sourceRoot, 'attachments');
    const evidence = {
      kind: 'cold-physical-recovery',
      status: 'incomplete',
      sourcePort,
      restoredPort,
      checks: [],
      limitations: [
        'Clean shutdown and stopped writers required.',
        'Same PostgreSQL major version and compatible platform/binaries required.',
        'Local fictional fixture only; not NAS, offsite, encryption or retention validation.',
        'Physical data, attachment bytes and authentication configuration must be recovered together.',
      ],
    };
    try {
      await mkdir(sourceStorage, { recursive: true, mode: 0o700 });
      await writeFile(join(sourceRoot, 'auth-config.json'), JSON.stringify(options), { mode: 0o600 });
      source = await openLocalCluster(join(sourceRoot, 'postgres'), sourcePort);
      await source.cluster.start();
      await provisionLocalDatabase(source);
      admin = createDatabase(source.adminUrl);
      await migrate(admin);
      await grantApplicationAccess(admin);
      pool = createDatabase(source.appUrl);
      let auth = createAuthentication(pool, options);
      const owner = await createFirstOwner(pool, options, {
        name: 'Restore Owner',
        email: 'restore-owner@example.test',
        password,
      });
      const ownerCookie = await login(pool, auth, options, 'restore-owner@example.test', password);
      const workspace = (await verifiedActor(auth, pool, new Headers({ cookie: ownerCookie }))).workspaceId;
      const outsiderWorkspace = (
        await admin.query("INSERT INTO workspace(name) VALUES('Other restore workspace') RETURNING id")
      ).rows[0].id;
      const users = { owner: { id: owner, cookie: ownerCookie } };
      for (const [name, role, target] of [
        ['editor', 'editor', workspace],
        ['viewer', 'viewer', workspace],
        ['outsider', 'owner', outsiderWorkspace],
      ]) {
        const id = (
          await createAuthentication(pool, { ...options, allowSignup: true }).api.signUpEmail({
            body: { name: `Restore ${name}`, email: `restore-${name}@example.test`, password },
          })
        ).user.id;
        await admin.query('INSERT INTO membership(workspace_id,user_id,role) VALUES($1,$2,$3)', [
          target,
          id,
          role,
        ]);
        users[name] = {
          id,
          cookie: await login(pool, auth, options, `restore-${name}@example.test`, password),
        };
      }
      const work = workHttpHandler(pool, auth, options),
        time = timeHttpHandler(pool, auth, options);
      let snapshot = await jsonOK(
        await work(
          request(options.baseURL, '/api/work', ownerCookie, {
            action: 'createBoard',
            name: 'Recovery evidence',
          }),
        ),
      );
      const board = snapshot.boards[0],
        group = snapshot.groups[0];
      snapshot = await jsonOK(
        await work(
          request(options.baseURL, '/api/work', ownerCookie, {
            action: 'createTask',
            boardId: board.id,
            groupId: group.id,
            title: 'Synthetic recovery record',
            assigneeIds: [users.editor.id],
          }),
        ),
      );
      let task = snapshot.tasks[0];
      snapshot = await jsonOK(
        await work(
          request(options.baseURL, '/api/work', ownerCookie, {
            action: 'updateTask',
            id: task.id,
            revision: task.revision,
            patch: { notes: 'Only fictional recovery data.' },
          }),
        ),
      );
      task = snapshot.tasks[0];
      const timer = (
        await jsonOK(
          await time(
            request(options.baseURL, '/api/time', users.editor.cookie, {
              action: 'start',
              creationId: randomUUID(),
              taskId: task.id,
              taskRevision: task.revision,
            }),
          ),
        )
      ).entry;
      await admin.query("UPDATE time_entry SET started_at=started_at-interval '90 seconds' WHERE id=$1", [
        timer.id,
      ]);
      const stopped = (
        await jsonOK(
          await time(
            request(options.baseURL, '/api/time', users.editor.cookie, {
              action: 'stop',
              id: timer.id,
              revision: timer.revision,
            }),
          ),
        )
      ).entry;
      const corrected = (
        await jsonOK(
          await time(
            request(options.baseURL, '/api/time', users.editor.cookie, {
              action: 'update',
              id: timer.id,
              revision: stopped.revision,
              patch: {
                workDate: '2026-01-15',
                durationSeconds: 120,
                notes: 'Fictional correction retained in audit.',
              },
            }),
          ),
        )
      ).entry;
      const active = (
        await jsonOK(
          await time(
            request(options.baseURL, '/api/time', ownerCookie, {
              action: 'start',
              creationId: randomUUID(),
              taskId: task.id,
              taskRevision: task.revision,
            }),
          ),
        )
      ).entry;
      const attachmentBytes = Buffer.from(
        'Synthetic recovery attachment\nΑνάκτηση αρχείου\n' + 'verified byte sequence '.repeat(50),
      );
      const fileHandler = filesHttpHandler(pool, auth, { ...options, storageRoot: sourceStorage });
      const file = (
        await jsonOK(
          await fileHandler(
            new Request(`${options.baseURL}/api/files?taskId=${task.id}`, {
              method: 'POST',
              headers: {
                cookie: users.editor.cookie,
                origin: options.baseURL,
                'content-type': 'application/octet-stream',
                'x-upload-name': encodeURIComponent('recovery-evidence.txt'),
              },
              body: attachmentBytes,
            }),
          ),
          201,
        )
      ).file;
      const before = await fingerprints(admin),
        attachmentManifest = await digestFiles(sourceStorage);
      assert.equal(attachmentManifest.length, 1);
      evidence.postgresVersion = (await admin.query('SHOW server_version')).rows[0].server_version;
      evidence.tableFingerprints = before;
      evidence.attachmentManifest = attachmentManifest;
      // Stop all fixture writers and close connections BEFORE either physical copy.
      await pool.end();
      pool = null;
      await admin.end();
      admin = null;
      await source.cluster.stop();
      sourceStopped = true;
      assert.equal((await readdir(join(sourceRoot, 'postgres/data'))).includes('postmaster.pid'), false);
      await cp(sourceRoot, backupRoot, {
        recursive: true,
        errorOnExist: true,
        force: false,
        preserveTimestamps: true,
      });
      await cp(backupRoot, restoredRoot, {
        recursive: true,
        errorOnExist: true,
        force: false,
        preserveTimestamps: true,
      });
      assert.deepEqual(await digestFiles(join(backupRoot, 'attachments')), attachmentManifest);
      assert.deepEqual(await digestFiles(join(restoredRoot, 'attachments')), attachmentManifest);
      assert.notEqual(
        (await stat(join(sourceRoot, 'postgres/data/PG_VERSION'))).ino,
        (await stat(join(restoredRoot, 'postgres/data/PG_VERSION'))).ino,
      );
      evidence.checks.push(
        'Source stopped cleanly before physical copy; source and backup retained; restored files are separate copies.',
      );
      restored = await openLocalCluster(join(restoredRoot, 'postgres'), restoredPort);
      await restored.cluster.start();
      restoredAdmin = createDatabase(restored.adminUrl);
      restoredPool = createDatabase(restored.appUrl);
      assert.equal((await restoredAdmin.query('SHOW port')).rows[0].port, String(restoredPort));
      assert.equal(
        (await restoredAdmin.query('SHOW listen_addresses')).rows[0].listen_addresses,
        '127.0.0.1',
      );
      assert.deepEqual(await fingerprints(restoredAdmin), before);
      assert.deepEqual(await migrate(restoredAdmin), []);
      evidence.checks.push(
        'Every public table fingerprint matches, including identities, sessions, memberships, task history, timer provenance/audit and migrations.',
      );
      const recoveredOptions = JSON.parse(await readFile(join(restoredRoot, 'auth-config.json'), 'utf8'));
      auth = createAuthentication(restoredPool, recoveredOptions);
      const restoredWork = workHttpHandler(restoredPool, auth, recoveredOptions),
        restoredTime = timeHttpHandler(restoredPool, auth, recoveredOptions);
      const restoredFiles = filesHttpHandler(restoredPool, auth, {
        ...recoveredOptions,
        storageRoot: join(restoredRoot, 'attachments'),
      });
      const recovered = await jsonOK(await restoredWork(request(options.baseURL, '/api/work', ownerCookie)));
      assert.equal(recovered.tasks[0].title, task.title);
      assert.equal(recovered.tasks[0].notes, task.notes);
      assert.equal(recovered.activeTimer.id, active.id);
      assert.equal(recovered.members.find((member) => member.id === users.viewer.id).role, 'viewer');
      assert.equal(
        (
          await restoredWork(
            request(options.baseURL, '/api/work', users.viewer.cookie, {
              action: 'createBoard',
              name: 'Not allowed',
            }),
          )
        ).status,
        403,
      );
      const report = await jsonOK(
        await restoredTime(
          request(
            options.baseURL,
            '/api/time?from=2026-01-01&to=2026-01-31&timeZone=UTC',
            users.viewer.cookie,
          ),
        ),
      );
      assert.equal(report.summary.totalSeconds, 120);
      assert.equal(report.entries.find((entry) => entry.id === timer.id).notes, corrected.notes);
      assert.equal(report.entries.find((entry) => entry.id === timer.id).adjusted, true);
      assert.equal(report.activeTimer, null);
      assert.equal(
        (
          await restoredTime(
            request(options.baseURL, '/api/time', users.viewer.cookie, {
              action: 'void',
              id: corrected.id,
              revision: corrected.revision,
            }),
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await restoredTime(
            request(options.baseURL, '/api/time', ownerCookie, {
              action: 'void',
              id: corrected.id,
              revision: corrected.revision,
            }),
          )
        ).status,
        403,
      );
      const download = await restoredFiles(
        request(options.baseURL, `/api/files/${file.id}`, users.viewer.cookie),
      );
      assert.equal(download.status, 200);
      assert.deepEqual(Buffer.from(await download.arrayBuffer()), attachmentBytes);
      assert.equal(
        (await restoredFiles(request(options.baseURL, `/api/files/${file.id}`, users.outsider.cookie)))
          .status,
        404,
      );
      assert.equal((await restoredFiles(request(options.baseURL, `/api/files/${file.id}`, ''))).status, 401);
      evidence.checks.push(
        'Restored sessions/roles/own-time rules and cross-workspace/unauthenticated file denials work through application handlers; attachment bytes match exactly.',
      );
      const newCookie = await login(
        restoredPool,
        auth,
        recoveredOptions,
        'restore-editor@example.test',
        password,
      );
      assert.ok(newCookie);
      const savedCorrection = await jsonOK(
        await restoredTime(
          request(options.baseURL, '/api/time', newCookie, {
            action: 'update',
            id: corrected.id,
            revision: corrected.revision,
            patch: {
              workDate: '2026-01-15',
              durationSeconds: 121,
              notes: 'Restored editor can still correct own record.',
            },
          }),
        ),
      );
      assert.equal(savedCorrection.entry.revision, corrected.revision + 1);
      assert.equal(
        (
          await restoredAdmin.query('SELECT count(*)::int n FROM time_entry_audit WHERE entry_id=$1', [
            corrected.id,
          ])
        ).rows[0].n,
        before.time_entry_audit.count + 1,
      );
      assert.deepEqual(await digestFiles(sourceStorage), attachmentManifest);
      assert.deepEqual(await digestFiles(join(backupRoot, 'attachments')), attachmentManifest);
      evidence.checks.push(
        'Fresh password login and authorized correction succeed while source and backup remain retained.',
      );
      evidence.status = 'passed';
    } finally {
      await Promise.allSettled([pool?.end(), admin?.end(), restoredPool?.end(), restoredAdmin?.end()]);
      if (source && !sourceStopped) await source.cluster.stop();
      await restored?.cluster.stop();
      await writeFile(join(directory, 'evidence.json'), JSON.stringify(evidence, null, 2), { mode: 0o600 });
      console.log(`Recovery evidence retained at ${directory}/evidence.json`);
    }
  },
);
