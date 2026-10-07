import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
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
import { templatesHttpHandler } from '../../src/server/templates-http.mjs';

let local, admin, pool, auth, handle, templateHandle, owner, ownerCookie, workspace;
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
  const { notes, checklist, fields, ...basic } = extra;
  let data = await ok({ action: 'createTask', boardId: b.id, groupId: b.group, title, ...basic });
  const created = data.tasks.find((x) => x.title === title);
  const patch = {
    ...(notes === undefined ? {} : { notes }),
    ...(checklist === undefined ? {} : { checklist }),
    ...(fields === undefined ? {} : { fields }),
  };
  if (Object.keys(patch).length)
    data = await ok({ action: 'updateTask', id: created.id, revision: created.revision, patch });
  return data.tasks.find((x) => x.id === created.id);
}

before(async () => {
  await mkdir(`${localRoot}tests`, { recursive: true });
  local = await openLocalCluster(`${await mkdtemp(`${localRoot}tests/templates-`)}/postgres`, 55444);
  await local.cluster.start();
  await provisionLocalDatabase(local);
  admin = createDatabase(local.adminUrl);
  await migrate(admin);
  await grantApplicationAccess(admin);
  pool = createDatabase(local.appUrl);
  auth = createAuthentication(pool, options);
  handle = workHttpHandler(pool, auth, options);
  templateHandle = templatesHttpHandler(pool, auth, options);
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
function template(body, cookie = ownerCookie, origin = options.baseURL) {
  return templateHandle(
    new Request(`${options.baseURL}/api/templates`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { cookie: cookie ?? '', origin, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function templateOK(body, cookie) {
  const res = await template(body, cookie);
  assert.equal(res.status, 200, await res.clone().text());
  return res.json();
}
const save = (kind, source, name = 'Reusable') => ({
  action: 'save',
  creationId: randomUUID(),
  kind,
  sourceId: source.id,
  revision: source.revision,
  name,
});
const use = (t, extra = {}) => ({
  action: 'use',
  creationId: randomUUID(),
  templateId: t.id,
  revision: t.revision,
  ...extra,
});
async function column(b, name, kind = 'text', configuration = {}) {
  const data = await ok({ action: 'createColumn', boardId: b.id, name, kind, configuration });
  return data.columns.filter((x) => x.boardId === b.id).at(-1);
}
async function counts() {
  return (
    await admin.query(
      'SELECT (SELECT count(*) FROM board)::int AS boards,(SELECT count(*) FROM task)::int AS tasks,(SELECT count(*) FROM column_definition)::int AS columns,(SELECT count(*) FROM template_operation)::int AS operations',
    )
  ).rows[0];
}

test('board snapshot creates independent records and clears execution state, links, files, time and history', async () => {
  const b = await board('Source'),
    editor = await member('editor@example.test');
  const textColumn = await column(b, 'Instructions'),
    number = await column(b, 'Hours', 'number', { format: 'number' }),
    date = await column(b, 'Review date', 'date'),
    status = await column(b, 'Stage', 'status', { options: ['Open', 'Closed'] }),
    link = await column(b, 'Reference', 'link');
  const checklistId = randomUUID();
  const root = await task(b, 'Parent', {
    status: 'Done',
    priority: 'High',
    dueDate: '2026-10-10',
    assigneeIds: [editor.id],
    notes: 'Read https://example.test/plain-text',
    checklist: [{ id: checklistId, label: 'Review', done: true, position: 0 }],
    fields: [
      { columnId: textColumn.id, revision: 1, value: 'Keep me' },
      { columnId: number.id, revision: 1, value: 2.5 },
      { columnId: date.id, revision: 1, value: '2026-10-10' },
      { columnId: status.id, revision: 1, value: 'Closed' },
      { columnId: link.id, revision: 1, value: 'https://example.test/doc' },
    ],
  });
  const child = await task(b, 'Child', { parentId: root.id, status: 'In progress' });
  const archived = await task(b, 'Old');
  await ok({ action: 'archiveTask', id: archived.id, revision: 1 });
  await admin.query(
    "INSERT INTO attachment(workspace_id,task_id,uploaded_by,original_name,media_type,byte_size,state) VALUES($1,$2,$3,'sample.txt','text/plain',2,'ready')",
    [workspace, root.id, owner],
  );
  await admin.query(
    "INSERT INTO time_entry(workspace_id,task_id,user_id,creation_id,kind,work_date,duration_seconds) VALUES($1,$2,$3,$4,'manual','2026-10-07',120)",
    [workspace, root.id, owner, randomUUID()],
  );
  const { template: saved } = await templateOK(save('board', b));
  assert.equal(saved.taskCount, 2);
  assert.equal(saved.columnCount, 5);
  assert.equal(saved.groupCount, 1);
  await ok({
    action: 'updateTask',
    id: root.id,
    revision: root.revision,
    patch: { title: 'Source changed' },
  });
  const first = await templateOK(use(saved, { name: 'Copy one' })),
    second = await templateOK(use(saved, { name: 'Copy two' }));
  let state = await ok();
  const copied = state.tasks.filter((x) => x.boardId === first.boardId),
    copyRoot = copied.find((x) => x.title === 'Parent'),
    copyChild = copied.find((x) => x.title === 'Child');
  assert.equal(copied.length, 2);
  assert.equal(copyChild.parentId, copyRoot.id);
  assert.notEqual(copyRoot.id, root.id);
  assert.notEqual(copyChild.id, child.id);
  assert.equal(copyRoot.priority, 'High');
  assert.equal(copyRoot.notes, 'Read https://example.test/plain-text');
  for (const item of copied) {
    assert.equal(item.status, 'To do');
    assert.equal(item.dueDate, null);
    assert.deepEqual(item.assigneeIds, []);
    assert.equal(item.revision, 1);
  }
  assert.equal(copyRoot.checklist[0].done, false);
  assert.notEqual(copyRoot.checklist[0].id, checklistId);
  assert.equal(copyRoot.fields.length, 2);
  assert.deepEqual(copyRoot.fields.map((x) => x.value).sort(), [2.5, 'Keep me'].sort());
  assert.equal(state.columns.filter((x) => x.boardId === first.boardId).length, 5);
  for (const table of ['attachment', 'time_entry'])
    assert.equal(
      (
        await admin.query(`SELECT count(*)::int AS n FROM ${table} WHERE task_id=ANY($1::uuid[])`, [
          copied.map((x) => x.id),
        ])
      ).rows[0].n,
      0,
    );
  assert.equal(
    (
      await admin.query('SELECT count(*)::int AS n FROM task_activity WHERE task_id=ANY($1::uuid[])', [
        copied.map((x) => x.id),
      ])
    ).rows[0].n,
    2,
  );
  await ok({ action: 'updateTask', id: copyRoot.id, revision: 1, patch: { title: 'Only copy changed' } });
  state = await ok();
  assert.equal(state.tasks.find((x) => x.id === root.id).title, 'Source changed');
  assert.ok(state.tasks.find((x) => x.boardId === second.boardId && x.title === 'Parent'));
});

test('task subtree reuses matching columns, adds missing definitions and places fresh subtree in selected group', async () => {
  const b = await board('Source'),
    target = await board('Target');
  const c = await column(b, 'Text'),
    cost = await column(b, 'Cost', 'number', { format: 'cost', currency: 'EUR' });
  const matching = await column(target, 'Text');
  const parent = await task(b, 'Ancestor'),
    root = await task(b, 'Reusable child', {
      parentId: parent.id,
      fields: [
        { columnId: c.id, revision: 1, value: 'text' },
        { columnId: cost.id, revision: 1, value: 10 },
      ],
    }),
    child = await task(b, 'Nested child', { parentId: root.id });
  const { template: saved } = await templateOK(save('task', root));
  assert.equal(saved.taskCount, 2);
  assert.equal(saved.columnCount, 2);
  const result = await templateOK(use(saved, { boardId: target.id, groupId: target.group }));
  const state = await ok();
  const copy = state.tasks.find((x) => x.id === result.taskId);
  assert.equal(copy.parentId, null);
  assert.equal(copy.groupId, target.group);
  assert.ok(copy.fields.find((x) => x.columnId === matching.id));
  assert.equal(state.columns.filter((x) => x.boardId === target.id).length, 2);
  assert.ok(state.tasks.find((x) => x.parentId === copy.id && x.title === child.title));
});

test('column conflicts and limit failures roll back all partially created records', async () => {
  const b = await board('Source'),
    target = await board('Target');
  const a = await column(b, 'First'),
    z = await column(b, 'Conflict');
  await column(target, 'Conflict', 'number', { format: 'number' });
  const t = await task(b, 'Task', {
    fields: [
      { columnId: a.id, revision: 1, value: 'A' },
      { columnId: z.id, revision: 1, value: 'Z' },
    ],
  });
  const { template: saved } = await templateOK(save('task', t));
  let before = await counts();
  let response = await template(use(saved, { boardId: target.id, groupId: target.group }));
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /different type/);
  assert.deepEqual(await counts(), before);
  const full = await board('Full');
  for (let i = 0; i < 20; i++) await column(full, `Full ${i}`);
  before = await counts();
  response = await template(use(saved, { boardId: full.id, groupId: full.group }));
  assert.equal(response.status, 409);
  assert.deepEqual(await counts(), before);
});

test('owner/editor/viewer policies and archived template restore preserve snapshots', async () => {
  const b = await board(),
    t = await task(b),
    editor = await member('editor@example.test'),
    viewer = await member('viewer@example.test', 'viewer');
  const { template: bt } = await templateOK(save('board', b), editor.cookie),
    { template: tt } = await templateOK(save('task', t), editor.cookie);
  assert.equal((await templateOK(undefined, viewer.cookie)).templates.length, 2);
  for (const body of [
    save('task', t),
    use(bt, { name: 'Denied' }),
    { action: 'archive', id: tt.id, revision: 1 },
  ])
    assert.equal((await template(body, viewer.cookie)).status, 403);
  assert.equal((await template({ action: 'archive', id: bt.id, revision: 1 }, editor.cookie)).status, 403);
  await templateOK({ action: 'archive', id: tt.id, revision: 1 }, editor.cookie);
  let data = await templateOK();
  assert.equal(data.archivedTemplates[0].revision, 2);
  assert.equal(data.templates.length, 1);
  assert.equal(
    (await template(use({ ...tt, revision: 2 }, { boardId: b.id, groupId: b.group }))).status,
    409,
  );
  assert.equal((await template({ action: 'restore', id: tt.id, revision: 1 })).status, 409);
  await templateOK({ action: 'restore', id: tt.id, revision: 2 }, editor.cookie);
  data = await templateOK();
  assert.equal(data.archivedTemplates.length, 0);
  assert.equal(data.templates.find((x) => x.id === tt.id).revision, 3);
  await templateOK({ action: 'archive', id: bt.id, revision: 1 });
  await templateOK({ action: 'restore', id: bt.id, revision: 2 });
});

test('creation retries are atomic and fingerprinted, concurrent identical copies create only one result', async () => {
  const b = await board(),
    t = await task(b),
    payload = save('board', b);
  const results = await Promise.all([templateOK(payload), templateOK(payload)]);
  assert.equal(results[0].template.id, results[1].template.id);
  assert.equal((await template({ ...payload, name: 'Changed' })).status, 409);
  const request = use(results[0].template, { name: 'Independent' });
  const copies = await Promise.all([templateOK(request), templateOK(request)]);
  assert.deepEqual(copies[0], copies[1]);
  assert.equal((await ok()).boards.length, 2);
  assert.equal((await ok()).tasks.length, 2);
  assert.equal((await template({ ...request, name: 'Changed' })).status, 409);
  const editor = await member('editor@example.test');
  assert.equal((await template(request, editor.cookie)).status, 409);
  await ok({ action: 'archiveBoard', id: b.id, revision: 1 });
  assert.equal((await templateOK(payload)).template.id, results[0].template.id);
});

test('source/template revisions, source archive and destination validation are authoritative', async () => {
  const b = await board('Source'),
    t = await task(b),
    other = await board('Other');
  assert.equal((await template(save('task', { ...t, revision: 2 }))).status, 409);
  const { template: saved } = await templateOK(save('task', t));
  assert.equal(
    (await template(use({ ...saved, revision: 2 }, { boardId: b.id, groupId: b.group }))).status,
    409,
  );
  assert.equal((await template(use(saved, { boardId: b.id, groupId: other.group }))).status, 400);
  await ok({ action: 'archiveTask', id: t.id, revision: 1 });
  assert.equal((await template(save('task', { ...t, revision: 2 }))).status, 409);
  await ok({ action: 'archiveBoard', id: b.id, revision: 1 });
  assert.equal((await template(use(saved, { boardId: b.id, groupId: b.group }))).status, 409);
  await templateOK(use(saved, { boardId: other.id, groupId: other.group }));
});

test('cross-workspace reads/writes and disabled or revoked members do not expose templates', async () => {
  const b = await board(),
    t = await task(b),
    { template: saved } = await templateOK(save('task', t));
  const otherWorkspace = (await admin.query("INSERT INTO workspace(name) VALUES('Other') RETURNING id"))
    .rows[0].id;
  const stranger = await member('stranger@example.test', 'owner', otherWorkspace);
  assert.deepEqual((await templateOK(undefined, stranger.cookie)).templates, []);
  for (const payload of [
    save('task', t),
    use(saved, { boardId: b.id, groupId: b.group }),
    { action: 'archive', id: saved.id, revision: 1 },
  ])
    assert.equal((await template(payload, stranger.cookie)).status, 404);
  const editor = await member('editor@example.test');
  await admin.query('UPDATE app_user SET disabled_at=now() WHERE id=$1', [editor.id]);
  assert.equal((await template(undefined, editor.cookie)).status, 401);
  assert.equal((await template(save('task', t), editor.cookie)).status, 401);
  const revoked = await member('revoked@example.test');
  await admin.query('DELETE FROM membership WHERE user_id=$1', [revoked.id]);
  assert.equal((await template(undefined, revoked.cookie)).status, 401);
});

test('HTTP origin, authentication, input size and malformed inputs fail closed', async () => {
  assert.equal((await template(undefined, '')).status, 401);
  assert.equal((await template({ action: 'save' }, ownerCookie, 'https://other.test')).status, 403);
  for (const body of [
    { action: 'save', creationId: 'wrong' },
    { action: 'wat' },
    { action: 'save', creationId: randomUUID(), kind: 'x' },
    { action: 'save', creationId: randomUUID(), extra: 'x' },
  ])
    assert.equal((await template(body)).status, 400);
  assert.equal((await template({ action: 'save', name: 'x'.repeat(20000) })).status, 413);
  const response = await templateHandle(
    new Request(`${options.baseURL}/api/templates`, {
      method: 'POST',
      headers: { cookie: ownerCookie, origin: options.baseURL, 'content-type': 'application/json' },
      body: '{',
    }),
  );
  assert.equal(response.status, 400);
  assert.equal((await template()).headers.get('cache-control'), 'no-store');
});

test('empty board templates and duplicate column definitions retain their independent board structure', async () => {
  const b = await board();
  await column(b, 'Repeated');
  await column(b, 'Repeated');
  const { template: saved } = await templateOK(save('board', b));
  assert.equal(saved.taskCount, 0);
  const { boardId } = await templateOK(use(saved, { name: 'Empty copy' }));
  const state = await ok();
  assert.equal(state.columns.filter((x) => x.boardId === boardId).length, 2);
  assert.equal(state.groups.filter((x) => x.boardId === boardId).length, 1);
});

test('snapshot size and task count bounds reject safely without saved template or retry entry', async () => {
  const b = await board();
  await admin.query(
    "INSERT INTO task(workspace_id,board_id,group_id,title) SELECT $1,$2,$3,'Task '||i FROM generate_series(1,201) i",
    [workspace, b.id, b.group],
  );
  assert.equal((await template(save('board', b))).status, 400);
  assert.equal((await templateOK()).templates.length, 0);
  assert.equal((await counts()).operations, 0);
  await admin.query('DELETE FROM task WHERE workspace_id=$1', [workspace]);
  await admin.query(
    "INSERT INTO task(workspace_id,board_id,group_id,title,notes) SELECT $1,$2,$3,'Task '||i,repeat('x',50000) FROM generate_series(1,43) i",
    [workspace, b.id, b.group],
  );
  assert.equal((await template(save('board', b))).status, 400);
  assert.equal((await counts()).operations, 0);
});

test('duplicate matching task columns map one-to-one without merging distinct field values', async () => {
  const b = await board('Source'),
    target = await board('Target');
  const first = await column(b, 'Repeated'),
    second = await column(b, 'Repeated');
  await column(target, 'Repeated');
  const t = await task(b, 'Two values', {
    fields: [
      { columnId: first.id, revision: 1, value: 'First' },
      { columnId: second.id, revision: 1, value: 'Second' },
    ],
  });
  const { template: saved } = await templateOK(save('task', t));
  const copied = await templateOK(use(saved, { boardId: target.id, groupId: target.group }));
  const state = await ok();
  const values = state.tasks.find((x) => x.id === copied.taskId).fields;
  assert.equal(values.length, 2);
  assert.equal(new Set(values.map((x) => x.columnId)).size, 2);
  assert.deepEqual(values.map((x) => x.value).sort(), ['First', 'Second']);
  assert.equal(state.columns.filter((x) => x.boardId === target.id).length, 2);
});

test('saved snapshots and copy retry identities survive an actual database restart', async () => {
  const b = await board('Restart source');
  const textColumn = await column(b, 'Reusable instructions');
  const root = await task(b, 'Restart parent', {
    notes: 'Keep these saved instructions.',
    status: 'Done',
    dueDate: '2026-10-08',
    checklist: [{ id: randomUUID(), label: 'Verify the copy', done: true, position: 0 }],
    fields: [{ columnId: textColumn.id, revision: 1, value: 'Saved field value' }],
  });
  await task(b, 'Restart child', { parentId: root.id, priority: 'High' });
  const boardRequest = save('board', b, 'Durable board');
  const taskRequest = save('task', root, 'Durable task');
  const boardSaved = await templateOK(boardRequest);
  const taskSaved = await templateOK(taskRequest);
  const copyRequest = use(boardSaved.template, { name: 'Before restart' });
  const originalCopy = await templateOK(copyRequest);
  const libraryBefore = await templateOK();
  const snapshotsBefore = (await admin.query('SELECT id,snapshot FROM work_template ORDER BY id')).rows;
  const countsBefore = await counts();
  const workBefore = await ok();
  const copiedTasksBefore = workBefore.tasks.filter((item) => item.boardId === originalCopy.boardId);
  assert.equal(copiedTasksBefore.length, 2);

  await pool.end();
  await admin.end();
  await local.cluster.stop();
  await local.cluster.start();
  admin = createDatabase(local.adminUrl);
  pool = createDatabase(local.appUrl);
  auth = createAuthentication(pool, options);
  handle = workHttpHandler(pool, auth, options);
  templateHandle = templatesHttpHandler(pool, auth, options);

  // Existing cookies exercise persisted sessions through freshly constructed auth.
  assert.deepEqual(await templateOK(), libraryBefore);
  assert.deepEqual(
    (await admin.query('SELECT id,snapshot FROM work_template ORDER BY id')).rows,
    snapshotsBefore,
  );
  assert.deepEqual(await templateOK(boardRequest), boardSaved);
  assert.deepEqual(await templateOK(taskRequest), taskSaved);
  assert.deepEqual(await templateOK(copyRequest), originalCopy);
  assert.deepEqual(await counts(), countsBefore);
  const workAfter = await ok();
  assert.deepEqual(
    workAfter.tasks.filter((item) => item.boardId === originalCopy.boardId),
    copiedTasksBefore,
  );
  assert.equal((await template({ ...copyRequest, name: 'Changed retry' })).status, 409);

  const fresh = await templateOK(use(boardSaved.template, { name: 'After restart' }));
  assert.notEqual(fresh.boardId, originalCopy.boardId);
  const taskCopy = await templateOK(use(taskSaved.template, { boardId: b.id, groupId: b.group }));
  assert.notEqual(taskCopy.taskId, root.id);
  let state = await ok();
  const freshTasks = state.tasks.filter((item) => item.boardId === fresh.boardId);
  assert.equal(freshTasks.length, 2);
  const newRoot = freshTasks.find((item) => item.title === root.title);
  assert.equal(newRoot.notes, root.notes);
  assert.equal(newRoot.status, 'To do');
  assert.equal(newRoot.dueDate, null);
  assert.equal(newRoot.checklist[0].done, false);
  assert.equal(newRoot.fields[0].value, 'Saved field value');
  assert.ok(freshTasks.find((item) => item.parentId === newRoot.id));
  assert.ok(freshTasks.every((item) => !copiedTasksBefore.some((previous) => previous.id === item.id)));
  await ok({
    action: 'updateTask',
    id: newRoot.id,
    revision: newRoot.revision,
    patch: { title: 'Independent after restart' },
  });
  state = await ok();
  assert.deepEqual(
    state.tasks.filter((item) => item.boardId === originalCopy.boardId),
    copiedTasksBefore,
  );
  assert.equal(state.tasks.find((item) => item.id === root.id).title, root.title);
  assert.equal(state.tasks.find((item) => item.id === taskCopy.taskId).title, root.title);
  assert.deepEqual(
    (await admin.query('SELECT id,snapshot FROM work_template ORDER BY id')).rows,
    snapshotsBefore,
  );
});
