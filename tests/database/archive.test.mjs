import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir } from 'node:fs/promises';
import {
  localRoot,
  openLocalCluster,
  provisionLocalDatabase,
  grantApplicationAccess,
} from '../../scripts/db/local.mjs';
import { createDatabase } from '../../src/server/database.mjs';
import { migrate } from '../../scripts/db/migrate.mjs';
import { createAuthentication, verifiedActor } from '../../src/server/auth-core.mjs';
import { createFirstOwner } from '../../src/server/account-operator.mjs';
import { authHttpHandler } from '../../src/server/auth-http.mjs';
import { workHttpHandler } from '../../src/server/work-http.mjs';
import { uploadFile, listFiles, downloadFile } from '../../src/server/files-core.mjs';

// Server time advances on each read; all durable fields, including the active
// timer, must still match across retries, rollback and database restart.
function stableSnapshot({ serverNow, ...saved }) {
  assert.ok(Number.isFinite(Date.parse(serverNow)));
  return saved;
}
let local, admin, pool, auth, handle, owner, ownerCookie, workspace;
const options = { secret: randomBytes(48).toString('hex'), baseURL: 'http://127.0.0.1:3100' };
const password = 'Disposable work test password 123!';
const cookies = (res) =>
  res.headers
    .getSetCookie()
    .map((x) => x.split(';')[0])
    .join('; ');
const request = (body, cookie = ownerCookie, origin = options.baseURL) =>
  new Request(`${options.baseURL}/api/work`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { origin, 'content-type': 'application/json', cookie: cookie ?? '' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const work = (body, cookie, origin) => handle(request(body, cookie, origin));
async function ok(body, cookie) {
  const res = await work(body, cookie);
  assert.equal(res.status, 200, await res.clone().text());
  return res.json();
}
async function login(email) {
  const res = await authHttpHandler(
    auth,
    pool,
    options.baseURL,
  )(
    new Request(`${options.baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { origin: options.baseURL, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  );
  assert.equal(res.status, 200, await res.clone().text());
  return cookies(res);
}
async function member(email, role = 'editor', inWorkspace = workspace) {
  const user = (
    await createAuthentication(pool, { ...options, allowSignup: true }).api.signUpEmail({
      body: { name: email, email, password },
    })
  ).user.id;
  await admin.query('INSERT INTO membership(workspace_id,user_id,role) VALUES($1,$2,$3)', [
    inWorkspace,
    user,
    role,
  ]);
  return { id: user, cookie: await login(email) };
}
async function board(name = 'Project') {
  const data = await ok({ action: 'createBoard', name });
  const b = data.boards.find((x) => x.name === name);
  return { ...b, group: data.groups.find((x) => x.boardId === b.id).id };
}
async function task(b, title = 'Task', extra = {}) {
  const data = await ok({ action: 'createTask', boardId: b.id, groupId: b.group, title, ...extra });
  return data.tasks.find((x) => x.title === title);
}
before(async () => {
  await mkdir(`${localRoot}tests`, { recursive: true });
  local = await openLocalCluster(`${await mkdtemp(`${localRoot}tests/archive-`)}/postgres`, 55440);
  await local.cluster.start();
  await provisionLocalDatabase(local);
  admin = createDatabase(local.adminUrl);
  await migrate(admin);
  await grantApplicationAccess(admin);
  pool = createDatabase(local.appUrl);
  auth = createAuthentication(pool, options);
  handle = workHttpHandler(pool, auth, options);
});
beforeEach(async () => {
  await admin.query(
    'TRUNCATE workspace,app_user,auth_user,auth_rate_limit,auth_verification,invitation_rate_limit CASCADE',
  );
  owner = await createFirstOwner(pool, options, { name: 'Owner', email: 'owner@example.test', password });
  ownerCookie = await login('owner@example.test');
  workspace = (await verifiedActor(auth, pool, new Headers({ cookie: ownerCookie }))).workspaceId;
});
after(async () => {
  await pool?.end();
  await admin?.end();
  await local?.cluster.stop();
});
const archived = (data, id) => data.archivedTasks.find((x) => x.id === id);
const transition = (action, item, cookie) => ok({ action, id: item.id, revision: item.revision }, cookie);

test('role checks, revision conflicts, no-op transitions and workspace isolation apply to archives', async () => {
  const editor = await member('editor@example.test'),
    viewer = await member('viewer@example.test', 'viewer');
  const b = await board(),
    t = await task(b);
  for (const action of ['archiveTask', 'restoreTask'])
    assert.equal((await work({ action, id: t.id, revision: 1 }, viewer.cookie)).status, 403);
  for (const action of ['archiveBoard', 'restoreBoard'])
    assert.equal((await work({ action, id: b.id, revision: 1 }, editor.cookie)).status, 403);
  let data = await transition('archiveTask', t, editor.cookie),
    a = archived(data, t.id);
  assert.equal(data.tasks.length, 0);
  assert.equal(a.archivedBy, editor.id);
  assert.ok(a.archivedAt);
  assert.equal(a.revision, 2);
  assert.equal((await work({ action: 'archiveTask', id: t.id, revision: 1 })).status, 409);
  assert.equal(archived(await transition('archiveTask', a), t.id).revision, 2);
  assert.equal(
    (await admin.query('SELECT count(*)::int n FROM task_activity WHERE task_id=$1', [t.id])).rows[0].n,
    2,
  );
  data = await transition('restoreTask', a, editor.cookie);
  assert.equal(data.tasks[0].revision, 3);
  assert.equal((await transition('restoreTask', data.tasks[0])).tasks[0].revision, 3);
  const other = (await admin.query("INSERT INTO workspace(name) VALUES('Other') RETURNING id")).rows[0].id;
  const outsider = await member('outside@example.test', 'owner', other);
  assert.equal((await work({ action: 'archiveTask', id: t.id, revision: 3 }, outsider.cookie)).status, 404);
  assert.equal((await ok(undefined, outsider.cookie)).archivedTasks.length, 0);
});

test('parent archive restores its own subtree batch while prior archived children remain archived', async () => {
  const b = await board(),
    parent = await task(b, 'Parent'),
    child = await task(b, 'Child', { parentId: parent.id }),
    grandchild = await task(b, 'Grandchild', { parentId: child.id }),
    prior = await task(b, 'Previously archived', { parentId: parent.id });
  await transition('archiveTask', prior);
  let data = await transition('archiveTask', parent);
  assert.equal(data.tasks.length, 0);
  assert.equal(data.archivedTasks.length, 4);
  const batch = archived(data, parent.id).archiveBatchId;
  assert.equal(archived(data, child.id).archiveBatchId, batch);
  assert.equal(archived(data, grandchild.id).archiveBatchId, batch);
  assert.notEqual(archived(data, prior.id).archiveBatchId, batch);
  assert.equal((await work({ action: 'restoreTask', id: child.id, revision: 2 })).status, 409);
  assert.equal(
    (await work({ action: 'updateTask', id: child.id, revision: 2, patch: { title: 'Blocked' } })).status,
    409,
  );
  assert.equal(
    (
      await work({
        action: 'createTask',
        boardId: b.id,
        groupId: b.group,
        title: 'Blocked',
        parentId: parent.id,
      })
    ).status,
    409,
  );
  data = await transition('restoreTask', archived(data, parent.id));
  assert.equal(data.tasks.length, 3);
  assert.equal(data.archivedTasks.length, 1);
  assert.equal(data.archivedTasks[0].id, prior.id);
  assert.equal(data.tasks.find((x) => x.id === grandchild.id).parentId, child.id);
  const events = (
    await admin.query(
      'SELECT summary,actor_name,created_at FROM task_activity WHERE task_id=$1 ORDER BY id',
      [child.id],
    )
  ).rows;
  assert.deepEqual(
    events.map((x) => x.summary),
    ['Created this task.', 'Archived this task.', 'Restored this task.'],
  );
  assert.equal(events[1].actor_name, 'Owner');
  assert.ok(events[1].created_at);
});

test('board archive freezes all writes and restoration preserves separately archived tasks and invalidates pre-archive drafts', async () => {
  const b = await board(),
    active = await task(b, 'Active'),
    prior = await task(b, 'Prior');
  let data = await ok({ action: 'createColumn', boardId: b.id, name: 'Label', kind: 'text' });
  const col = data.columns[0];
  const group = data.groups[0];
  await transition('archiveTask', prior);
  data = await transition('archiveBoard', b);
  const a = data.archivedBoards[0];
  assert.equal(data.boards.length, 0);
  assert.equal(data.tasks.length, 0);
  assert.equal(data.archivedTasks.length, 2);
  assert.ok(data.archivedTasks.every((x) => x.boardArchived));
  for (const input of [
    { action: 'updateBoard', id: b.id, revision: a.revision, name: 'Blocked' },
    { action: 'createTask', boardId: b.id, groupId: b.group, title: 'Blocked' },
    { action: 'updateTask', id: active.id, revision: 2, patch: { status: 'Done' } },
    { action: 'createGroup', boardId: b.id, name: 'Blocked' },
    { action: 'updateGroup', id: group.id, revision: 2, name: 'Blocked' },
    { action: 'createColumn', boardId: b.id, name: 'Blocked', kind: 'text' },
    { action: 'updateColumn', id: col.id, revision: 2, name: 'Blocked' },
    { action: 'restoreTask', id: prior.id, revision: 3 },
  ])
    assert.equal((await work(input)).status, 409, JSON.stringify(input));
  data = await transition('restoreBoard', a);
  assert.deepEqual(
    data.tasks.map((x) => x.id),
    [active.id],
  );
  assert.equal(data.archivedTasks[0].id, prior.id);
  assert.equal(data.archivedTasks[0].boardArchived, false);
  for (const input of [
    { action: 'updateTask', id: active.id, revision: 1, patch: { status: 'Done' } },
    { action: 'updateGroup', id: group.id, revision: 1, name: 'Stale' },
    { action: 'updateColumn', id: col.id, revision: 1, name: 'Stale' },
  ])
    assert.equal((await work(input)).status, 409);
  const audit = (await admin.query('SELECT event,actor_id FROM board_archive_activity ORDER BY id')).rows;
  assert.deepEqual(
    audit.map((x) => x.event),
    ['archived', 'restored'],
  );
  assert.ok(audit.every((x) => x.actor_id === owner));
});

test('archive races with writes atomically and notifies assignees once without losing history', async () => {
  const editor = await member('recipient@example.test');
  const b = await board(),
    t = await task(b, 'Race', { assigneeIds: [editor.id] });
  const results = await Promise.all([
    work({ action: 'archiveTask', id: t.id, revision: 1 }),
    work({ action: 'updateTask', id: t.id, revision: 1, patch: { status: 'Done' } }),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), [200, 409]);
  const data = await ok();
  assert.equal([...data.tasks, ...data.archivedTasks][0].revision, 2);
  assert.equal(
    (await admin.query('SELECT count(*)::int n FROM task_activity WHERE task_id=$1', [t.id])).rows[0].n,
    2,
  );
  assert.equal(
    (await admin.query('SELECT count(*)::int n FROM task_notification WHERE recipient_id=$1', [editor.id]))
      .rows[0].n,
    2,
  );
});

test('attachments remain readable in archive while new and in-flight uploads reject and clean their blobs', async () => {
  const b = await board(),
    t = await task(b);
  const storageRoot = await mkdtemp(`${localRoot}tests/archive-files-`);
  const fileOptions = { storageRoot };
  const headers = new Headers({ cookie: ownerCookie });
  const req = (body) =>
    new Request(`${options.baseURL}/api/files`, { method: 'POST', headers, body, duplex: 'half' });
  const uploaded = await uploadFile(pool, auth, req('retained bytes'), fileOptions, t.id, 'kept.txt');
  let streamController, signalRead;
  const readStarted = new Promise((resolve) => (signalRead = resolve));
  const stream = new ReadableStream({
    start(controller) {
      streamController = controller;
    },
    pull() {
      signalRead();
    },
  });
  const pending = uploadFile(pool, auth, req(stream), fileOptions, t.id, 'late.txt');
  // Wait until upload reached the authenticated body read, not just stream construction.
  // An existing temp blob proves the initial task guard completed.
  for (let tries = 0; tries < 100; tries++) {
    if ((await readdir(storageRoot)).some((x) => x.endsWith('.upload'))) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok((await readdir(storageRoot)).some((x) => x.endsWith('.upload')));
  await readStarted;
  const data = await transition('archiveTask', t);
  streamController.enqueue(new TextEncoder().encode('late bytes'));
  streamController.close();
  await assert.rejects(pending, (error) => error.status === 409);
  assert.equal((await readdir(storageRoot)).length, 1);
  assert.equal((await listFiles(pool, auth, headers, null)).files.length, 0);
  assert.equal((await listFiles(pool, auth, headers, t.id)).files[0].id, uploaded.file.id);
  const download = await downloadFile(pool, auth, headers, fileOptions, uploaded.file.id);
  assert.equal(await new Response(download.stream).text(), 'retained bytes');
  await assert.rejects(
    uploadFile(pool, auth, req('no'), fileOptions, t.id, 'no.txt'),
    (error) => error.status === 409,
  );
  await transition('restoreTask', archived(data, t.id));
  assert.equal((await listFiles(pool, auth, headers, null)).files.length, 1);
});

test('archive metadata and batch provenance persist after a database restart and migration rerun', async () => {
  const b = await board(),
    t = await task(b);
  await transition('archiveTask', t);
  await transition('archiveBoard', b);
  const saved = await ok();
  await migrate(admin);
  assert.deepEqual(stableSnapshot(await ok()), stableSnapshot(saved));
  await pool.end();
  pool = null;
  await admin.end();
  admin = null;
  await local.cluster.stop();
  await local.cluster.start();
  admin = createDatabase(local.adminUrl);
  pool = createDatabase(local.appUrl);
  auth = createAuthentication(pool, options);
  handle = workHttpHandler(pool, auth, options);
  assert.deepEqual(stableSnapshot(await ok()), stableSnapshot(saved));
});

test('an activity failure rolls back the entire parent archive, including earlier descendants', async () => {
  const b = await board(),
    parent = await task(b, 'Root'),
    child = await task(b, 'Child', { parentId: parent.id });
  const before = await ok();
  await admin.query(`CREATE FUNCTION reject_archive_child() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.task_id='${child.id}'::uuid AND NEW.summary='Archived this task.' THEN RAISE EXCEPTION 'test rollback'; END IF;
    RETURN NEW; END; $$; CREATE TRIGGER reject_archive_child BEFORE INSERT ON task_activity FOR EACH ROW EXECUTE FUNCTION reject_archive_child()`);
  try {
    assert.equal(
      (await work({ action: 'archiveTask', id: parent.id, revision: parent.revision })).status,
      503,
    );
    assert.deepEqual(stableSnapshot(await ok()), stableSnapshot(before));
    assert.equal((await admin.query('SELECT count(*)::int n FROM task_activity')).rows[0].n, 2);
  } finally {
    await admin.query(
      'DROP TRIGGER reject_archive_child ON task_activity; DROP FUNCTION reject_archive_child()',
    );
  }
});

test('an upload crossing board archive and restore rejects instead of attaching to a newly active task', async () => {
  const b = await board(),
    t = await task(b);
  const storageRoot = await mkdtemp(`${localRoot}tests/archive-board-files-`);
  let controller;
  const stream = new ReadableStream({
    start(value) {
      controller = value;
    },
  });
  const pending = uploadFile(
    pool,
    auth,
    new Request(`${options.baseURL}/api/files`, {
      method: 'POST',
      headers: { cookie: ownerCookie },
      body: stream,
      duplex: 'half',
    }),
    { storageRoot },
    t.id,
    'late.txt',
  );
  for (let tries = 0; tries < 100; tries++) {
    if ((await readdir(storageRoot)).some((x) => x.endsWith('.upload'))) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok((await readdir(storageRoot)).some((x) => x.endsWith('.upload')));
  const data = await transition('archiveBoard', b);
  await assert.rejects(
    uploadFile(
      pool,
      auth,
      new Request(`${options.baseURL}/api/files`, {
        method: 'POST',
        headers: { cookie: ownerCookie },
        body: 'blocked',
      }),
      { storageRoot },
      t.id,
      'blocked.txt',
    ),
    (error) => error.status === 409,
  );
  await transition('restoreBoard', data.archivedBoards[0]);
  controller.enqueue(new TextEncoder().encode('late bytes'));
  controller.close();
  await assert.rejects(pending, (error) => error.status === 409);
  assert.equal((await readdir(storageRoot)).length, 0);
  assert.equal((await admin.query('SELECT count(*)::int n FROM attachment')).rows[0].n, 0);
});
