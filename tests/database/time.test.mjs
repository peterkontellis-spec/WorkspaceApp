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
import { timeHttpHandler } from '../../src/server/time-http.mjs';

let local, admin, pool, auth, handle, timeHandle, owner, ownerCookie, workspace;
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
  local = await openLocalCluster(`${await mkdtemp(`${localRoot}tests/time-`)}/postgres`, 55441);
  await local.cluster.start(); await provisionLocalDatabase(local);
  admin = createDatabase(local.adminUrl); await migrate(admin); await grantApplicationAccess(admin);
  pool = createDatabase(local.appUrl); auth = createAuthentication(pool, options); handle = workHttpHandler(pool, auth, options); timeHandle = timeHttpHandler(pool, auth, options);
});
beforeEach(async () => {
  await admin.query('TRUNCATE workspace,app_user,auth_user,auth_rate_limit,auth_verification,invitation_rate_limit CASCADE');
  owner = await createFirstOwner(pool, options, { name: 'Owner', email: 'owner@example.test', password });
  ownerCookie = await login('owner@example.test'); workspace = (await verifiedActor(auth, pool, new Headers({ cookie: ownerCookie }))).workspaceId;
});
after(async () => { await pool?.end(); await admin?.end(); await local?.cluster.stop(); });


const query='?from=2026-01-01&to=2026-01-31&timeZone=Europe%2FAthens';
function time(body, cookie=ownerCookie, q=query, origin=options.baseURL) {
  return timeHandle(new Request(`${options.baseURL}/api/time${q}`,{method:body===undefined?'GET':'POST',headers:{cookie:cookie??'',origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}));
}
async function timeOK(body,cookie,q) {const response=await time(body,cookie,q);assert.equal(response.status,200,await response.clone().text());return response.json();}
const add=(t,extra={})=>({action:'add',creationId:randomUUID(),taskId:t.id,taskRevision:t.revision,workDate:'2026-01-15',durationSeconds:3600,...extra});
const start=(t,extra={})=>({action:'start',creationId:randomUUID(),taskId:t.id,taskRevision:t.revision,...extra});
async function timer(t,from,to,user=owner) {
  return (await admin.query(`INSERT INTO time_entry(workspace_id,task_id,user_id,creation_id,kind,started_at,ended_at) VALUES($1,$2,$3,$4,'timer',$5,$6) RETURNING id`,[workspace,t.id,user,randomUUID(),from,to])).rows[0].id;
}

test('manual entries are shared, exact seconds retained, owner/editor corrections are own-only and viewers read-only',async()=>{
  const b=await board(),t=await task(b),editor=await member('editor@example.test'),viewer=await member('viewer@example.test','viewer');
  const {entry}=await timeOK(add(t,{durationSeconds:3661,notes:' Focus '}),editor.cookie);
  assert.equal(entry.notes,'Focus');assert.equal(entry.durationSeconds,3661);assert.equal(entry.userId,editor.id);
  assert.equal((await timeOK(undefined,viewer.cookie)).summary.totalSeconds,3661);
  assert.equal((await time(add(t),viewer.cookie)).status,403);
  assert.equal((await time({action:'update',id:entry.id,revision:1,patch:{workDate:'2026-01-15',durationSeconds:60}})).status,403);
  const corrected=(await timeOK({action:'update',id:entry.id,revision:1,patch:{workDate:'2026-01-16',durationSeconds:120,notes:'Corrected'}},editor.cookie)).entry;
  assert.equal(corrected.revision,2);assert.equal((await timeOK()).summary.byDate[0].date,'2026-01-16');
  assert.equal((await time({action:'void',id:entry.id,revision:1},editor.cookie)).status,409);
  const voided=(await timeOK({action:'void',id:entry.id,revision:2},editor.cookie)).entry;
  assert.ok(voided.voidedAt);assert.equal((await timeOK()).summary.totalSeconds,0);assert.equal((await timeOK()).entries.length,1);
  await timeOK({action:'restore',id:entry.id,revision:3},editor.cookie);assert.equal((await timeOK()).summary.totalSeconds,120);
  const audit=(await admin.query('SELECT before_state,after_state FROM time_entry_audit WHERE entry_id=$1 ORDER BY created_at',[entry.id])).rows;
  assert.equal(audit.length,3);assert.equal(audit[0].before_state.duration_seconds,3661);
});

test('creation and stop retries are idempotent; concurrent starts produce exactly one running timer',async()=>{
  const b=await board(),t=await task(b);const body=start(t);
  const responses=await Promise.all([time(body),time(body),time(start(t))]);assert.deepEqual(responses.map(x=>x.status).sort(),[200,200,409]);
  const running=(await timeOK()).activeTimer;assert.equal(running.id,(await timeOK(body)).entry.id);assert.equal(running.durationSeconds,null);
  assert.equal((await timeOK()).entries.length,0);assert.equal((await timeOK()).summary.totalSeconds,0);
  const stopped=(await timeOK({action:'stop',id:running.id,revision:1})).entry;
  assert.ok(stopped.endedAt);assert.equal(stopped.revision,2);assert.equal((await timeOK({action:'stop',id:running.id,revision:1})).entry.revision,2);
  assert.equal((await timeOK()).activeTimer,null);
  const manual=add(t);await timeOK(manual);await timeOK(manual);assert.equal((await timeOK()).summary.totalSeconds,3600);
});

test('running timer survives database restart and is independent of the displayed date/task filters',async()=>{
  const b=await board(),t=await task(b),another=await task(b,'Other');const {entry}=await timeOK(start(t));
  await pool.end();await admin.end();await local.cluster.stop();await local.cluster.start();
  admin=createDatabase(local.adminUrl);pool=createDatabase(local.appUrl);auth=createAuthentication(pool,options);handle=workHttpHandler(pool,auth,options);timeHandle=timeHttpHandler(pool,auth,options);
  const fresh=createDatabase(local.appUrl);try{
    const response=await timeHttpHandler(fresh,createAuthentication(fresh,options),options)(new Request(`${options.baseURL}/api/time${query}&taskId=${another.id}`,{headers:{cookie:ownerCookie}}));
    assert.equal(response.status,200);assert.equal((await response.json()).activeTimer.id,entry.id);
  } finally {await fresh.end();}
});

test('real timer intervals split at local midnight and DST days use actual elapsed seconds',async()=>{
  const b=await board(),t=await task(b);
  await timer(t,'2026-01-14T21:30:00Z','2026-01-14T22:30:00Z');
  let data=await timeOK();assert.equal(data.summary.totalSeconds,3600);assert.deepEqual(data.summary.byDate,[{date:'2026-01-14',seconds:1800},{date:'2026-01-15',seconds:1800}]);
  await timer(t,'2026-03-28T22:00:00Z','2026-03-29T21:00:00Z');
  data=await timeOK(undefined,undefined,'?from=2026-03-29&to=2026-03-29&timeZone=Europe%2FAthens');assert.equal(data.summary.totalSeconds,82800);
  await timer(t,'2026-10-24T21:00:00Z','2026-10-25T22:00:00Z');
  data=await timeOK(undefined,undefined,'?from=2026-10-25&to=2026-10-25&timeZone=Europe%2FAthens');assert.equal(data.summary.totalSeconds,90000);
  data=await timeOK(undefined,undefined,'?from=2026-03-29&to=2026-03-29&timeZone=UTC');assert.equal(data.summary.totalSeconds,75600);
});

test('timer corrections replace allocation explicitly while retaining original timestamps and audit',async()=>{
  const b=await board(),t=await task(b);const id=await timer(t,'2026-01-14T21:30:00Z','2026-01-14T22:30:00Z');
  const entry=(await timeOK({action:'update',id,revision:1,patch:{workDate:'2026-01-16',durationSeconds:7201,notes:'Reviewed'}})).entry;
  assert.equal(entry.adjusted,true);assert.equal(entry.originalSeconds,3600);assert.equal(entry.durationSeconds,7201);assert.equal(entry.startedAt,'2026-01-14T21:30:00.000Z');
  assert.deepEqual((await timeOK()).summary.byDate,[{date:'2026-01-16',seconds:7201}]);
  const audit=(await admin.query('SELECT before_state,after_state FROM time_entry_audit WHERE entry_id=$1',[id])).rows[0];assert.equal(audit.before_state.adjusted_seconds,null);assert.equal(audit.after_state.adjusted_seconds,7201);
});

test('task/board archive stops timers atomically, preserves history and rejects fresh writes or stale starts',async()=>{
  const b=await board(),t=await task(b);const running=(await timeOK(start(t))).entry;
  await ok({action:'archiveTask',id:t.id,revision:t.revision});
  let stored=(await admin.query('SELECT * FROM time_entry WHERE id=$1',[running.id])).rows[0];assert.ok(stored.ended_at);assert.equal(stored.stop_reason,'task_archived');
  assert.equal((await time(add(t))).status,409);assert.equal((await time({action:'update',id:running.id,revision:2,patch:{workDate:'2026-01-01',durationSeconds:50}})).status,409);
  assert.equal((await timeOK({action:'stop',id:running.id,revision:1})).entry.stopReason,'task_archived');
  const archived=(await ok()).archivedTasks.find(x=>x.id===t.id);await ok({action:'restoreTask',id:t.id,revision:archived.revision});
  assert.equal((await time(start(t))).status,409);
  const fresh=(await ok()).tasks.find(x=>x.id===t.id);const second=(await timeOK(start(fresh))).entry;
  await ok({action:'archiveBoard',id:b.id,revision:b.revision});stored=(await admin.query('SELECT * FROM time_entry WHERE id=$1',[second.id])).rows[0];assert.equal(stored.stop_reason,'board_archived');assert.ok(stored.ended_at);
});

test('permission loss, membership removal and disabled account stop timers without ghost state',async()=>{
  const b=await board(),t=await task(b),a=await member('a@example.test'),d=await member('d@example.test'),removed=await member('removed@example.test');
  const first=(await timeOK(start(t),a.cookie)).entry;await admin.query("UPDATE membership SET role='viewer' WHERE user_id=$1",[a.id]);
  assert.equal((await timeOK(undefined,a.cookie)).activeTimer,null);assert.equal((await time({action:'stop',id:first.id,revision:1},a.cookie)).status,403);
  const second=(await timeOK(start(t),d.cookie)).entry;await admin.query('UPDATE app_user SET disabled_at=now() WHERE id=$1',[d.id]);assert.equal((await time(undefined,d.cookie)).status,401);
  const third=(await timeOK(start(t),removed.cookie)).entry;await admin.query('DELETE FROM membership WHERE user_id=$1',[removed.id]);assert.equal((await time(undefined,removed.cookie)).status,401);
  const states=(await admin.query('SELECT id,stop_reason,ended_at FROM time_entry WHERE id=ANY($1::uuid[])',[[first.id,second.id,third.id]])).rows;assert.equal(states.length,3);assert.ok(states.every(x=>x.ended_at));assert.deepEqual(states.map(x=>x.stop_reason).sort(),['account_disabled','membership_removed','read_only']);
});

test('history pagination does not truncate totals and date/task filters apply to all summary levels',async()=>{
  const b=await board(),t=await task(b),other=await task(b,'Other');
  for(let i=0;i<53;i++) await timeOK(add(t,{durationSeconds:60}));
  await timeOK(add(other,{durationSeconds:120}));const data=await timeOK();assert.equal(data.entries.length,50);assert.ok(data.nextCursor);assert.equal(data.summary.totalSeconds,3300);
  const next=await timeOK(undefined,undefined,`${query}&cursor=${data.nextCursor}`);assert.equal(next.entries.length,4);assert.equal(next.nextCursor,null);assert.equal(new Set([...data.entries,...next.entries].map(x=>x.id)).size,54);assert.equal(next.summary.totalSeconds,3300);
  const scoped=await timeOK(undefined,undefined,`${query}&taskId=${other.id}`);assert.equal(scoped.summary.totalSeconds,120);assert.equal(scoped.summary.byTask.length,1);assert.equal(scoped.summary.byBoard[0].seconds,120);
});

test('invalid inputs, foreign entries, missing sessions and cross-site requests are rejected',async()=>{
  const b=await board(),t=await task(b),otherWorkspace=(await admin.query("INSERT INTO workspace(name) VALUES('Other') RETURNING id")).rows[0].id, outsider=await member('outsider@example.test','editor',otherWorkspace);
  const {entry}=await timeOK(add(t));assert.equal((await time({action:'void',id:entry.id,revision:1},outsider.cookie)).status,404);assert.equal((await time(add(t),outsider.cookie)).status,404);assert.equal((await timeOK(undefined,outsider.cookie)).entries.length,0);
  assert.equal((await time(undefined,'')).status,401);assert.equal((await time(add(t),undefined,query,'https://wrong.example')).status,403);
  for(const patch of [{durationSeconds:0},{durationSeconds:86401},{durationSeconds:1.5},{workDate:'2026-02-30'},{notes:'x'.repeat(2001)},{taskRevision:0},{userId:owner}]) assert.equal((await time(add(t,patch))).status,400);
  for(const q of ['?from=2026-01-01&to=2026-12-31&timeZone=UTC','?from=2026-01-02&to=2026-01-01&timeZone=UTC','?from=2026-01-01&to=2026-01-02&timeZone=NotAZone',`${query}&cursor=broken`]) assert.equal((await time(undefined,undefined,q)).status,400);
});

test('uncertain manual creation retries reject changed payloads and entries corrected since creation',async()=>{
  const b=await board(),t=await task(b),body=add(t,{notes:'Original'});
  const saved=(await timeOK(body)).entry;assert.equal((await timeOK({...body,notes:' Original '})).entry.id,saved.id);
  for(const patch of [{durationSeconds:600},{workDate:'2026-01-16'},{notes:'Revised'}]) {
    const response=await time({...body,...patch});assert.equal(response.status,409);assert.equal((await response.json()).conflict,true);
  }
  assert.equal((await timeOK()).entries.length,1);assert.equal((await timeOK()).entries[0].durationSeconds,3600);
  await timeOK({action:'update',id:saved.id,revision:1,patch:{workDate:'2026-01-15',durationSeconds:3600,notes:'Original'}});
  assert.equal((await time(body)).status,409);assert.equal((await timeOK()).entries[0].revision,2);
});

test('HTTP boundary rejects unsupported methods, origins, media types, malformed and oversized bodies',async()=>{
  const call=(method='POST',body='{}',extra={},path='/api/time')=>timeHandle(new Request(`${options.baseURL}${path}${query}`,{method,headers:{cookie:ownerCookie,origin:options.baseURL,'content-type':'application/json',...extra},...(body===undefined||method==='GET'?{}:{body})}));
  for(const method of ['PUT','PATCH','DELETE','OPTIONS']) assert.equal((await call(method)).status,405);
  assert.equal((await call('GET',undefined,{},'/api/missing')).status,404);
  for(const extra of [{origin:''},{origin:'https://other.example'},{'sec-fetch-site':'cross-site'}]) assert.equal((await call('POST','{}',extra)).status,403);
  assert.equal((await call('POST','{}',{'content-type':'text/plain'})).status,415);
  for(const body of ['', '{broken', 'null','[]','1','"text"']) assert.equal((await call('POST',body)).status,400);
  assert.equal((await call('POST',JSON.stringify({notes:'a'.repeat(17000)}))).status,413);
  const response=await call('GET');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');
});

test('time API rejects missing and expired sessions and hides unexpected service failure details',async()=>{
  const b=await board(),t=await task(b),editor=await member('expired@example.test');
  assert.equal((await time(add(t),'')).status,401);
  await admin.query(`UPDATE auth_session SET "updatedAt"=now()-interval '31 minutes' WHERE "userId"=$1`,[editor.id]);
  assert.equal((await time(undefined,editor.cookie)).status,401);assert.equal((await time(add(t),editor.cookie)).status,401);
  const unavailable=timeHttpHandler({connect:async()=>{throw new Error('private database diagnostic');}},auth,options);
  const response=await unavailable(new Request(`${options.baseURL}/api/time${query}`,{headers:{cookie:ownerCookie}}));assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Time service unavailable. Try again shortly.'});assert.equal(response.headers.get('cache-control'),'no-store');
});

test('work snapshot exposes only the current actor timer and stops reporting it on permission loss',async()=>{
  const b=await board(),t=await task(b),editor=await member('snapshot@example.test');
  const timer=(await timeOK(start(t),editor.cookie)).entry;
  assert.equal((await ok(undefined,editor.cookie)).activeTimer.id,timer.id);assert.equal((await ok()).activeTimer,null);assert.ok(Number.isFinite(Date.parse((await ok()).serverNow)));
  await admin.query("UPDATE membership SET role='viewer' WHERE user_id=$1",[editor.id]);assert.equal((await ok(undefined,editor.cookie)).activeTimer,null);
});

test('a start racing an operator disable cannot leave a running timer behind',async()=>{
  const b=await board(),t=await task(b),editor=await member('disable-race@example.test'),operator=await admin.connect();
  let pending;
  try {
    await operator.query('BEGIN');await operator.query('UPDATE app_user SET disabled_at=now() WHERE id=$1',[editor.id]);
    pending=time(start(t),editor.cookie);
    let blocked=false;
    for(let attempt=0;attempt<100;attempt++) {
      blocked=(await admin.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND query LIKE 'SELECT id FROM app_user WHERE id=%FOR SHARE' AND wait_event_type='Lock'`)).rowCount>0;
      if(blocked) break;await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(blocked,true,'start must wait for the concurrent disable row lock');
    await operator.query('COMMIT');assert.equal((await pending).status,401);
    assert.equal((await admin.query('SELECT count(*)::int n FROM time_entry WHERE user_id=$1',[editor.id])).rows[0].n,0);
  } finally {await operator.query('ROLLBACK');operator.release();await pending;}
});
