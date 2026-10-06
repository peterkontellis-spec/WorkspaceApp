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
import { updatesHttpHandler } from '../../src/server/updates-http.mjs';

let local, admin, pool, auth, handle, updatesHandle, owner, ownerCookie, workspace;
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
  local = await openLocalCluster(`${await mkdtemp(`${localRoot}tests/updates-`)}/postgres`, 55439);
  await local.cluster.start(); await provisionLocalDatabase(local);
  admin = createDatabase(local.adminUrl); await migrate(admin); await grantApplicationAccess(admin);
  pool = createDatabase(local.appUrl); auth = createAuthentication(pool, options); handle = workHttpHandler(pool, auth, options); updatesHandle = updatesHttpHandler(pool, auth, options);
});
beforeEach(async () => {
  await admin.query('TRUNCATE workspace,app_user,auth_user,auth_rate_limit,auth_verification,invitation_rate_limit CASCADE');
  owner = await createFirstOwner(pool, options, { name: 'Owner', email: 'owner@example.test', password });
  ownerCookie = await login('owner@example.test'); workspace = (await verifiedActor(auth, pool, new Headers({ cookie: ownerCookie }))).workspaceId;
});
after(async () => { await pool?.end(); await admin?.end(); await local?.cluster.stop(); });


const updates = (cookie = ownerCookie, query = '', body, origin = options.baseURL) => updatesHandle(new Request(`${options.baseURL}/api/updates${query}`, {method:body===undefined?'GET':'POST',headers:{cookie:cookie??'',origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}));
async function inbox(cookie = ownerCookie, query = '') { const response = await updates(cookie,query); assert.equal(response.status,200,await response.clone().text());return response.json(); }
async function change(t, patch, cookie) { const data=await ok({action:'updateTask',id:t.id,revision:t.revision,patch},cookie);return data.tasks.find(x=>x.id===t.id); }

test('creation, assignment, meaningful change and removal notify active recipients without self notifications', async () => {
  const editor=await member('editor@example.test'), viewer=await member('viewer@example.test','viewer');
  const b=await board(); let t=await task(b,'Shared',{assigneeIds:[owner,editor.id,viewer.id]});
  assert.equal((await inbox()).items.length,0);
  let message=(await inbox(editor.cookie)).items[0];assert.match(message.summary,/assigned/);assert.equal(message.actorName,'Owner');assert.equal(message.taskId,t.id);assert.equal(message.readAt,null);assert.match(message.createdAt,/Z$/);
  assert.equal((await ok(undefined,editor.cookie)).unreadNotifications,1);
  t=await change(t,{status:'In progress',dueDate:'2028-02-29'});
  assert.match((await inbox(viewer.cookie)).items[0].summary,/status from To do to In progress, due date from none to 2028-02-29/);
  t=await change(t,{assigneeIds:[owner,viewer.id]},editor.cookie);
  assert.equal((await inbox(editor.cookie)).items.length,2); // self-unassignment is silent
  t=await change(t,{assigneeIds:[owner]});
  assert.match((await inbox(viewer.cookie)).items[0].summary,/unassigned/);
  const activity=await inbox(viewer.cookie,`?taskId=${t.id}`);assert.equal(activity.items.length,4);assert.equal(activity.items[0].readAt,undefined);
  assert.equal((await inbox()).items.length,1); // owner's task changed by editor
});

test('no-op saves, reordered arrays, creation retries and position-only edits do not duplicate notifications', async () => {
  const editor=await member('editor@example.test');const b=await board();const creationId=randomUUID();
  let t=await task(b,'Once',{creationId,assigneeIds:[owner,editor.id]});
  await ok({action:'createTask',creationId,boardId:b.id,groupId:b.group,title:'Retry',assigneeIds:[owner,editor.id]});
  t=await change(t,{title:' Once ',assigneeIds:[editor.id,owner],notes:'',checklist:[],fields:[]});
  assert.equal((await inbox(editor.cookie)).items.length,1);assert.equal((await inbox(ownerCookie,`?taskId=${t.id}`)).items.length,1);
  t=await change(t,{position:5});assert.equal((await inbox(editor.cookie)).items.length,1);assert.equal((await inbox(ownerCookie,`?taskId=${t.id}`)).items.length,2);
  t=await change(t,{notes:'Secret notes must never enter notification/history rows'});
  const raw=(await admin.query('SELECT * FROM task_activity')).rows;assert.doesNotMatch(JSON.stringify(raw),/Secret notes/);assert.match((await inbox(editor.cookie)).items[0].summary,/notes/);
});

test('conflicting and late failed transactions cannot leave history, notifications or changed task state', async () => {
  const editor=await member('editor@example.test');const b=await board(),t=await task(b,'Atomic',{assigneeIds:[editor.id]});
  const responses=await Promise.all([work({action:'updateTask',id:t.id,revision:1,patch:{status:'Done'}}),work({action:'updateTask',id:t.id,revision:1,patch:{status:'In progress'}})]);
  assert.deepEqual(responses.map(x=>x.status).sort(),[200,409]);
  const saved=(await ok()).tasks[0];assert.equal((await inbox(editor.cookie)).items.length,2);
  await admin.query(`CREATE FUNCTION fail_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private failure'; END; $$; CREATE TRIGGER fail_notification BEFORE INSERT ON task_notification FOR EACH ROW EXECUTE FUNCTION fail_notification()`);
  try {const result=await work({action:'updateTask',id:t.id,revision:saved.revision,patch:{notes:'Rollback'}});assert.equal(result.status,503);assert.doesNotMatch(await result.text(),/private failure/);} finally {await admin.query('DROP TRIGGER fail_notification ON task_notification; DROP FUNCTION fail_notification()');}
  assert.deepEqual((await ok()).tasks[0],saved);assert.equal((await inbox(editor.cookie)).items.length,2);assert.equal((await inbox(ownerCookie,`?taskId=${t.id}`)).items.length,2);
});

test('viewer read-state is private, idempotent and reversible; activity has no write API', async () => {
  const editor=await member('editor@example.test'),viewer=await member('viewer@example.test','viewer');const b=await board();await task(b,'Read',{assigneeIds:[editor.id,viewer.id]});
  const own=(await inbox(viewer.cookie)).items[0],other=(await inbox(editor.cookie)).items[0];
  assert.equal((await updates(viewer.cookie,'',{action:'setRead',id:other.id,read:true})).status,404);
  assert.equal((await updates(viewer.cookie,'',{action:'setRead',id:own.id,read:true})).status,200);
  const marked=(await inbox(viewer.cookie)).items[0].readAt;assert.ok(marked);assert.equal((await ok(undefined,viewer.cookie)).unreadNotifications,0);
  assert.equal((await updates(viewer.cookie,'',{action:'setRead',id:own.id,read:true})).status,200);assert.equal((await inbox(viewer.cookie)).items[0].readAt,marked);
  assert.equal((await updates(viewer.cookie,'',{action:'setRead',id:own.id,read:false})).status,200);assert.equal((await ok(undefined,viewer.cookie)).unreadNotifications,1);
  assert.equal((await updates(viewer.cookie,'',{action:'setRead',id:own.id,read:true,recipientId:editor.id})).status,400);
});

test('workspace isolation, revocation, disabled recipients and idle-session authority apply to updates', async () => {
  const editor=await member('editor@example.test'),viewer=await member('viewer@example.test','viewer');const b=await board();let t=await task(b,'Private',{assigneeIds:[editor.id,viewer.id]});
  const otherWorkspace=(await admin.query("INSERT INTO workspace(name) VALUES('Outside') RETURNING id")).rows[0].id;
  const outsider=await member('outside@example.test','owner',otherWorkspace);
  assert.equal((await inbox(outsider.cookie)).items.length,0);assert.equal((await updates(outsider.cookie,`?taskId=${t.id}`)).status,404);
  await admin.query('UPDATE app_user SET disabled_at=now() WHERE id=$1',[editor.id]);await admin.query('DELETE FROM membership WHERE workspace_id=$1 AND user_id=$2',[workspace,viewer.id]);
  t=await change(t,{status:'Done'});assert.equal((await admin.query('SELECT count(*)::int AS n FROM task_notification WHERE recipient_id=$1',[editor.id])).rows[0].n,1);
  assert.equal((await updates(editor.cookie)).status,401);assert.equal((await updates(viewer.cookie)).status,401);
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM task_notification WHERE recipient_id=$1',[viewer.id])).rows[0].n,0);
  const before=(await admin.query('SELECT id,"updatedAt" FROM auth_session ORDER BY id')).rows;await inbox();await inbox(ownerCookie,`?taskId=${t.id}`);assert.deepEqual((await admin.query('SELECT id,"updatedAt" FROM auth_session ORDER BY id')).rows,before);
  await admin.query('UPDATE auth_session SET "updatedAt"=now()-interval \'31 minutes\' WHERE "userId"=$1',[owner]);assert.equal((await updates()).status,401);
});

test('cursor pages remain ordered and disjoint as new events arrive; malformed queries and forged writes reject', async () => {
  const viewer=await member('viewer@example.test','viewer');const b=await board();let t=await task(b,'Pages',{assigneeIds:[viewer.id]});
  for(let i=0;i<26;i++) t=await change(t,{notes:`Revision ${i}`});
  for(const query of ['',`?taskId=${t.id}`]) {
    const first=await inbox(viewer.cookie,query);assert.equal(first.items.length,25);assert.ok(first.nextCursor);
    t=await change(t,{notes:`New ${query}`});
    const second=await inbox(viewer.cookie,`${query}${query?'&':'?'}before=${first.nextCursor}`);assert.ok(second.items.length>=2);assert.equal(second.nextCursor,null);assert.ok(second.items.every(x=>!first.items.some(y=>y.id===x.id)));assert.ok(first.items.every((x,i,a)=>!i||BigInt(a[i-1].id)>BigInt(x.id)));
  }
  for(const query of ['?before=0','?before=-1','?before=9223372036854775808','?before=1&before=2','?taskId=wrong','?recipient=anyone']) assert.equal((await updates(viewer.cookie,query)).status,400);
  const item=(await inbox(viewer.cookie)).items[0];
  assert.equal((await updates(viewer.cookie,'',{action:'setRead',id:item.id,read:true},'https://attacker.example')).status,403);
  assert.equal((await updates(viewer.cookie,'',{action:'setRead',id:'x'.repeat(5000),read:true})).status,413);
  assert.equal((await updates('')).status,401);
});

test('history/read-state survive restart and additive migration reruns without backfilled events', async () => {
  const viewer=await member('persist@example.test','viewer');const b=await board();let t=await task(b,'Durable',{assigneeIds:[viewer.id]});
  t=await change(t,{status:'Done'});const item=(await inbox(viewer.cookie)).items[0];
  await updates(viewer.cookie,'',{action:'setRead',id:item.id,read:true});
  const history=await inbox(ownerCookie,`?taskId=${t.id}`),notifications=await inbox(viewer.cookie),snapshot=await ok(undefined,viewer.cookie);
  await migrate(admin);assert.deepEqual(await inbox(ownerCookie,`?taskId=${t.id}`),history);
  await pool.end();pool=null;await admin.end();admin=null;await local.cluster.stop();await local.cluster.start();
  admin=createDatabase(local.adminUrl);pool=createDatabase(local.appUrl);auth=createAuthentication(pool,options);handle=workHttpHandler(pool,auth,options);updatesHandle=updatesHttpHandler(pool,auth,options);
  assert.deepEqual(await inbox(viewer.cookie),notifications);assert.deepEqual(await inbox(ownerCookie,`?taskId=${t.id}`),history);assert.deepEqual(await ok(undefined,viewer.cookie),snapshot);
});

test('fresh membership recheck rejects a read-state request begun before membership removal', async () => {
  const viewer=await member('revoke@example.test','viewer');const b=await board();await task(b,'Revoked',{assigneeIds:[viewer.id]});
  const item=(await inbox(viewer.cookie)).items[0];
  let announceSession, releaseSession;
  const sessionRead=new Promise(resolve=>{announceSession=resolve;});const gate=new Promise(resolve=>{releaseSession=resolve;});
  const delayedAuth={api:{getSession:async args=>{const session=await auth.api.getSession(args);announceSession();await gate;return session;}}};
  const delayed=updatesHttpHandler(pool,delayedAuth,options);
  const pending=delayed(new Request(`${options.baseURL}/api/updates`,{method:'POST',headers:{cookie:viewer.cookie,origin:options.baseURL,'content-type':'application/json'},body:JSON.stringify({action:'setRead',id:item.id,read:true})}));
  await sessionRead;await admin.query('DELETE FROM membership WHERE workspace_id=$1 AND user_id=$2',[workspace,viewer.id]);releaseSession();
  assert.equal((await pending).status,401);
});
