import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, unlink, symlink, writeFile, chmod } from 'node:fs/promises';
import { localRoot, openLocalCluster, provisionLocalDatabase, grantApplicationAccess } from '../../scripts/db/local.mjs';
import { createDatabase } from '../../src/server/database.mjs';
import { migrate } from '../../scripts/db/migrate.mjs';
import { createAuthentication, verifiedActor } from '../../src/server/auth-core.mjs';
import { createFirstOwner } from '../../src/server/account-operator.mjs';
import { authHttpHandler } from '../../src/server/auth-http.mjs';
import { filesHttpHandler } from '../../src/server/files-http.mjs';
import { ATTACHMENT_MAX_BYTES } from '../../src/lib/attachment-policy.mjs';
let local, admin, pool, auth, handle, ownerCookie, workspace, taskId, directory;
const options = { secret: randomBytes(48).toString('hex'), baseURL: 'http://127.0.0.1:3100' };
const password = 'Disposable files test password 123!';
const cookies = res => res.headers.getSetCookie().map(x => x.split(';')[0]).join('; ');
async function login(email) {
  const res = await authHttpHandler(auth, pool, options.baseURL)(new Request(`${options.baseURL}/api/auth/sign-in/email`, { method: 'POST', headers: { origin: options.baseURL, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) }));
  assert.equal(res.status, 200, await res.clone().text()); return cookies(res);
}
async function member(email, role = 'editor', inWorkspace = workspace) {
  const id = (await createAuthentication(pool, { ...options, allowSignup: true }).api.signUpEmail({ body: { name: email, email, password } })).user.id;
  await admin.query('INSERT INTO membership(workspace_id,user_id,role) VALUES($1,$2,$3)', [inWorkspace,id,role]); return { id, cookie: await login(email) };
}
function upload(body = 'Hello', name = 'hello.txt', extras = {}) {
  const headers = { origin: options.baseURL, 'content-type': 'application/octet-stream', 'x-upload-name': encodeURIComponent(name), cookie: ownerCookie, ...extras.headers };
  return new Request(`${options.baseURL}/api/files?taskId=${extras.taskId ?? taskId}`, { method: 'POST', headers, body, duplex: 'half', ...(extras.signal ? { signal: extras.signal } : {}) });
}
function get(suffix = '', cookie = ownerCookie) { return handle(new Request(`${options.baseURL}/api/files${suffix}`, { headers: { cookie } })); }
async function saved(body, name, extra) { const response = await handle(upload(body, name, extra)); assert.equal(response.status, 201, await response.clone().text()); return (await response.json()).file; }
async function expectEmpty() { assert.equal((await admin.query('SELECT count(*)::int AS n FROM attachment')).rows[0].n, 0); assert.deepEqual(await readdir(options.storageRoot), []); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitTemp(count = 1) { for (let i = 0; i < 100; i++) { if ((await readdir(options.storageRoot)).filter(x => x.endsWith('.upload')).length >= count) return; await sleep(10); } throw new Error('Upload did not start'); }
before(async () => {
  await mkdir(`${localRoot}tests`, { recursive: true }); directory = await mkdtemp(`${localRoot}tests/files-`);
  local = await openLocalCluster(`${directory}/postgres`, 55437); await local.cluster.start(); await provisionLocalDatabase(local);
  admin = createDatabase(local.adminUrl); await migrate(admin); await grantApplicationAccess(admin);
  pool = createDatabase(local.appUrl); auth = createAuthentication(pool, options);
});
beforeEach(async () => {
  await admin.query('TRUNCATE workspace,app_user,auth_user,auth_rate_limit,auth_verification,invitation_rate_limit CASCADE');
  await createFirstOwner(pool, options, { name: 'Owner', email: 'owner@example.test', password }); ownerCookie = await login('owner@example.test'); workspace = (await verifiedActor(auth, pool, new Headers({ cookie: ownerCookie }))).workspaceId;
  const board = (await admin.query("INSERT INTO board(workspace_id,name) VALUES($1,'Files') RETURNING id", [workspace])).rows[0].id;
  const group = (await admin.query("INSERT INTO board_group(workspace_id,board_id,name) VALUES($1,$2,'Tasks') RETURNING id", [workspace,board])).rows[0].id;
  taskId = (await admin.query("INSERT INTO task(workspace_id,board_id,group_id,title) VALUES($1,$2,$3,'File task') RETURNING id", [workspace,board,group])).rows[0].id;
  options.storageRoot = await mkdtemp(`${directory}/storage-`); handle = filesHttpHandler(pool, auth, options);
});
after(async () => { await pool?.end(); await admin?.end(); await local?.cluster.stop(); });

test('every supported type persists, downloads exactly and sends attachment safety headers', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA54AAAAASUVORK5CYII=', 'base64');
  const values = [['sample.pdf', Buffer.from('%PDF-1.7\n% sample\n%%EOF\n')], ['photo.png',png], ['photo.jpg',Buffer.from([255,216,255,224,0,2,255,217])], ['photo.jpeg',Buffer.from([255,216,255,224,0,2,255,217])], ['Εργασία.txt',Buffer.from('Hello κόσμος\n')], ['notes.md',Buffer.from('# Heading\n<script>plain text</script>')], ['rows.csv',Buffer.from('name,value\nhello,2')]];
  for (const [name,bytes] of values) {
    const file = await saved(bytes,name); assert.equal(file.originalName,name); assert.equal(file.byteSize,bytes.length); assert.equal(file.taskId,taskId);
    const response = await get(`/${file.id}`); assert.equal(response.status,200); assert.equal(response.headers.get('content-type'),'application/octet-stream'); assert.equal(response.headers.get('x-content-type-options'),'nosniff'); assert.equal(response.headers.get('cache-control'),'no-store'); assert.match(response.headers.get('content-disposition'), /^attachment;.*filename\*=UTF-8''/); assert.match(response.headers.get('content-security-policy'), /sandbox/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  }
  assert.equal((await (await get()).json()).files.length,7);
  assert.equal((await (await get(`?taskId=${taskId}`)).json()).files.length,7);
  await pool.end(); await admin.end(); await local.cluster.stop(); await local.cluster.start(); admin = createDatabase(local.adminUrl); pool = createDatabase(local.appUrl); auth = createAuthentication(pool,options); handle = filesHttpHandler(pool,auth,options);
  const afterRestart = await (await get()).json(); assert.equal(afterRestart.files.length,7); const restored = await get(`/${afterRestart.files[0].id}`); assert.equal(restored.status,200); await restored.body.cancel();
});

test('owner/editor uploads, viewer reads, outsiders and missing/revoked/expired sessions cannot cross boundaries', async () => {
  const editor = await member('editor@example.test'), viewer = await member('viewer@example.test','viewer');
  const other = (await admin.query("INSERT INTO workspace(name) VALUES('Other') RETURNING id")).rows[0].id, outsider = await member('outside@example.test','owner',other);
  const file = await saved('Editor file','editor.txt',{headers:{cookie:editor.cookie}});
  const viewed = await get(`/${file.id}`,viewer.cookie); assert.equal(viewed.status,200); await viewed.body.cancel();
  assert.equal((await handle(upload('No','no.txt',{headers:{cookie:viewer.cookie}}))).status,403);
  assert.equal((await get(`/${file.id}`,outsider.cookie)).status,404);
  assert.equal((await get(`?taskId=${taskId}`,outsider.cookie)).status,404);
  assert.deepEqual((await (await get('',outsider.cookie)).json()).files,[]);
  assert.equal((await handle(upload('No','no.txt',{headers:{cookie:outsider.cookie}}))).status,404);
  assert.equal((await get('','')).status,401); assert.equal((await get('/'+file.id,'workspace.session_token=forged')).status,401);
  await admin.query('DELETE FROM membership WHERE user_id=$1',[viewer.id]); assert.equal((await get('',viewer.cookie)).status,401);
  await admin.query('UPDATE auth_session SET "expiresAt"=now()-interval \'1 minute\' WHERE "userId"=$1',[editor.id]); assert.equal((await get('',editor.cookie)).status,401);
});

test('origin, raw transport, filenames, invalid identifiers and unsupported content are rejected without files', async () => {
  assert.equal((await handle(upload('x','a.txt',{headers:{origin:'https://evil.example'}}))).status,403);
  assert.equal((await handle(upload('x','a.txt',{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
  assert.equal((await handle(upload('x','a.txt',{headers:{'content-type':'text/plain'}}))).status,415);
  for (const name of ['../a.txt','a/b.txt','a\\b.txt','.txt','a..txt','a.txt\r\nX: a','script.html','a.exe','a\u202etxt.txt','a:evil.txt','a?.txt']) assert.equal((await handle(upload('x',name))).status,415,name);
  assert.equal((await handle(upload('x','a.txt',{headers:{'x-upload-name':'%XX'}}))).status,400);
  assert.equal((await handle(upload('x','a.txt',{taskId:'bad'}))).status,400);
  assert.equal((await get('/bad')).status,400);
  for (const name of ['a.pdf','a.png','a.jpg']) assert.equal((await handle(upload('not an image',name))).status,415);
  for (const body of [Buffer.from([0xff]),Buffer.from([0xc3]),Buffer.from([65,0,66]),Buffer.from([65,27,66])]) assert.equal((await handle(upload(body))).status,415);
  await expectEmpty();
});

test('empty, incomplete, declared and actual oversize streams fail with no rows or blobs', async () => {
  assert.equal((await handle(upload(''))).status,400);
  assert.equal((await handle(upload('small','a.txt',{headers:{'content-length':String(ATTACHMENT_MAX_BYTES+1)}}))).status,413);
  assert.equal((await handle(upload('small','a.txt',{headers:{'content-length':'3'}}))).status,400);
  assert.equal((await handle(upload('small','a.txt',{headers:{'content-length':'-1'}}))).status,400);
  let remaining = ATTACHMENT_MAX_BYTES+1;
  const stream = new ReadableStream({pull(controller) { const count = Math.min(remaining,65536); if (!count) return controller.close(); remaining-=count; controller.enqueue(new Uint8Array(count).fill(65)); }});
  assert.equal((await handle(upload(stream))).status,413); await expectEmpty();
});

test('broken, idle, total-deadline and aborted streams release upload slots and clean temporary files', async () => {
  const broken = new ReadableStream({start(controller) { controller.enqueue(new TextEncoder().encode('Partial')); controller.error(new Error('Disconnected')); }});
  assert.equal((await handle(upload(broken))).status,503); await expectEmpty();
  const timed = filesHttpHandler(pool,auth,{...options,idleTimeoutMs:20,uploadTimeoutMs:100});
  assert.equal((await timed(upload(new ReadableStream({start(controller) { controller.enqueue(new TextEncoder().encode('Partial')); }})))).status,408); await expectEmpty();
  const total = filesHttpHandler(pool,auth,{...options,idleTimeoutMs:100,uploadTimeoutMs:35});
  let interval;
  const trickle = new ReadableStream({start(controller) { interval=setInterval(()=>controller.enqueue(new TextEncoder().encode('x')),5); },cancel() { clearInterval(interval); }});
  assert.equal((await total(upload(trickle))).status,408); await expectEmpty();
  const abort = new AbortController();
  const pending = handle(upload(new ReadableStream({start(controller) { controller.enqueue(new TextEncoder().encode('Partial')); }}),'a.txt',{signal:abort.signal}));
  await waitTemp(); abort.abort(); assert.equal((await pending).status,400); await expectEmpty();
  assert.equal((await handle(upload())).status,201);
});

test('membership revocation during streaming is rechecked before commit and does not occupy a DB connection', async () => {
  const editor = await member('revoked@example.test'); let controller;
  const pending = handle(upload(new ReadableStream({start(c) { controller=c; c.enqueue(new TextEncoder().encode('Partial')); }}),'a.txt',{headers:{cookie:editor.cookie}}));
  await waitTemp(); assert.equal(pool.totalCount,pool.idleCount);
  await admin.query('DELETE FROM membership WHERE user_id=$1',[editor.id]); controller.close(); assert.equal((await pending).status,401); await expectEmpty();
});

test('two concurrent streams are allowed without a queue and a third receives 429', async () => {
  const controls=[]; const stream=()=>new ReadableStream({start(c) {controls.push(c); c.enqueue(new TextEncoder().encode('x')); }});
  const first=handle(upload(stream())), second=handle(upload(stream())); await waitTemp(2);
  assert.equal((await handle(upload())).status,429);
  controls.forEach(c=>c.close()); assert.equal((await first).status,201); assert.equal((await second).status,201); assert.equal((await handle(upload())).status,201);
});

test('missing blobs, symbolic links and unsafe storage roots are never served', async () => {
  const file=await saved('Original'); const key=(await admin.query('SELECT storage_key FROM attachment WHERE id=$1',[file.id])).rows[0].storage_key;
  const target=`${options.storageRoot}/${key}`; await unlink(target); assert.equal((await get('/'+file.id)).status,503);
  const secret=`${directory}/${randomUUID()}.txt`; await writeFile(secret,'Unrelated secret',{mode:0o600}); await symlink(secret,target); assert.equal((await get('/'+file.id)).status,503);
  await unlink(target); await writeFile(target,'Original',{mode:0o644}); await chmod(target,0o644); assert.equal((await get('/'+file.id)).status,503);
  const linked=`${directory}/${randomUUID()}`; await symlink(options.storageRoot,linked); const unsafe=filesHttpHandler(pool,auth,{...options,storageRoot:linked}); assert.equal((await unsafe(upload())).status,503);
  assert.equal((await filesHttpHandler(pool,auth,{...options,storageRoot:'relative'})(upload())).status,503);
  assert.equal(await readFile(secret,'utf8'),'Unrelated secret');
});


test('exact size boundary, split UTF-8 and failed metadata insert retain only completed records', async () => {
  let remaining=ATTACHMENT_MAX_BYTES;
  const body = new ReadableStream({pull(c) { if (!remaining) return c.close(); const count=Math.min(65536,remaining); remaining-=count; c.enqueue(new Uint8Array(count).fill(65)); }});
  const large=await saved(body,'limit.txt',{headers:{'content-length':String(ATTACHMENT_MAX_BYTES)}});
  assert.equal(large.byteSize,ATTACHMENT_MAX_BYTES);
  const download=await get('/'+large.id); assert.equal(download.status,200); await download.body.cancel();
  const utf8=new ReadableStream({start(c) { c.enqueue(new Uint8Array([0xce])); c.enqueue(new Uint8Array([0xba])); c.close(); }});
  const unicode=await saved(utf8,'split.txt'); assert.equal(await (await get('/'+unicode.id)).text(),'κ');
  const beforeFiles=await readdir(options.storageRoot);
  await admin.query('REVOKE INSERT ON attachment FROM workspace_app');
  try { assert.equal((await handle(upload('Database refuses this'))).status,503); }
  finally { await grantApplicationAccess(admin); }
  assert.deepEqual((await readdir(options.storageRoot)).sort(),beforeFiles.sort());
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM attachment')).rows[0].n,2);
});


test('a COMMIT applied before a lost acknowledgement preserves the committed file', async () => {
  let injected = false;
  const uncertainPool = {
    async connect() {
      const connection = await pool.connect(); let insertedAttachment = false;
      return {
        async query(sql, parameters) {
          const result = await connection.query(sql, parameters);
          if (typeof sql === 'string' && sql.startsWith('INSERT INTO attachment(')) insertedAttachment = true;
          if (sql === 'COMMIT' && insertedAttachment && !injected) {
            injected = true;
            throw new Error('Simulated connection loss after COMMIT was applied');
          }
          return result;
        },
        release() { connection.release(); },
      };
    },
  };
  const uncertain = filesHttpHandler(uncertainPool, auth, options);
  const response = await uncertain(upload('Committed bytes', 'uncertain.txt'));
  assert.equal(response.status,503); assert.equal(injected,true);
  const { files } = await (await get()).json(); assert.equal(files.length,1);
  assert.equal(files[0].originalName,'uncertain.txt');
  assert.equal(await (await get('/'+files[0].id)).text(),'Committed bytes');
  assert.equal((await readdir(options.storageRoot)).length,1);
});
