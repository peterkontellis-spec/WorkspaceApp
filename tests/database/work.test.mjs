import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { localRoot, openLocalCluster, provisionLocalDatabase, grantApplicationAccess } from '../../scripts/db/local.mjs';
import { createDatabase } from '../../src/server/database.mjs';
import { migrate } from '../../scripts/db/migrate.mjs';
import { createAuthentication, verifiedActor } from '../../src/server/auth-core.mjs';
import { createFirstOwner } from '../../src/server/account-operator.mjs';
import { authHttpHandler } from '../../src/server/auth-http.mjs';
import { workHttpHandler } from '../../src/server/work-http.mjs';
import { buildWorkDashboard } from '../../src/lib/work-dashboard.mjs';
import { readWorkFilters, filterWorkTasks } from '../../src/lib/work-filters.mjs';

// Server time advances on each read; all durable fields, including the active
// timer, must still match across retries, rollback and database restart.
function stableSnapshot({ serverNow, ...saved }) {
  assert.ok(Number.isFinite(Date.parse(serverNow)));
  return saved;
}
let local, admin, pool, auth, handle, owner, ownerCookie, workspace;
const options = { secret: randomBytes(48).toString('hex'), baseURL: 'http://127.0.0.1:3100' };
const password = 'Disposable work test password 123!';
const cookies = res => res.headers.getSetCookie().map(x => x.split(';')[0]).join('; ');
const request = (body, cookie = ownerCookie, origin = options.baseURL) => new Request(`${options.baseURL}/api/work`, {
  method: body === undefined ? 'GET' : 'POST', headers: { origin, 'content-type': 'application/json', cookie: cookie ?? '' }, ...(body === undefined ? {} : { body: JSON.stringify(body) })
});
const work = (body, cookie, origin) => handle(request(body, cookie, origin));
async function ok(body, cookie) { const res = await work(body, cookie); assert.equal(res.status, 200, await res.clone().text()); return res.json(); }
async function login(email) {
  const res = await authHttpHandler(auth, pool, options.baseURL)(new Request(`${options.baseURL}/api/auth/sign-in/email`, { method: 'POST', headers: { origin: options.baseURL, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) }));
  assert.equal(res.status, 200, await res.clone().text()); return cookies(res);
}
async function member(email, role = 'editor', inWorkspace = workspace) {
  const user = (await createAuthentication(pool, { ...options, allowSignup: true }).api.signUpEmail({ body: { name: email, email, password } })).user.id;
  await admin.query('INSERT INTO membership(workspace_id,user_id,role) VALUES($1,$2,$3)', [inWorkspace, user, role]);
  return { id: user, cookie: await login(email) };
}
async function board(name = 'Project') { const data = await ok({ action: 'createBoard', name }); const b = data.boards.find(x => x.name === name); return { ...b, group: data.groups.find(x => x.boardId === b.id).id }; }
async function task(b, title = 'Task', extra = {}) { const data = await ok({ action: 'createTask', boardId: b.id, groupId: b.group, title, ...extra }); return data.tasks.find(x => x.title === title); }
before(async () => {
  await mkdir(`${localRoot}tests`, { recursive: true });
  local = await openLocalCluster(`${await mkdtemp(`${localRoot}tests/work-`)}/postgres`, 55436);
  await local.cluster.start(); await provisionLocalDatabase(local);
  admin = createDatabase(local.adminUrl); await migrate(admin); await grantApplicationAccess(admin);
  pool = createDatabase(local.appUrl); auth = createAuthentication(pool, options); handle = workHttpHandler(pool, auth, options);
});
beforeEach(async () => {
  await admin.query('TRUNCATE workspace,app_user,auth_user,auth_rate_limit,auth_verification,invitation_rate_limit CASCADE');
  owner = await createFirstOwner(pool, options, { name: 'Owner', email: 'owner@example.test', password });
  ownerCookie = await login('owner@example.test'); workspace = (await verifiedActor(auth, pool, new Headers({ cookie: ownerCookie }))).workspaceId;
});
after(async () => { await pool?.end(); await admin?.end(); await local?.cluster.stop(); });

test('real sessions scope snapshots, owner/editor writes and viewer direct writes reject', async () => {
  const editor = await member('editor@example.test'), viewer = await member('viewer@example.test', 'viewer');
  assert.equal((await work(undefined, '')).status, 401);
  assert.equal((await work({ action: 'createBoard', name: 'Forged', actorId: owner, workspaceId: workspace }, 'workspace.session_token=forged')).status, 401);
  const empty = await ok(undefined, viewer.cookie); assert.deepEqual(empty.boards, []); assert.equal(empty.members.length, 3); assert.equal(empty.actor.role, 'viewer');
  const b = await board(); const t = await task(b);
  for (const body of [
    { action: 'createBoard', name: 'New' }, { action: 'updateBoard', id: b.id, revision: 1, name: 'Changed' },
    { action: 'createGroup', boardId: b.id, name: 'New' }, { action: 'updateGroup', id: b.group, revision: 1, name: 'Changed' },
    { action: 'createTask', boardId: b.id, groupId: b.group, title: 'New' }, { action: 'updateTask', id: t.id, revision: 1, patch: { title: 'Changed' } }
  ]) { assert.equal((await work(body, viewer.cookie)).status, 403); assert.equal((await work(body, editor.cookie)).status, 200); }
  const data = await ok(undefined, viewer.cookie); assert.equal(data.tasks.find(x => x.id === t.id).title, 'Changed');
  assert.equal(data.actor.id, viewer.id); assert.equal(data.actor.role, 'viewer');
});

test('cross-workspace reads, mutations, references and submitted identity cannot cross boundaries', async () => {
  const other = (await admin.query("INSERT INTO workspace(name) VALUES('Other') RETURNING id")).rows[0].id;
  const outsider = await member('outside@example.test', 'owner', other);
  const outsideData = await ok({ action: 'createBoard', name: 'Outside' }, outsider.cookie);
  const ob = outsideData.boards[0], og = outsideData.groups[0];
  const ot = (await ok({ action: 'createTask', boardId: ob.id, groupId: og.id, title: 'Outside task' }, outsider.cookie)).tasks[0];
  const b = await board(), t = await task(b);
  const ours = await ok(); assert.equal(ours.boards.length, 1); assert.equal(ours.tasks.length, 1); assert.ok(!ours.members.some(x => x.id === outsider.id));
  for (const body of [
    { action: 'updateBoard', id: ob.id, revision: 1, name: 'Stolen' }, { action: 'createGroup', boardId: ob.id, name: 'Stolen' },
    { action: 'updateGroup', id: og.id, revision: 1, name: 'Stolen' }, { action: 'updateTask', id: ot.id, revision: 1, patch: { title: 'Stolen' } },
    { action: 'createTask', boardId: b.id, groupId: og.id, title: 'Stolen' }, { action: 'updateTask', id: t.id, revision: 1, patch: { parentId: ot.id } }
  ]) assert.equal((await work(body)).status, 404);
  assert.equal((await work({ action: 'createBoard', name: 'No impersonation', workspaceId: other })).status, 400);
  assert.equal((await work({ action: 'updateTask', id: t.id, revision: 1, patch: { assigneeIds: [outsider.id] } })).status, 400);
  assert.equal((await ok(undefined, outsider.cookie)).tasks[0].title, 'Outside task');
});

test('task search only filters verified owner/viewer workspace snapshots and revoked membership cannot refresh results', async () => {
  const viewer = await member('search-viewer@example.test', 'viewer');
  const otherWorkspace = (await admin.query("INSERT INTO workspace(name) VALUES('Search outside') RETURNING id")).rows[0].id;
  const outsider = await member('search-outsider@example.test', 'owner', otherWorkspace);
  const b = await board('Shared search');
  const ours = await task(b, 'Shared launch', { assigneeIds: [owner, viewer.id], dueDate: '2028-03-01', priority: 'High' });
  await ok({ action: 'updateTask', id: ours.id, revision: ours.revision, patch: { notes: 'Workspace-only search phrase' } });
  await task(b, 'Unrelated');
  const outside = await ok({ action: 'createBoard', name: 'Private outside board' }, outsider.cookie);
  const theirs = (await ok({ action: 'createTask', boardId: outside.boards[0].id, groupId: outside.groups[0].id, title: 'Outside launch', dueDate: '2028-03-01', priority: 'High' }, outsider.cookie)).tasks[0];
  const titleFilter = readWorkFilters(new URLSearchParams('q=launch&priority=High&due=today'));
  const notesFilter = readWorkFilters(new URLSearchParams('q=workspace-only'));
  for (const cookie of [ownerCookie, viewer.cookie]) {
    const snapshot = await ok(undefined, cookie);
    assert.deepEqual(filterWorkTasks(snapshot.tasks, titleFilter, '2028-03-01').map(task => task.id), [ours.id]);
    assert.deepEqual(filterWorkTasks(snapshot.tasks, notesFilter, '2028-03-01').map(task => task.id), [ours.id]);
    assert.deepEqual(filterWorkTasks(snapshot.tasks, { ...titleFilter, assignee: viewer.id }, '2028-03-01').map(task => task.id), [ours.id]);
    assert.deepEqual(filterWorkTasks(snapshot.tasks, { ...titleFilter, assignee: outsider.id }, '2028-03-01'), []);
  }
  const outsideSnapshot = await ok(undefined, outsider.cookie);
  assert.deepEqual(filterWorkTasks(outsideSnapshot.tasks, titleFilter, '2028-03-01').map(task => task.id), [theirs.id]);
  assert.deepEqual(filterWorkTasks(outsideSnapshot.tasks, notesFilter, '2028-03-01'), []);
  await admin.query('DELETE FROM membership WHERE workspace_id=$1 AND user_id=$2', [workspace, viewer.id]);
  const revoked = await work(undefined, viewer.cookie);
  assert.equal(revoked.status, 401);
  assert.equal(revoked.headers.get('cache-control'), 'no-store');
  assert.equal((await revoked.json()).tasks, undefined);
});

test('task data, multiple assignees, dates, groups, subtasks and order survive a real database restart', async () => {
  const editor = await member('editor@example.test'); const b = await board();
  const data = await ok({ action: 'createGroup', boardId: b.id, name: 'Next' }); const group = data.groups.find(x => x.name === 'Next');
  const parent = await task(b, 'Parent', { status: 'In progress', priority: 'High', dueDate: '2028-02-29', assigneeIds: [owner, editor.id] });
  const child = await task(b, 'Child', { parentId: parent.id, position: 4 });
  await ok({ action: 'updateTask', id: child.id, revision: 1, patch: { groupId: group.id, status: 'Done', priority: 'Low', dueDate: '2026-12-31', assigneeIds: [editor.id], position: 0 } });
  await ok({ action: 'updateGroup', id: group.id, revision: 1, position: 0, name: 'Ready' });
  await ok({ action: 'updateBoard', id: b.id, revision: 1, description: 'Saved description' });
  const before = await ok();
  await pool.end(); pool = null; await admin.end(); admin = null; await local.cluster.stop(); await local.cluster.start();
  admin = createDatabase(local.adminUrl); pool = createDatabase(local.appUrl); auth = createAuthentication(pool, options); handle = workHttpHandler(pool, auth, options);
  assert.deepEqual(stableSnapshot(await ok()), stableSnapshot(before));
  const saved = before.tasks.find(x => x.id === child.id); assert.equal(saved.parentId, parent.id); assert.equal(saved.groupId, group.id); assert.equal(saved.dueDate, '2026-12-31'); assert.equal(saved.revision, 2);
  assert.deepEqual(before.tasks.find(x => x.id === parent.id).assigneeIds.sort(), [owner, editor.id].sort());
});

test('board/group/task concurrent revisions use database locking across independent pools', async () => {
  const b = await board(), t = await task(b); const secondPool = createDatabase(local.appUrl);
  try {
    const second = workHttpHandler(secondPool, createAuthentication(secondPool, options), options);
    for (const body of [
      { action: 'updateBoard', id: b.id, revision: 1, name: 'Competing board' },
      { action: 'updateGroup', id: b.group, revision: 1, name: 'Competing group' },
      { action: 'updateTask', id: t.id, revision: 1, patch: { title: 'Competing task' } }
    ]) {
      const results = await Promise.all([work(body), second(request(body))]); assert.deepEqual(results.map(x => x.status).sort(), [200, 409]);
      assert.equal((await results.find(x => x.status === 409).json()).conflict, true);
    }
  } finally { await secondPool.end(); }
  const final = await ok(); assert.equal(final.boards[0].revision, 2); assert.equal(final.groups[0].revision, 2); assert.equal(final.tasks[0].revision, 2);
});

test('date/field/order validation and subtask ancestor rules leave saved data untouched', async () => {
  const b = await board(), other = await board('Other'); const parent = await task(b, 'Parent'), child = await task(b, 'Child', { parentId: parent.id });
  const grandchild = await task(b, 'Grandchild', { parentId: child.id }); const otherTask = await task(other, 'Other task');
  for (const patch of [
    { parentId: parent.id }, { parentId: child.id }, { parentId: grandchild.id }, { parentId: otherTask.id }, { groupId: other.group },
    { dueDate: '2026-02-29' }, { dueDate: '0000-01-01' }, { dueDate: '2026-13-01' }, { dueDate: '' },
    { title: ' '.repeat(3) }, { status: 'Whatever' }, { priority: 'Urgent' }, { position: -1 }, { position: 1.5 }, { position: 2147483647 },
    { assigneeIds: [owner, owner] }, { assigneeIds: ['missing'] }, { boardId: other.id }
  ]) assert.equal((await work({ action: 'updateTask', id: parent.id, revision: 1, patch })).status, 400, JSON.stringify(patch));
  assert.equal((await ok()).tasks.find(x => x.id === parent.id).revision, 1);
  await ok({ action: 'updateTask', id: child.id, revision: 1, patch: { parentId: null, dueDate: null, assigneeIds: [] } });
  assert.equal((await ok()).tasks.find(x => x.id === child.id).parentId, null);
});

test('forced late failures roll back board/default-group and task/assignment writes atomically', async () => {
  await admin.query(`CREATE FUNCTION fail_work_group() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private forced failure'; END; $$;
    CREATE TRIGGER test_work_group BEFORE INSERT ON board_group FOR EACH ROW EXECUTE FUNCTION fail_work_group()`);
  try { const response = await work({ action: 'createBoard', name: 'Rollback' }); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private forced failure/); }
  finally { await admin.query('DROP TRIGGER test_work_group ON board_group; DROP FUNCTION fail_work_group()'); }
  assert.equal((await ok()).boards.length, 0);
  const b = await board(), t = await task(b, 'Untouched', { assigneeIds: [owner] });
  await admin.query(`CREATE FUNCTION fail_work_assignment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private assignment failure'; END; $$;
    CREATE TRIGGER test_work_assignment BEFORE INSERT ON task_assignee FOR EACH ROW EXECUTE FUNCTION fail_work_assignment()`);
  try { assert.equal((await work({ action: 'updateTask', id: t.id, revision: 1, patch: { title: 'Rollback', assigneeIds: [owner] } })).status, 503); }
  finally { await admin.query('DROP TRIGGER test_work_assignment ON task_assignee; DROP FUNCTION fail_work_assignment()'); }
  const final = (await ok()).tasks[0]; assert.equal(final.title, 'Untouched'); assert.equal(final.revision, 1); assert.deepEqual(final.assigneeIds, [owner]);
});

test('role/session revocation is rechecked after waiting for workspace lock', async () => {
  const editor = await member('editor@example.test'); const b = await board();
  const lock = await admin.connect();
  try {
    await lock.query('BEGIN'); await lock.query('SELECT id FROM workspace WHERE id=$1 FOR UPDATE', [workspace]);
    const pending = work({ action: 'createTask', boardId: b.id, groupId: b.group, title: 'Denied after demotion' }, editor.cookie);
    // Poll the database wait state, rather than assuming timing proves overlap.
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      const result = await admin.query("SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT id FROM workspace%'");
      if (result.rowCount) { waiting = true; break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(waiting, true);
    await lock.query("UPDATE membership SET role='viewer' WHERE workspace_id=$1 AND user_id=$2", [workspace, editor.id]);
    await lock.query('COMMIT'); assert.equal((await pending).status, 403);
  } finally { await lock.query('ROLLBACK'); lock.release(); }
  assert.equal((await ok()).tasks.length, 0);
  await admin.query('UPDATE app_user SET disabled_at=now() WHERE id=$1', [editor.id]); assert.equal((await work(undefined, editor.cookie)).status, 401);
  await admin.query('UPDATE auth_session SET "updatedAt"=now()-interval \'31 minutes\' WHERE "userId"=$1', [owner]); assert.equal((await work()).status, 401);
});

test('same-origin bounded JSON, unsupported verbs and sensitive error responses are safe', async () => {
  const body = { action: 'createBoard', name: 'Board' };
  for (const origin of ['', 'https://attacker.example']) assert.equal((await work(body, ownerCookie, origin)).status, 403);
  assert.equal((await work({ ...body, name: 'x'.repeat(512 * 1024) })).status, 413);
  const malformed = await handle(new Request(`${options.baseURL}/api/work`, { method: 'POST', headers: { origin: options.baseURL, 'content-type': 'application/json' }, body: '{' }));
  assert.equal(malformed.status, 400); assert.equal(malformed.headers.get('cache-control'), 'no-store');
  assert.equal((await handle(new Request(`${options.baseURL}/api/work`, { method: 'DELETE' }))).status, 405);
  assert.equal((await handle(new Request(`${options.baseURL}/api/work`, { method: 'POST', headers: { origin: options.baseURL, 'content-type': 'text/plain' }, body: '{}' }))).status, 415);
  const result = await ok(); assert.equal(result.boards.length, 0); assert.ok(!JSON.stringify(result).includes(password));
});


test('creation IDs make lost-response retries and competing worker creates idempotent without overwriting edits', async () => {
  const secondPool = createDatabase(local.appUrl);
  try {
    const second = workHttpHandler(secondPool, createAuthentication(secondPool, options), options);
    const boardId = randomUUID(), groupId = randomUUID(), taskId = randomUUID();
    for (const body of [
      { action: 'createBoard', creationId: boardId, name: 'Once' },
      { action: 'createGroup', creationId: groupId, boardId, name: 'Once group' },
      { action: 'createTask', creationId: taskId, boardId, groupId, title: 'Once task', assigneeIds: [owner] }
    ]) {
      const responses = await Promise.all([work(body), second(request(body)), work(body)]);
      for (const response of responses) assert.equal(response.status, 200, await response.clone().text());
      assert.deepEqual(stableSnapshot(await responses[0].json()), stableSnapshot(await responses[1].json()));
    }
    let data = await ok(); assert.equal(data.boards.length, 1); assert.equal(data.groups.length, 2); assert.equal(data.tasks.length, 1);
    assert.equal(data.tasks[0].id, taskId); assert.deepEqual(data.tasks[0].assigneeIds, [owner]);
    await ok({ action: 'updateTask', id: taskId, revision: 1, patch: { title: 'Later edit', assigneeIds: [] } });
    data = await ok({ action: 'createTask', creationId: taskId, boardId, groupId, title: 'Stale retry', assigneeIds: [owner] });
    assert.equal(data.tasks[0].title, 'Later edit'); assert.equal(data.tasks[0].revision, 2); assert.deepEqual(data.tasks[0].assigneeIds, []);
    // UUID namespaces remain per entity type; sharing a board's UUID is not
    // mistaken for a previously created task and cannot skip task validation.
    assert.equal((await work({ action: 'createTask', creationId: boardId, boardId, groupId, title: '' })).status, 400);
    assert.equal((await work({ action: 'createBoard', creationId: 'invalid', name: 'Bad' })).status, 400);
    const viewer = await member('retry-viewer@example.test', 'viewer');
    assert.equal((await work({ action: 'createBoard', creationId: boardId, name: 'Once' }, viewer.cookie)).status, 403);
  } finally { await secondPool.end(); }
});

test('creation ID collisions cannot return or modify another workspace, including simultaneous inserts', async () => {
  const other = (await admin.query("INSERT INTO workspace(name) VALUES('Other') RETURNING id")).rows[0].id;
  const outsider = await member('retry-outside@example.test', 'owner', other);
  const ours = await board();
  const outside = await ok({ action: 'createBoard', creationId: randomUUID(), name: 'Outside' }, outsider.cookie);
  const outsideBoard = outside.boards[0], outsideGroup = outside.groups[0];
  const outsideTask = (await ok({ action: 'createTask', creationId: randomUUID(), boardId: outsideBoard.id, groupId: outsideGroup.id, title: 'Outside task' }, outsider.cookie)).tasks[0];
  for (const body of [
    { action: 'createBoard', creationId: outsideBoard.id, name: 'Collision' },
    { action: 'createGroup', creationId: outsideGroup.id, boardId: ours.id, name: 'Collision' },
    { action: 'createTask', creationId: outsideTask.id, boardId: ours.id, groupId: ours.group, title: 'Collision' }
  ]) { const res = await work(body); assert.equal(res.status, 409); assert.doesNotMatch(await res.text(), /Outside/); }
  const shared = randomUUID();
  const responses = await Promise.all([
    work({ action: 'createBoard', creationId: shared, name: 'Concurrent own' }),
    work({ action: 'createBoard', creationId: shared, name: 'Concurrent outside' }, outsider.cookie)
  ]);
  assert.deepEqual(responses.map(x => x.status).sort(), [200, 409]);
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM board WHERE id=$1', [shared])).rows[0].n, 1);
  assert.equal((await ok(undefined, outsider.cookie)).tasks[0].title, 'Outside task');
});

async function column(b, kind, configuration = {}, name = kind) {
  const data = await ok({ action: 'createColumn', boardId: b.id, name, kind, configuration });
  return data.columns.find(x => x.name === name && x.boardId === b.id);
}
const field = (column, value) => ({ columnId: column.id, revision: column.revision, value });

test('all column kinds, notes and checklist persist atomically across restart and ordinary task edits', async () => {
  const b = await board(), t = await task(b);
  const columns = [await column(b, 'text'), await column(b, 'status', { options: ['Ready', 'Blocked'] }),
    await column(b, 'number', { format: 'number' }), await column(b, 'number', { format: 'cost', currency: 'EUR' }, 'Budget'),
    await column(b, 'date'), await column(b, 'link')];
  const values = ['  Plain text\n<not html>  ', 'Ready', -12.345, 19.99, '2028-02-29', 'https://example.test/path?a=one#section'];
  const checklist = [{ id: randomUUID(), label: 'First', done: false, position: 0 }, { id: randomUUID(), label: 'Second', done: true, position: 1 }];
  const notes = '  Line one\n\n' + '📝'.repeat(20000) + '\n  ';
  let data = await ok({ action: 'updateTask', id: t.id, revision: 1, patch: { notes, checklist, fields: columns.map((c, i) => field(c, values[i])) } });
  assert.equal(data.tasks[0].notes, notes); assert.deepEqual(data.tasks[0].checklist, checklist);
  for (let i = 0; i < columns.length; i++) assert.equal(data.tasks[0].fields.find(x => x.columnId === columns[i].id).value, values[i]);
  await ok({ action: 'updateTask', id: t.id, revision: 2, patch: { status: 'Done' } });
  const before = await ok();
  await pool.end(); pool = null; await admin.end(); admin = null; await local.cluster.stop(); await local.cluster.start();
  admin = createDatabase(local.adminUrl); pool = createDatabase(local.appUrl); auth = createAuthentication(pool, options); handle = workHttpHandler(pool, auth, options);
  assert.deepEqual(stableSnapshot(await ok()), stableSnapshot(before));
  data = await ok({ action: 'updateTask', id: t.id, revision: 3, patch: { notes: '', checklist: [checklist[1]], fields: [field(columns[0], null)] } });
  assert.equal(data.tasks[0].notes, ''); assert.deepEqual(data.tasks[0].checklist, [checklist[1]]); assert.equal(data.tasks[0].fields.length, 5);
});

test('column and detail actions enforce member role, board and workspace boundaries', async () => {
  const b = await board(), otherBoard = await board('Other board'), t = await task(b), c = await column(b, 'text'), otherColumn = await column(otherBoard, 'text');
  const editor = await member('details-editor@example.test'), viewer = await member('details-viewer@example.test', 'viewer');
  for (const body of [{ action: 'createColumn', boardId: b.id, name: 'Editor field', kind: 'text', configuration: {} },
    { action: 'updateColumn', id: c.id, revision: 1, name: 'Renamed' },
    { action: 'updateTask', id: t.id, revision: 1, patch: { notes: 'Editor notes' } }]) {
    assert.equal((await work(body, viewer.cookie)).status, 403); assert.equal((await work(body, editor.cookie)).status, 200);
  }
  assert.equal((await ok(undefined, viewer.cookie)).tasks[0].notes, 'Editor notes');
  assert.equal((await work({ action: 'updateTask', id: t.id, revision: 2, patch: { fields: [field(otherColumn, 'wrong board')] } })).status, 400);
  const otherWorkspace = (await admin.query("INSERT INTO workspace(name) VALUES('Outside') RETURNING id")).rows[0].id;
  const outsider = await member('details-outside@example.test', 'owner', otherWorkspace);
  const outsideData = await ok({ action: 'createBoard', name: 'Outside' }, outsider.cookie), outsideBoard = outsideData.boards[0];
  const outsideColumn = (await ok({ action: 'createColumn', boardId: outsideBoard.id, name: 'Private', kind: 'text', configuration: {} }, outsider.cookie)).columns[0];
  for (const body of [{ action: 'updateColumn', id: outsideColumn.id, revision: 1, name: 'Stolen' },
    { action: 'createColumn', boardId: outsideBoard.id, name: 'Stolen', kind: 'text', configuration: {} },
    { action: 'updateTask', id: t.id, revision: 2, patch: { fields: [field(outsideColumn, 'Stolen')] } }]) assert.equal((await work(body)).status, 404);
  assert.equal((await work({ action: 'createColumn', creationId: outsideColumn.id, boardId: b.id, name: 'Collision', kind: 'text', configuration: {} })).status, 409);
  assert.equal((await ok()).columns.some(x => x.id === outsideColumn.id), false);
  const outsideTask = (await ok({ action: 'createTask', boardId: outsideBoard.id, groupId: outsideData.groups[0].id, title: 'Private task' }, outsider.cookie)).tasks[0];
  const privateItem = { id: randomUUID(), label: 'Private checklist', done: false, position: 0 };
  await ok({ action: 'updateTask', id: outsideTask.id, revision: 1, patch: { checklist: [privateItem] } }, outsider.cookie);
  assert.equal((await work({ action: 'updateTask', id: t.id, revision: 2, patch: { checklist: [privateItem] } })).status, 409);
  assert.deepEqual((await ok(undefined, outsider.cookie)).tasks[0].checklist, [privateItem]);
});

test('column configuration validation, 20-column cap and idempotent creation preserve definitions', async () => {
  const b = await board();
  for (const input of [
    { kind: 'script', configuration: {} }, { kind: 'text', configuration: { html: true } },
    { kind: 'status', configuration: { options: [] } }, { kind: 'status', configuration: { options: ['One', ' One '] } },
    { kind: 'status', configuration: { options: [' '] } }, { kind: 'status', configuration: { options: Array.from({ length: 21 }, (_, i) => String(i)) } },
    { kind: 'number', configuration: { format: 'currency' } }, { kind: 'number', configuration: { format: 'cost', currency: 'BAD' } },
    { kind: 'number', configuration: { format: 'number', currency: 'EUR' } }, { kind: 'link', configuration: { target: 'script' } }
  ]) assert.equal((await work({ action: 'createColumn', boardId: b.id, name: 'Invalid', ...input })).status, 400);
  const creationId = randomUUID(), body = { action: 'createColumn', boardId: b.id, name: 'Once', kind: 'text', configuration: {}, creationId };
  const responses = await Promise.all([work(body), work(body)]); for (const response of responses) assert.equal(response.status, 200);
  await ok({ action: 'updateColumn', id: creationId, revision: 1, name: 'Later', position: 3 });
  assert.equal((await ok(body)).columns.find(x => x.id === creationId).name, 'Later');
  for (let i = 1; i < 20; i++) await column(b, 'text', {}, `Column ${i}`);
  assert.equal((await work({ ...body, creationId: randomUUID() })).status, 400);
  assert.equal((await ok(body)).columns.length, 20);
});

test('used column definitions prevent destructive type/format/option changes and stale field writes', async () => {
  const b = await board(), t = await task(b), status = await column(b, 'status', { options: ['One', 'Two'] }), cost = await column(b, 'number', { format: 'cost', currency: 'EUR' });
  await ok({ action: 'updateTask', id: t.id, revision: 1, patch: { fields: [field(status, 'One'), field(cost, 10.25)] } });
  for (const body of [
    { id: status.id, kind: 'text', configuration: {} }, { id: status.id, configuration: { options: ['Renamed', 'Two'] } },
    { id: cost.id, kind: 'text', configuration: {} }, { id: cost.id, configuration: { format: 'number' } },
    { id: cost.id, configuration: { format: 'cost', currency: 'USD' } }
  ]) assert.equal((await work({ action: 'updateColumn', revision: 1, ...body })).status, 400);
  const changed = (await ok({ action: 'updateColumn', id: status.id, revision: 1, name: 'Progress', position: 10, configuration: { options: ['Two', 'One', 'Three'] } })).columns.find(x => x.id === status.id);
  for (const value of ['One', null]) assert.equal((await work({ action: 'updateTask', id: t.id, revision: 2, patch: { notes: 'Must roll back', fields: [field(status, value)] } })).status, 409);
  assert.equal((await ok()).tasks[0].notes, '');
  await ok({ action: 'updateTask', id: t.id, revision: 2, patch: { fields: [field(changed, null), field(cost, null)] } });
  await ok({ action: 'updateColumn', id: status.id, revision: 2, kind: 'date', configuration: {} });
  await ok({ action: 'updateColumn', id: cost.id, revision: 1, configuration: { format: 'cost', currency: 'USD' } });
});

test('detail validation rejects malformed values and checklist identity transfer without partial updates', async () => {
  const b = await board(), t = await task(b), other = await task(b, 'Other');
  const textColumn = await column(b, 'text'), number = await column(b, 'number'), cost = await column(b, 'number', { format: 'cost', currency: 'GBP' }, 'Cost');
  const date = await column(b, 'date'), link = await column(b, 'link'), status = await column(b, 'status', { options: ['Yes'] });
  const item = { id: randomUUID(), label: 'Private item', done: false, position: 0 };
  await ok({ action: 'updateTask', id: other.id, revision: 1, patch: { checklist: [item] } });
  for (const patch of [
    { notes: 'x'.repeat(50001) }, { notes: null }, { notes: '\0' },
    { fields: [field(textColumn, 'x'.repeat(1001))] }, { fields: [field(textColumn, 123)] },
    { fields: [field(number, '12')] }, { fields: [field(number, 1e12 + 1)] }, { fields: [field(cost, 1.005)] }, { fields: [field(cost, 1e-7)] },
    { fields: [field(date, '2026-02-29')] }, { fields: [field(status, 'No')] },
    ...['javascript:alert(1)', '//example.test', 'https://user:pass@example.test', 'https://example.test/\nabc', 'https://example.test/\u0085abc', 'https://example.test/\\abc', ' https://example.test', 'https://example.test/' + 'x'.repeat(2048)].map(value => ({ fields: [field(link, value)] })),
    { fields: [field(textColumn, 'one'), field(textColumn, 'two')] }, { fields: [{ ...field(textColumn, 'one'), workspaceId: workspace }] },
    { checklist: [{ ...item, id: randomUUID(), done: 'false' }] }, { checklist: [{ ...item, id: randomUUID(), label: '' }] }, { checklist: [{ ...item, id: randomUUID(), label: '\0' }] },
    { checklist: [{ ...item, id: randomUUID(), position: -1 }] }, { checklist: [item, item] },
    { checklist: Array.from({ length: 51 }, () => ({ ...item, id: randomUUID() })) }
  ]) assert.equal((await work({ action: 'updateTask', id: t.id, revision: 1, patch: { title: 'Must not change', ...patch } })).status, 400, JSON.stringify(patch).slice(0, 100));
  assert.equal((await work({ action: 'updateTask', id: t.id, revision: 1, patch: { checklist: [item] } })).status, 409);
  const final = await ok(); assert.equal(final.tasks.find(x => x.id === t.id).revision, 1); assert.equal(final.tasks.find(x => x.id === t.id).title, 'Task');
  assert.deepEqual(final.tasks.find(x => x.id === other.id).checklist, [item]);
});

test('independent workers conflict on task details and column revisions; late checklist failure rolls all fields back', async () => {
  const b = await board(), t = await task(b), c = await column(b, 'text'); const secondPool = createDatabase(local.appUrl);
  try {
    const second = workHttpHandler(secondPool, createAuthentication(secondPool, options), options);
    for (const body of [
      { action: 'updateTask', id: t.id, revision: 1, patch: { notes: 'Won once', fields: [field(c, 'Won once')] } },
      { action: 'updateColumn', id: c.id, revision: 1, name: 'Won once' }
    ]) assert.deepEqual((await Promise.all([work(body), second(request(body))])).map(x => x.status).sort(), [200, 409]);
  } finally { await secondPool.end(); }
  await admin.query(`CREATE FUNCTION fail_details_checklist() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private details failure'; END; $$;
    CREATE TRIGGER test_details_checklist BEFORE INSERT ON checklist_item FOR EACH ROW EXECUTE FUNCTION fail_details_checklist()`);
  const before = await ok();
  try {
    const response = await work({ action: 'updateTask', id: t.id, revision: 2, patch: { notes: 'Rolled back', fields: [field({ ...c, revision: 2 }, 'Rolled back')], checklist: [{ id: randomUUID(), label: 'Fail', done: false, position: 0 }] } });
    assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private details failure/);
  } finally { await admin.query('DROP TRIGGER test_details_checklist ON checklist_item; DROP FUNCTION fail_details_checklist()'); }
  assert.deepEqual(stableSnapshot(await ok()), stableSnapshot(before));
});

test('four passive clients converge after missed updates without extending idle sessions', async () => {
  const first = await member('live-editor-1@example.test');
  const second = await member('live-editor-2@example.test');
  const viewer = await member('live-viewer@example.test', 'viewer');
  const clients = [ownerCookie, first.cookie, second.cookie, viewer.cookie];
  const b = await board('Live workspace');
  const t = await task(b, 'Shared live task');
  const before = await Promise.all(clients.map(cookie => ok(undefined, cookie)));
  assert.ok(before.every(s => s.tasks.find(item => item.id === t.id).revision === 1));
  const competing = await Promise.all([
    work({action:'updateTask',id:t.id,revision:1,patch:{status:'In progress'}},first.cookie),
    work({action:'updateTask',id:t.id,revision:1,patch:{status:'Done'}},second.cookie),
  ]);
  assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);
  const committed = (await competing.find(r=>r.status===200).json()).tasks.find(item=>item.id===t.id);
  // The viewer misses both writes; its next authorized full snapshot catches up.
  const updated=await ok({action:'updateTask',id:t.id,revision:committed.revision,patch:{dueDate:'2028-02-29'}},ownerCookie);
  const expected=updated.tasks.find(item=>item.id===t.id);
  const sessionsBefore=(await admin.query('SELECT id,"updatedAt" FROM auth_session ORDER BY id')).rows;
  const reconnected=await Promise.all(clients.map(cookie=>ok(undefined,cookie)));
  assert.ok(reconnected.every(s=>JSON.stringify(s.tasks.find(item=>item.id===t.id))===JSON.stringify(expected)));
  assert.deepEqual((await admin.query('SELECT id,"updatedAt" FROM auth_session ORDER BY id')).rows,sessionsBefore);
  assert.equal((await work({action:'updateTask',id:t.id,revision:expected.revision,patch:{status:'To do'}},viewer.cookie)).status,403);
  await admin.query('DELETE FROM membership WHERE workspace_id=$1 AND user_id=$2',[workspace,viewer.id]);
  assert.equal((await work(undefined,viewer.cookie)).status,401);
  await admin.query('UPDATE auth_session SET "updatedAt"=now()-interval \'31 minutes\' WHERE "userId"=$1',[second.id]);
  assert.equal((await work(undefined,second.cookie)).status,401);
});


test('dashboard inputs expose saved timestamps and preserve account/workspace scope', async () => {
  const viewer = await member('dashboard-viewer@example.test', 'viewer');
  const editor = await member('dashboard-editor@example.test', 'editor');
  const b = await board('Dashboard board');
  const shared = await task(b, 'Shared overdue', { assigneeIds: [owner, viewer.id], dueDate: '2028-02-28' });
  await task(b, 'Editor done', { assigneeIds: [editor.id], status: 'Done', dueDate: '2028-02-28' });
  const saved = await ok(undefined, viewer.cookie);
  assert.ok(Number.isFinite(Date.parse(saved.tasks.find(t => t.id === shared.id).updatedAt)));
  const personal = buildWorkDashboard(saved, '2028-02-29');
  assert.equal(personal.personal.open, 1);
  assert.equal(personal.team.total, 2);
  assert.equal(personal.team.overdue, 1);
  assert.equal(personal.recentTasks[0].id, shared.id);
  const other = (await admin.query("INSERT INTO workspace(name) VALUES('Dashboard outside') RETURNING id")).rows[0].id;
  const outsider = await member('dashboard-outside@example.test', 'owner', other);
  const outside = buildWorkDashboard(await ok(undefined, outsider.cookie), '2028-02-29');
  assert.equal(outside.team.total, 0);
  assert.equal(outside.recentTasks.length, 0);
  assert.ok(!outside.members.some(row => row.member.id === owner));
  await ok({ action: 'updateTask', id: shared.id, revision: shared.revision, patch: { status: 'Done' } });
  const updated = buildWorkDashboard(await ok(undefined, viewer.cookie), '2028-02-29');
  assert.equal(updated.personal.open, 0);
  assert.equal(updated.team.overdue, 0);
  assert.equal(updated.team.completionPercent, 100);
});
