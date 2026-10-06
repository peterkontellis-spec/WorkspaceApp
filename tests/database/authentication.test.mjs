import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { localRoot, openLocalCluster, provisionLocalDatabase, grantApplicationAccess } from '../../scripts/db/local.mjs';
import { createDatabase } from '../../src/server/database.mjs';
import { migrate } from '../../scripts/db/migrate.mjs';
import { createAuthentication, verifiedActor } from '../../src/server/auth-core.mjs';
import { authHttpHandler } from '../../src/server/auth-http.mjs';
import { createFirstOwner, issueRecovery, revokeAccountSessions } from '../../src/server/account-operator.mjs';

let local, admin, pool, auth, handle, userId;
const options = { secret: randomBytes(48).toString('hex'), baseURL: 'http://127.0.0.1:3100' };
const email = 'owner@example.test';
const password = 'Correct fictional password 123!';
function request(action, body, cookie = '', origin = options.baseURL) {
  return handle(new Request(`${options.baseURL}/api/auth/${action}`, { method: 'POST', headers: { origin, 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }));
}
const cookieFrom = (res) => res.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');
const actor = (cookie) => verifiedActor(auth, pool, new Headers({ cookie }));
async function login(pass = password) {
  const res = await request('sign-in/email', { email, password: pass });
  assert.equal(res.status, 200, await res.clone().text());
  return cookieFrom(res);
}
before(async () => {
  await mkdir(`${localRoot}tests`, { recursive: true });
  local = await openLocalCluster(`${await mkdtemp(`${localRoot}tests/auth-`)}/postgres`, 55434);
  await local.cluster.start(); await provisionLocalDatabase(local);
  admin = createDatabase(local.adminUrl); await migrate(admin); await grantApplicationAccess(admin);
  pool = createDatabase(local.appUrl); auth = createAuthentication(pool, options); handle = authHttpHandler(auth, pool, options.baseURL);
});
beforeEach(async () => { await admin.query('DELETE FROM auth_rate_limit'); });
after(async () => { await pool?.end(); await admin?.end(); await local?.cluster.stop(); });

test('operator creates the first owner once, binds the real identity and stores a password hash', async () => {
  await admin.query(`CREATE FUNCTION fail_test_owner() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test membership failure'; END; $$;
    CREATE TRIGGER test_owner_failure BEFORE INSERT ON membership FOR EACH ROW EXECUTE FUNCTION fail_test_owner()`);
  await assert.rejects(createFirstOwner(pool, options, { name: 'Test Owner', email, password }), /test membership failure/);
  assert.equal((await admin.query('SELECT count(*)::int AS count FROM auth_user')).rows[0].count, 0);
  await admin.query('DROP TRIGGER test_owner_failure ON membership; DROP FUNCTION fail_test_owner()');
  userId = await createFirstOwner(pool, options, { name: 'Test Owner', email, password });
  await assert.rejects(createFirstOwner(pool, options, { name: 'Another Owner', email: 'other@example.test', password }), /already set up/);
  const saved = (await admin.query('SELECT password FROM auth_account WHERE "userId"=$1', [userId])).rows[0].password;
  assert.notEqual(saved, password); assert.ok(saved.length > 64); assert.ok(!saved.includes(password));
  const cookie = await login(); const who = await actor(cookie);
  assert.equal(who.id, userId); assert.equal(who.role, 'owner'); assert.equal(who.email, email);
});

test('no public registration, recovery issuance or sensitive library routes are exposed', async () => {
  for (const path of ['sign-up/email', 'request-password-reset', 'list-sessions', 'update-user', 'get-session']) {
    assert.equal((await request(path, { email, password, name: 'Bad' })).status, 404);
  }
  await assert.rejects(auth.api.signUpEmail({ body: { email: 'blocked@example.test', password, name: 'Blocked' } }));
  assert.equal(await actor('workspace.session_token=forged'), null);
  assert.equal(await actor(''), null);
});

test('login has a new HttpOnly host-only SameSite cookie, hides raw tokens and rejects invalid credentials/origins', async () => {
  const res = await request('sign-in/email', { email, password });
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), { ok: true });
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const set = res.headers.getSetCookie().join(';');
  assert.match(set, /HttpOnly/i); assert.match(set, /SameSite=Lax/i); assert.doesNotMatch(set, /Domain=/i);
  assert.notEqual(cookieFrom(res), await login());
  assert.equal((await request('sign-in/email', { email, password: 'wrong' })).status, 401);
  assert.equal((await request('sign-in/email', { email, password }, '', 'https://attacker.test')).status, 403);
  assert.equal((await request('sign-in/email', { email, password }, '', '')).status, 403);
  const secure = createAuthentication(pool, { ...options, baseURL: 'https://workspace.example.test' });
  const secureHandler = authHttpHandler(secure,pool,'https://workspace.example.test');
  const secureRes = await secureHandler(new Request('https://workspace.example.test/api/auth/sign-in/email', { method:'POST',headers:{origin:'https://workspace.example.test','content-type':'application/json'},body:JSON.stringify({email,password}) }));
  assert.equal(secureRes.status,200); assert.match(secureRes.headers.getSetCookie().join(';'),/; Secure/i);
});

test('logout, absolute expiry and idle expiry reject the captured session', async () => {
  let cookie = await login(); assert.ok(await actor(cookie));
  assert.equal((await request('sign-out', {}, cookie)).status, 200); assert.equal(await actor(cookie),null);
  cookie = await login(); await admin.query('UPDATE auth_session SET "expiresAt"=now()-interval \'1 second\' WHERE "userId"=$1',[userId]); assert.equal(await actor(cookie),null);
  cookie = await login(); await admin.query('UPDATE auth_session SET "updatedAt"=now()-interval \'31 minutes\' WHERE "userId"=$1',[userId]); assert.equal(await actor(cookie),null);
  cookie = await login();
  await admin.query('UPDATE auth_session SET "updatedAt"=now()-interval \'10 minutes\' WHERE "userId"=$1',[userId]);
  const currentSession=(await auth.api.getSession({headers:new Headers({cookie})})).session.id;
  const oldTime=(await admin.query('SELECT "updatedAt" FROM auth_session WHERE id=$1',[currentSession])).rows[0].updatedAt;
  await actor(cookie);
  assert.equal((await admin.query('SELECT "updatedAt" FROM auth_session WHERE id=$1',[currentSession])).rows[0].updatedAt.getTime(),oldTime.getTime());
  await verifiedActor(auth,pool,new Headers({cookie}),{touch:true});
  assert.ok((await admin.query('SELECT "updatedAt" FROM auth_session WHERE id=$1',[currentSession])).rows[0].updatedAt.getTime()>oldTime.getTime());
  await admin.query('DELETE FROM auth_rate_limit');
});

test('membership removal and operator revocation deny existing sessions; sessions survive a real database restart', async () => {
  const cookie = await login(); const who = await actor(cookie);
  await pool.end();pool=null;await admin.end();admin=null;await local.cluster.stop();await local.cluster.start();
  admin=createDatabase(local.adminUrl);pool=createDatabase(local.appUrl);auth=createAuthentication(pool,options);handle=authHttpHandler(auth,pool,options.baseURL);
  assert.equal((await actor(cookie)).id,userId);
  await revokeAccountSessions(pool,email);assert.equal(await actor(cookie),null);
  const next = await login();await admin.query('DELETE FROM membership WHERE user_id=$1',[userId]);assert.equal(await actor(next),null);
  await admin.query("INSERT INTO membership(workspace_id,user_id,role) VALUES($1,$2,'owner')",[who.workspaceId,userId]);
});

test('recovery links expire, use hashed identifiers, work once under concurrent requests and revoke old sessions', async () => {
  await admin.query('DELETE FROM auth_rate_limit');
  const oldCookie=await login();
  const expired=new URL(await issueRecovery(pool,options,email)).searchParams.get('token');
  await admin.query('UPDATE auth_verification SET "expiresAt"=now()-interval \'1 second\'');
  assert.equal((await request('reset-password',{token:expired,newPassword:'Unused replacement password'})).status,400);
  const token=new URL(await issueRecovery(pool,options,email)).searchParams.get('token');
  const identifiers=(await admin.query('SELECT identifier FROM auth_verification')).rows.map(x=>x.identifier);
  assert.ok(identifiers.every(x=>!x.includes(token)));
  const newPassword='A new fictional password 456!';
  const results=await Promise.all([request('reset-password',{token,newPassword}),request('reset-password',{token,newPassword})]);
  assert.deepEqual(results.map(x=>x.status).sort(),[200,400]);
  assert.equal(await actor(oldCookie),null);
  assert.equal((await request('sign-in/email',{email,password})).status,401);
  assert.ok(await actor(await login(newPassword)));
  assert.equal((await request('reset-password',{token,newPassword})).status,400);
  const newer=new URL(await issueRecovery(pool,options,email)).searchParams.get('token');
  await request('reset-password',{token:newer,newPassword:password});
});

test('reissuing recovery invalidates the previous link and disabling an account cannot be undone by recovery', async () => {
  const first=new URL(await issueRecovery(pool,options,email)).searchParams.get('token');
  const second=new URL(await issueRecovery(pool,options,email)).searchParams.get('token');
  assert.equal((await request('reset-password',{token:first,newPassword:password})).status,400);
  const cookie=await login();await revokeAccountSessions(pool,email,true);
  assert.equal(await actor(cookie),null);
  assert.equal((await request('sign-in/email',{email,password})).status,403);
  assert.equal((await request('reset-password',{token:second,newPassword:password})).status,400);
  await assert.rejects(issueRecovery(pool,options,email),/No active/);
  await admin.query('UPDATE app_user SET disabled_at=null WHERE auth_user_id=$1',[userId]);
});

test('oversized bodies are bounded and login rate limiting persists in the database', async () => {
  assert.equal((await request('sign-in/email',{email,password:'x'.repeat(9000)})).status,413);
  await admin.query('DELETE FROM auth_rate_limit');
  let final;
  for(let i=0;i<12;i++) final=await request('sign-in/email',{email:'invalid',password:'bad'});
  assert.equal(final.status,429);assert.ok((await admin.query('SELECT count(*) FROM auth_rate_limit')).rows[0].count > 0);
});
