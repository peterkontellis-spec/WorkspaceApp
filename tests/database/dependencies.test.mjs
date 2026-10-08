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
  local = await openLocalCluster(`${await mkdtemp(`${localRoot}tests/dependencies-`)}/postgres`, 55447);
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

const update = (t, patch, cookie) =>
  work({ action: 'updateTask', id: t.id, revision: t.revision, patch }, cookie);
async function updated(t, patch, cookie) {
  const response = await update(t, patch, cookie);
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json()).tasks.find((x) => x.id === t.id);
}
async function rejected(t, patch, status = 400, cookie) {
  const before = (await ok()).tasks.find((x) => x.id === t.id);
  const response = await update(t, patch, cookie);
  assert.equal(response.status, status, await response.clone().text());
  assert.deepEqual(
    (await ok()).tasks.find((x) => x.id === t.id),
    before,
  );
}

test('cross-board dependencies persist, reject self and transitive cycles, and remove independently', async () => {
  const b = await board('One'),
    other = await board('Two');
  let a = await task(b, 'A'),
    c = await task(other, 'C'),
    d = await task(b, 'D');
  a = await updated(a, { dependencyIds: [c.id] });
  c = await updated(c, { dependencyIds: [d.id] });
  assert.deepEqual(a.dependencyIds, [c.id]);
  await rejected(d, { dependencyIds: [a.id] });
  await rejected(a, { dependencyIds: [a.id] });
  a = await updated(a, { dependencyIds: [] });
  d = await updated(d, { dependencyIds: [a.id] });
  assert.deepEqual(d.dependencyIds, [a.id]);
  assert.deepEqual((await ok()).tasks.find((x) => x.id === c.id).dependencyIds, [d.id]);
});

test('malformed, duplicate, absent, cross-workspace and excessive edges fail atomically', async () => {
  const b = await board(),
    a = await task(b, 'A'),
    p = await task(b, 'P');
  for (const dependencyIds of [
    null,
    'bad',
    [123],
    ['bad'],
    [p.id, p.id],
    [p.id, p.id.toUpperCase()],
    [randomUUID()],
    Array.from({ length: 51 }, () => randomUUID()),
  ])
    await rejected(a, { dependencyIds, title: 'Must not change' });
  const elsewhere = (await admin.query("INSERT INTO workspace(name) VALUES('Elsewhere') RETURNING id"))
    .rows[0].id;
  const outsider = await member('outside@example.test', 'owner', elsewhere);
  const foreign = await ok({ action: 'createBoard', name: 'Private' }, outsider.cookie);
  const foreignTask = (
    await ok(
      {
        action: 'createTask',
        boardId: foreign.boards[0].id,
        groupId: foreign.groups[0].id,
        title: 'Foreign',
      },
      outsider.cookie,
    )
  ).tasks[0];
  await rejected(a, { dependencyIds: [foreignTask.id] });
  await assert.rejects(
    admin.query('INSERT INTO task_dependency(workspace_id,task_id,prerequisite_id) VALUES($1,$2,$3)', [
      workspace,
      a.id,
      foreignTask.id,
    ]),
    { code: '23503' },
  );
  await assert.rejects(
    admin.query('INSERT INTO task_dependency(workspace_id,task_id,prerequisite_id) VALUES($1,$2,$2)', [
      workspace,
      a.id,
    ]),
    { code: '23514' },
  );
});

test('roles, disabled sessions, optimistic conflicts and opposite-edge races are authoritative', async () => {
  const b = await board();
  let a = await task(b, 'A'),
    p = await task(b, 'P');
  const editor = await member('editor@example.test'),
    viewer = await member('viewer@example.test', 'viewer');
  await rejected(a, { dependencyIds: [p.id] }, 403, viewer.cookie);
  const responses = await Promise.all([
    update(a, { dependencyIds: [p.id] }, editor.cookie),
    update(p, { dependencyIds: [a.id] }),
  ]);
  assert.deepEqual(responses.map((x) => x.status).sort(), [200, 400]);
  const state = await ok();
  const changed = state.tasks.find((x) => x.dependencyIds.length);
  await rejected({ ...changed, revision: 1 }, { dependencyIds: [] }, 409);
  await admin.query('UPDATE app_user SET disabled_at=now() WHERE id=$1', [editor.id]);
  await rejected(changed, { dependencyIds: [] }, 401, editor.cookie);
  assert.deepEqual((await ok(undefined, viewer.cookie)).tasks, state.tasks);
});

test('archived links remain visible and removable; unrelated edits preserve them; new archived links fail', async () => {
  const b = await board('Active'),
    other = await board('Prerequisites');
  let a = await task(b, 'A'),
    p = await task(other, 'P'),
    fresh = await task(b, 'Fresh');
  a = await updated(a, { dependencyIds: [p.id] });
  await ok({ action: 'archiveBoard', id: other.id, revision: other.revision });
  let data = await ok();
  assert.ok(data.archivedTasks.find((x) => x.id === p.id));
  a = await updated(a, { notes: 'Retained links', dependencyIds: [p.id] });
  assert.deepEqual(a.dependencyIds, [p.id]);
  await rejected(fresh, { dependencyIds: [p.id] }, 409);
  a = await updated(a, { dependencyIds: [] });
  await rejected(a, { dependencyIds: [p.id] }, 409);
  await ok({
    action: 'restoreBoard',
    id: other.id,
    revision: data.archivedBoards.find((x) => x.id === other.id).revision,
  });
  a = await updated(a, { dependencyIds: [p.id] });
  await ok({ action: 'archiveTask', id: a.id, revision: a.revision });
  data = await ok();
  const archived = data.archivedTasks.find((x) => x.id === a.id);
  assert.deepEqual(archived.dependencyIds, [p.id]);
  assert.equal((await update(archived, { dependencyIds: [] })).status, 409);
  await ok({ action: 'restoreTask', id: a.id, revision: archived.revision });
  assert.deepEqual((await ok()).tasks.find((x) => x.id === a.id).dependencyIds, [p.id]);
});

test('dependency mutations join notes/checklist atomically and emit one notification only on semantic change', async () => {
  const b = await board(),
    assignee = await member('assignee@example.test');
  let a = await task(b, 'A', { assigneeIds: [assignee.id] }),
    p = await task(b, 'P'),
    q = await task(b, 'Q');
  a = await updated(a, {
    dependencyIds: [p.id, q.id],
    notes: 'Instructions',
    checklist: [{ id: randomUUID(), label: 'Check', done: false, position: 0 }],
  });
  const events = () =>
    admin.query('SELECT summary,changed_fields FROM task_activity WHERE task_id=$1 ORDER BY id', [a.id]);
  let history = (await events()).rows;
  assert.equal(history.length, 2);
  assert.match(history[1].summary, /prerequisites/);
  assert.ok(history[1].changed_fields.includes('dependencyIds'));
  const count = async () =>
    (
      await admin.query('SELECT count(*)::int AS n FROM task_notification WHERE recipient_id=$1', [
        assignee.id,
      ])
    ).rows[0].n;
  assert.equal(await count(), 2);
  a = await updated(a, { dependencyIds: [q.id, p.id] });
  assert.equal((await events()).rows.length, 2);
  assert.equal(await count(), 2);
  await rejected(a, { dependencyIds: [], notes: 'Must roll back', checklist: [{ label: '' }] });
  assert.equal((await events()).rows.length, 2);
  assert.equal(await count(), 2);
  a = await updated(a, { dependencyIds: [] });
  assert.equal(await count(), 3);
});

test('board and subtree templates remap internal links, omit external links and retry without duplicates', async () => {
  const b = await board('Source'),
    other = await board('External'),
    target = await board('Destination');
  let a = await task(b, 'Root'),
    child = await task(b, 'Child', { parentId: a.id }),
    external = await task(other, 'External task');
  a = await updated(a, { dependencyIds: [child.id, external.id] });
  for (const kind of ['board', 'task']) {
    const saved = (await templateOK(save(kind, kind === 'board' ? b : a))).template;
    const request = use(
      saved,
      kind === 'board' ? { name: 'Copy' } : { boardId: target.id, groupId: target.group },
    );
    const result = await templateOK(request);
    assert.deepEqual(await templateOK(request), result);
    const data = await ok(),
      tasks = data.tasks.filter((x) => x.boardId === result.boardId);
    const root = tasks.find((x) => x.title === 'Root'),
      copiedChild = tasks.find((x) => x.title === 'Child');
    assert.deepEqual(root.dependencyIds, [copiedChild.id]);
    assert.equal(copiedChild.parentId, root.id);
    assert.notEqual(copiedChild.id, child.id);
    assert.ok(!root.dependencyIds.includes(external.id));
    assert.deepEqual(data.tasks.find((x) => x.id === a.id).dependencyIds, [child.id, external.id].sort());
  }
  const legacy = (await templateOK(save('board', b))).template;
  await admin.query(
    "UPDATE work_template SET snapshot=jsonb_set(snapshot,'{tasks}',(SELECT jsonb_agg(t - 'dependencyIds') FROM jsonb_array_elements(snapshot->'tasks') t)) WHERE id=$1",
    [legacy.id],
  );
  const copy = await templateOK(use(legacy, { name: 'Legacy' }));
  assert.ok(
    (await ok()).tasks.filter((x) => x.boardId === copy.boardId).every((x) => x.dependencyIds.length === 0),
  );
});

test('edges and remapped template copies survive a real database restart', async () => {
  const b = await board();
  let a = await task(b, 'A'),
    p = await task(b, 'P');
  a = await updated(a, { dependencyIds: [p.id] });
  const saved = (await templateOK(save('board', b))).template,
    request = use(saved, { name: 'Before restart' }),
    copy = await templateOK(request);
  const before = (await ok()).tasks;
  await pool.end();
  await admin.end();
  await local.cluster.stop();
  await local.cluster.start();
  admin = createDatabase(local.adminUrl);
  pool = createDatabase(local.appUrl);
  auth = createAuthentication(pool, options);
  handle = workHttpHandler(pool, auth, options);
  templateHandle = templatesHttpHandler(pool, auth, options);
  assert.deepEqual((await ok()).tasks, before);
  assert.deepEqual(await templateOK(request), copy);
  const next = await templateOK(use(saved, { name: 'After restart' })),
    tasks = (await ok()).tasks.filter((x) => x.boardId === next.boardId);
  assert.deepEqual(tasks.find((x) => x.title === 'A').dependencyIds, [tasks.find((x) => x.title === 'P').id]);
});

test('advisory prerequisites allow completion and reopening or archive never changes dependent completion', async () => {
  const b = await board();
  let a = await task(b, 'Dependent'),
    p = await task(b, 'Prerequisite');
  a = await updated(a, { dependencyIds: [p.id], status: 'Done' });
  assert.equal(a.status, 'Done');
  p = await updated(p, { status: 'Done' });
  p = await updated(p, { status: 'In progress' });
  assert.deepEqual(
    (await ok()).tasks.find((x) => x.id === a.id),
    a,
  );
  p = await updated(p, { status: 'Done' });
  await ok({ action: 'archiveTask', id: p.id, revision: p.revision });
  assert.deepEqual(
    (await ok()).tasks.find((x) => x.id === a.id),
    a,
  );
  a = await updated(a, { notes: 'Still complete', dependencyIds: [p.id] });
  assert.equal(a.status, 'Done');
});

test('createTask rejects dependencies rather than accepting and dropping them', async () => {
  const b = await board(),
    p = await task(b, 'Prerequisite');
  const response = await work({
    action: 'createTask',
    boardId: b.id,
    groupId: b.group,
    title: 'Invalid',
    dependencyIds: [p.id],
  });
  assert.equal(response.status, 400);
  assert.equal((await ok()).tasks.length, 1);
});

test('a dependency edit racing an operator disable waits and rejects without changing work', async () => {
  const b = await board(),
    a = await task(b, 'Dependent'),
    p = await task(b, 'Prerequisite');
  const editor = await member('disable-race@example.test'),
    operator = await admin.connect();
  let pending;
  try {
    await operator.query('BEGIN');
    await operator.query('UPDATE app_user SET disabled_at=now() WHERE id=$1', [editor.id]);
    pending = update(a, { dependencyIds: [p.id], notes: 'Must not save' }, editor.cookie);
    let blocked = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      blocked =
        (
          await admin.query(
            `SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND query LIKE 'SELECT id FROM app_user WHERE id=%FOR SHARE' AND wait_event_type='Lock'`,
          )
        ).rowCount > 0;
      if (blocked) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(blocked, true, 'edit must wait for the account disable row lock');
    await operator.query('COMMIT');
    assert.equal((await pending).status, 401);
    assert.deepEqual(
      (await ok()).tasks.find((x) => x.id === a.id),
      a,
    );
  } finally {
    await operator.query('ROLLBACK');
    operator.release();
    await pending;
  }
});
