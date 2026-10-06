import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { localRoot, openLocalCluster, provisionLocalDatabase, grantApplicationAccess } from '../../scripts/db/local.mjs';
import { createDatabase } from '../../src/server/database.mjs';
import { migrate } from '../../scripts/db/migrate.mjs';
import { createAuthentication, verifiedActor } from '../../src/server/auth-core.mjs';
import { createFirstOwner } from '../../src/server/account-operator.mjs';
import { authHttpHandler } from '../../src/server/auth-http.mjs';
import { membershipHttpHandler } from '../../src/server/membership-http.mjs';
import { workHttpHandler } from '../../src/server/work-http.mjs';
import { filesHttpHandler } from '../../src/server/files-http.mjs';
import { readWorkFilters, filterWorkTasks } from '../../src/lib/work-filters.mjs';

// A single connected regression journey complements the focused domain suites.
// All state belongs to this disposable cluster, including attachment storage.
let local, admin, pool, auth, routes;
const options = { secret: randomBytes(48).toString('hex'), baseURL: 'http://127.0.0.1:3100' };
const password = 'Disposable foundation journey password 123!';
function connect() {
  admin = createDatabase(local.adminUrl); pool = createDatabase(local.appUrl);
  auth = createAuthentication(pool, options);
  routes = {
    auth: authHttpHandler(auth, pool, options.baseURL),
    team: membershipHttpHandler(pool, auth, options),
    work: workHttpHandler(pool, auth, options),
    files: filesHttpHandler(pool, auth, options),
  };
}
function request(service, path, cookie = '', body) {
  return routes[service](new Request(`${options.baseURL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { cookie, origin: options.baseURL, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}
async function json(response, status = 200) {
  const result = await response;
  assert.equal(result.status, status, await result.clone().text());
  return result.json();
}
async function login(email) {
  const result = await request('auth', '/api/auth/sign-in/email', '', { email, password });
  assert.equal(result.status, 200, await result.clone().text());
  const cookie = result.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  return { ...(await verifiedActor(auth, pool, new Headers({ cookie }))), cookie };
}
async function invite(owner, email, role) {
  const invited = await json(request('team', '/api/team', owner.cookie, { action: 'invite', email, role }));
  const token = new URL(invited.link).searchParams.get('token');
  const details = await json(request('team', `/api/invitations?token=${token}`));
  assert.equal(details.email, email); assert.equal(details.role, role);
  await json(request('team', '/api/invitations', '', { token, name: `Journey ${role}`, password }));
  const joined = await login(email);
  assert.equal(joined.workspaceId, owner.workspaceId); assert.equal(joined.role, role);
  return joined;
}
function upload(actor, taskId, contents = 'Foundation journey attachment — durable bytes.\n') {
  return routes.files(new Request(`${options.baseURL}/api/files?taskId=${taskId}`, {
    method: 'POST', headers: { cookie: actor.cookie, origin: options.baseURL, 'content-type': 'application/octet-stream', 'x-upload-name': encodeURIComponent('Journey notes.txt') }, body: contents,
  }));
}
before(async () => {
  await mkdir(`${localRoot}tests`, { recursive: true });
  const directory = await mkdtemp(`${localRoot}tests/foundation-journey-`);
  options.storageRoot = `${directory}/attachments`;
  local = await openLocalCluster(`${directory}/postgres`, 55438);
  await local.cluster.start(); await provisionLocalDatabase(local);
  admin = createDatabase(local.adminUrl); await migrate(admin); await grantApplicationAccess(admin); await admin.end();
  connect();
});
after(async () => { await pool?.end(); await admin?.end(); await local?.cluster.stop(); });

test('invited staff create, assign, enrich, attach and find durable work while role changes revoke access across services', async () => {
  await createFirstOwner(pool, options, { name: 'Journey owner', email: 'journey-owner@example.test', password });
  const owner = await login('journey-owner@example.test');
  const editor = await invite(owner, 'journey-editor@example.test', 'editor');
  const viewer = await invite(owner, 'journey-viewer@example.test', 'viewer');
  const team = await json(request('team', '/api/team', owner.cookie));
  assert.equal(team.canManage, true); assert.equal(team.members.length, 3);
  for (const actor of [editor, viewer]) {
    assert.equal((await json(request('team', '/api/team', actor.cookie))).canManage, false);
    assert.equal((await request('team', '/api/team', actor.cookie, { action: 'role', id: owner.id, role: 'viewer' })).status, 403);
  }

  const created = await json(request('work', '/api/work', owner.cookie, { action: 'createBoard', name: 'Connected foundation' }));
  const board = created.boards[0], group = created.groups[0];
  const withTask = await json(request('work', '/api/work', editor.cookie, {
    action: 'createTask', boardId: board.id, groupId: group.id, title: 'Prepare launch handoff',
    assigneeIds: [editor.id, viewer.id], status: 'In progress', priority: 'High', dueDate: '2028-06-15',
  }));
  let task = withTask.tasks[0];
  const withColumn = await json(request('work', '/api/work', owner.cookie, {
    action: 'createColumn', boardId: board.id, name: 'Release channel', kind: 'text', configuration: {},
  }));
  const column = withColumn.columns[0], checklistId = randomUUID();
  const enriched = await json(request('work', '/api/work', editor.cookie, {
    action: 'updateTask', id: task.id, revision: task.revision, patch: {
      notes: 'Durable acceptance phrase: review the release checklist.',
      checklist: [{ id: checklistId, label: 'Verify attachment', done: true, position: 0 }],
      fields: [{ columnId: column.id, revision: column.revision, value: 'Internal review' }],
    },
  }));
  task = enriched.tasks[0];
  const bytes = 'Foundation journey attachment — durable bytes.\n';
  const { file } = await json(upload(editor, task.id, bytes), 201);
  assert.equal(file.taskId, task.id); assert.equal(file.boardId, board.id); assert.equal(file.taskTitle, task.title);
  const filters = readWorkFilters(new URLSearchParams({ q: 'durable acceptance', status: 'In progress', priority: 'High', assignee: editor.id, due: 'today' }));
  for (const actor of [owner, editor, viewer]) {
    const snapshot = await json(request('work', '/api/work', actor.cookie));
    assert.deepEqual(filterWorkTasks(snapshot.tasks, filters, '2028-06-15').map(value => value.id), [task.id]);
    assert.deepEqual((await json(request('files', `/api/files?taskId=${task.id}`, actor.cookie))).files.map(value => value.id), [file.id]);
    const download = await request('files', `/api/files/${file.id}`, actor.cookie);
    assert.equal(download.status, 200); assert.equal(await download.text(), bytes);
  }
  assert.equal((await request('work', '/api/work', viewer.cookie, { action: 'updateTask', id: task.id, revision: task.revision, patch: { title: 'Denied' } })).status, 403);
  assert.equal((await upload(viewer, task.id)).status, 403);

  // Only this separate fixture is seeded directly: it represents another tenant,
  // while the staff journey above uses the invitation and application endpoints.
  const outsideWorkspace = (await admin.query("INSERT INTO workspace(name) VALUES('Separate workspace') RETURNING id")).rows[0].id;
  const outsideId = (await createAuthentication(pool, { ...options, allowSignup: true }).api.signUpEmail({ body: { name: 'Outside owner', email: 'journey-outside@example.test', password } })).user.id;
  await admin.query("INSERT INTO membership(workspace_id,user_id,role) VALUES($1,$2,'owner')", [outsideWorkspace, outsideId]);
  const outsider = await login('journey-outside@example.test');
  const outsideWork = await json(request('work', '/api/work', outsider.cookie));
  assert.deepEqual(filterWorkTasks(outsideWork.tasks, filters, '2028-06-15'), []);
  assert.deepEqual((await json(request('files', '/api/files', outsider.cookie))).files, []);
  assert.equal((await request('files', `/api/files/${file.id}`, outsider.cookie)).status, 404);
  assert.equal((await upload(outsider, task.id)).status, 404);
  assert.equal((await request('work', '/api/work', outsider.cookie, { action: 'updateTask', id: task.id, revision: task.revision, patch: { title: 'Denied' } })).status, 404);
  const outsideTeam = await json(request('team', '/api/team', outsider.cookie));
  assert.deepEqual(outsideTeam.members.map(value => value.id), [outsider.id]);
  assert.equal((await request('team', '/api/team', outsider.cookie, { action: 'remove', id: editor.id })).status, 404);

  // Restart the actual isolated PostgreSQL process and reconstruct application
  // services, keeping the original signed-in cookies and private blob directory.
  await pool.end(); pool = null; await admin.end(); admin = null;
  await local.cluster.stop(); await local.cluster.start(); connect();
  const restored = await json(request('work', '/api/work', viewer.cookie));
  const restoredTask = restored.tasks.find(value => value.id === task.id);
  assert.deepEqual(restoredTask, task);
  assert.deepEqual(restored.columns, enriched.columns);
  assert.equal((await json(request('team', '/api/team', owner.cookie))).members.length, 3);
  assert.equal(await (await request('files', `/api/files/${file.id}`, viewer.cookie)).text(), bytes);
  assert.deepEqual(filterWorkTasks(restored.tasks, filters, '2028-06-15').map(value => value.id), [task.id]);

  await json(request('team', '/api/team', owner.cookie, { action: 'role', id: editor.id, role: 'viewer' }));
  for (const service of ['work', 'files', 'team']) assert.equal((await request(service, `/api/${service}`, editor.cookie)).status, 401);
  assert.equal((await upload(editor, task.id)).status, 401);
  const demoted = await login('journey-editor@example.test');
  assert.equal(demoted.role, 'viewer');
  assert.equal((await request('work', '/api/work', demoted.cookie)).status, 200);
  assert.equal((await request('work', '/api/work', demoted.cookie, { action: 'updateTask', id: task.id, revision: task.revision, patch: { notes: 'Denied after role change' } })).status, 403);
  assert.equal((await upload(demoted, task.id)).status, 403);
  assert.equal((await request('team', '/api/team', demoted.cookie, { action: 'invite', email: 'denied@example.test', role: 'editor' })).status, 403);
  await json(request('team', '/api/team', owner.cookie, { action: 'remove', id: editor.id }));
  for (const service of ['work', 'files', 'team']) assert.equal((await request(service, `/api/${service}`, demoted.cookie)).status, 401);
  assert.equal((await request('files', `/api/files/${file.id}`, demoted.cookie)).status, 401);
  assert.equal((await upload(demoted, task.id)).status, 401);

  const remaining = await json(request('work', '/api/work', owner.cookie));
  const remainingTask = remaining.tasks.find(value => value.id === task.id);
  assert.deepEqual(remainingTask.assigneeIds, [viewer.id]);
  assert.equal(remainingTask.notes, task.notes); assert.deepEqual(remainingTask.checklist, task.checklist); assert.deepEqual(remainingTask.fields, task.fields);
  assert.equal(await (await request('files', `/api/files/${file.id}`, viewer.cookie)).text(), bytes);
  assert.deepEqual(filterWorkTasks(remaining.tasks, filters, '2028-06-15'), []);
  assert.equal((await request('team', '/api/team', owner.cookie, { action: 'remove', id: owner.id })).status, 409);
});
