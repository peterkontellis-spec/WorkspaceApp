import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { after, before, test } from 'node:test';
import { mkdtemp, mkdir, copyFile, appendFile, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { localRoot, openLocalCluster, provisionLocalDatabase, grantApplicationAccess } from '../../scripts/db/local.mjs';
import { createDatabase, transaction } from '../../src/server/database.mjs';
import { migrate, migrationsDirectory } from '../../scripts/db/migrate.mjs';
import { seedDevelopment, developmentIds as d } from '../../scripts/db/seed.mjs';
import { readTask, renameTask } from '../../src/server/task-repository.mjs';

const migrationNames = (await readdir(migrationsDirectory)).filter((name) => /^\d{3}_.*\.sql$/.test(name)).sort();
let local, admin, app, directory;
before(async () => {
  await mkdir(`${localRoot}tests`, { recursive: true });
  directory = await mkdtemp(`${localRoot}tests/foundation-`);
  local = await openLocalCluster(`${directory}/postgres`, 55433);
  await local.cluster.start();
  await provisionLocalDatabase(local);
  admin = createDatabase(local.adminUrl);
});
after(async () => {
  await app?.end();
  await admin?.end();
  await local?.cluster.stop();
});

test('record survives an additive migration, idempotent seeding and an actual database restart', async () => {
  const first = `${directory}/first-migration`;
  await mkdir(first);
  await copyFile(`${migrationsDirectory}/001_foundation.sql`, `${first}/001_foundation.sql`);
  assert.equal((await migrate(admin, first)).length, 1);
  await seedDevelopment(admin);
  await admin.query('UPDATE task SET title = $1, revision = 7 WHERE id = $2', ['Keep this saved record', d.task]);
  assert.deepEqual(await migrate(admin), migrationNames.slice(1));
  assert.deepEqual(await migrate(admin), []);
  await seedDevelopment(admin);
  await grantApplicationAccess(admin);
  await admin.end(); admin = null;
  const originalPid = local.cluster.process.pid;
  await local.cluster.stop();
  await local.cluster.start();
  assert.notEqual(local.cluster.process.pid, originalPid);
  admin = createDatabase(local.adminUrl);
  app = createDatabase(local.appUrl);
  const task = await readTask(app, d.workspace, d.task, d.user);
  assert.equal(task.title, 'Keep this saved record');
  assert.equal(task.revision, 7);
  assert.equal(task.notes, '');
  assert.equal((await app.query('SELECT count(*)::int AS count FROM task')).rows[0].count, 1);
  assert.equal((await stat(`${directory}/postgres/credentials.json`)).mode & 0o777, 0o600);
});

test('migration checksum changes fail closed without altering saved records', async () => {
  const changed = `${directory}/changed-migration`;
  await mkdir(changed);
  for (const name of migrationNames) await copyFile(`${migrationsDirectory}/${name}`, `${changed}/${name}`);
  await appendFile(`${changed}/001_foundation.sql`, '\n-- rewritten history\n');
  await assert.rejects(migrate(admin, changed), /history differs/);
  assert.equal((await readTask(app, d.workspace, d.task, d.user)).title, 'Keep this saved record');
});

test('a failed schema update rolls back both its DDL and its migration record', async () => {
  const broken = `${directory}/broken-migration`;
  await mkdir(broken);
  for (const name of migrationNames) await copyFile(`${migrationsDirectory}/${name}`, `${broken}/${name}`);
  await writeFile(`${broken}/999_broken.sql`, 'CREATE TABLE should_roll_back(id integer); SELECT * FROM deliberately_missing_table;');
  await assert.rejects(migrate(admin, broken), { code: '42P01' });
  assert.equal((await admin.query("SELECT to_regclass('should_roll_back') AS name")).rows[0].name, null);
  assert.equal((await admin.query('SELECT count(*)::int AS count FROM schema_migration')).rows[0].count, migrationNames.length);
  assert.deepEqual(await migrate(admin), []);
});

test('two concurrent migrations serialize and do not run twice', async () => {
  assert.deepEqual(await Promise.all([migrate(admin), migrate(admin)]), [[], []]);
});

test('competing writes save one revision and report one conflict without lost updates', async () => {
  const current = await readTask(app, d.workspace, d.task, d.user);
  const outcomes = await Promise.all(['First editor', 'Second editor'].map((title) => renameTask(app, {
    workspaceId: d.workspace, taskId: d.task, actorId: d.user, revision: current.revision, title,
  })));
  assert.deepEqual(outcomes.map((r) => r.outcome).sort(), ['conflict', 'saved']);
  const saved = await readTask(app, d.workspace, d.task, d.user);
  assert.equal(saved.revision, current.revision + 1);
  assert.equal(saved.title, outcomes.find((r) => r.outcome === 'saved').task.title);
});

test('viewer may read but cannot edit; unknown and revoked identities cannot read', async () => {
  await admin.query("INSERT INTO app_user(id, display_name) VALUES ('development-viewer','Viewer')");
  await admin.query("INSERT INTO membership(workspace_id,user_id,role) VALUES ($1,'development-viewer','viewer')", [d.workspace]);
  assert.ok(await readTask(app, d.workspace, d.task, 'development-viewer'));
  const before = await readTask(app, d.workspace, d.task, d.user);
  assert.equal((await renameTask(app, { workspaceId: d.workspace, taskId: d.task, actorId: 'development-viewer', revision: before.revision, title: 'Denied change' })).outcome, 'denied');
  assert.equal(await readTask(app, d.workspace, d.task, 'missing-account'), null);
  await admin.query("DELETE FROM membership WHERE user_id='development-viewer'");
  assert.equal(await readTask(app, d.workspace, d.task, 'development-viewer'), null);
  assert.equal((await readTask(app, d.workspace, d.task, d.user)).title, before.title);
});

test('database constraints reject cross-workspace groups, nonmember assignees and invalid task values', async () => {
  const other = '10000000-0000-4000-8000-000000000002';
  await admin.query("INSERT INTO workspace(id,name) VALUES ($1, 'Other workspace')", [other]);
  const badInserts = [
    ['INSERT INTO task(workspace_id,board_id,group_id,title) VALUES ($1,$2,$3,$4)', [other,d.board,d.group,'Invalid workspace'], '23503'],
    ['INSERT INTO task_assignee(workspace_id,task_id,user_id) VALUES ($1,$2,$3)', [d.workspace,d.task,'development-viewer'], '23503'],
    ['UPDATE task SET title=$1 WHERE id=$2', [' ',d.task], '23514'],
    ['UPDATE task SET status=$1 WHERE id=$2', ['Invented',d.task], '23514'],
    ['UPDATE task SET due_date=$1 WHERE id=$2', ['2026-02-30',d.task], '22008'],
    ['UPDATE task SET parent_id=id WHERE id=$1', [d.task], '23514'],
  ];
  for (const [query, values, code] of badInserts) await assert.rejects(app.query(query, values), { code });
  assert.equal(await readTask(app, other, d.task, d.user), null);
});

test('application connection cannot create schemas, alter tables or modify migration history', async () => {
  await assert.rejects(app.query('CREATE TABLE unauthorized_table(id integer)'), { code: '42501' });
  await assert.rejects(app.query('ALTER TABLE task ADD COLUMN unauthorized text'), { code: '42501' });
  await assert.rejects(app.query('DELETE FROM schema_migration'), { code: '42501' });
});

test('validation and SQL parameters preserve literal text and failed transactions roll back', async () => {
  const before = await readTask(app, d.workspace, d.task, d.user);
  assert.equal((await renameTask(app, { workspaceId: d.workspace, taskId: d.task, actorId: d.user, revision: before.revision, title: '   ' })).outcome, 'invalid');
  const title = "Robert'); DROP TABLE task;--";
  const result = await renameTask(app, { workspaceId: d.workspace, taskId: d.task, actorId: d.user, revision: before.revision, title });
  assert.equal(result.outcome, 'saved');
  assert.equal((await readTask(app, d.workspace, d.task, d.user)).title, title);
  await assert.rejects(transaction(app, async (c) => {
    await c.query('UPDATE task SET title=$1 WHERE id=$2', ['Must roll back', d.task]);
    throw new Error('Abort transaction');
  }), /Abort transaction/);
  assert.equal((await readTask(app, d.workspace, d.task, d.user)).title, title);
});

test('database is loopback-only, uses password authentication, and leaves no init password files', async () => {
  assert.equal((await admin.query('SHOW listen_addresses')).rows[0].listen_addresses, '127.0.0.1');
  assert.equal((await admin.query('SHOW unix_socket_directories')).rows[0].unix_socket_directories, '');
  const rules = await readFile(`${directory}/postgres/data/pg_hba.conf`, 'utf8');
  const active = rules.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
  assert.ok(active.every((line) => line.includes('scram-sha-256')));
  assert.deepEqual((await readdir(`${localRoot}tmp`)).filter((name) => name.startsWith('pg-password-')), []);
  const wrong = createDatabase(local.appUrl.replace(local.config.appPassword, 'wrong-password'));
  try { await assert.rejects(wrong.query('SELECT 1'), { code: '28P01' }); }
  finally { await wrong.end(); }
});


test('a second database startup fails promptly without stopping the first server', async () => {
  const source = `
    import { openLocalCluster } from './scripts/db/local.mjs';
    const local = await openLocalCluster(${JSON.stringify(`${directory}/postgres`)}, 55433);
    try { await local.cluster.start(); }
    catch { process.exitCode = 1; }
    finally { await local.cluster.stop(); }
    if (process.exitCode) process.exit(process.exitCode);
  `;
  await assert.rejects(promisify(execFile)(process.execPath, ['--input-type=module', '-e', source], { timeout: 5000 }),
    (error) => error.code === 1 && !error.killed);
  assert.equal((await app.query('SELECT 1 AS alive')).rows[0].alive, 1);
});
