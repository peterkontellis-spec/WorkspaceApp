import assert from 'node:assert/strict';
import { before,beforeEach,after,test } from 'node:test';
import { randomBytes,createHash } from 'node:crypto';
import { mkdir,mkdtemp } from 'node:fs/promises';
import { localRoot,openLocalCluster,provisionLocalDatabase,grantApplicationAccess } from '../../scripts/db/local.mjs';
import { createDatabase } from '../../src/server/database.mjs';
import { migrate } from '../../scripts/db/migrate.mjs';
import { createAuthentication,verifiedActor } from '../../src/server/auth-core.mjs';
import { createFirstOwner,issueRecovery } from '../../src/server/account-operator.mjs';
import { authHttpHandler } from '../../src/server/auth-http.mjs';
import { membershipHttpHandler } from '../../src/server/membership-http.mjs';

let local,admin,pool,auth,handle,owner,ownerCookie,workspace;
const options={secret:randomBytes(48).toString('hex'),baseURL:'http://127.0.0.1:3100'};
const password='Disposable invitation password 123!';
const cookies=res=>res.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
const req=(path,body,cookie=ownerCookie,origin=options.baseURL)=>handle(new Request(`${options.baseURL}${path}`,{method:body===undefined?'GET':'POST',headers:{origin,'content-type':'application/json',cookie:cookie??''},...(body===undefined?{}:{body:JSON.stringify(body)})}));
const team=(body,cookie)=>req('/api/team',body,cookie);
const accept=(token,extra={},cookie='')=>req('/api/invitations',{token,name:'Invited Person',password,...extra},cookie);
async function invite(email='invite@example.test',role='editor') {
  const res=await team({action:'invite',email,role});assert.equal(res.status,200,await res.clone().text());
  const data=await res.json();return {token:new URL(data.link).searchParams.get('token'),id:data.invitations.find(x=>x.email===email).id};
}
async function login(email) {
  const res=await authHttpHandler(auth,pool,options.baseURL)(new Request(`${options.baseURL}/api/auth/sign-in/email`,{method:'POST',headers:{origin:options.baseURL,'content-type':'application/json'},body:JSON.stringify({email,password})}));
  assert.equal(res.status,200,await res.clone().text());return cookies(res);
}
async function member(email,role='editor') {
  const {token}=await invite(email,role);assert.equal((await accept(token)).status,200);
  const cookie=await login(email); const actor=await verifiedActor(auth,pool,new Headers({cookie}));return {...actor,cookie};
}
before(async()=>{
  await mkdir(`${localRoot}tests`,{recursive:true});
  local=await openLocalCluster(`${await mkdtemp(`${localRoot}tests/membership-`)}/postgres`,55435);
  await local.cluster.start();await provisionLocalDatabase(local);
  admin=createDatabase(local.adminUrl);await migrate(admin);await grantApplicationAccess(admin);
  pool=createDatabase(local.appUrl);auth=createAuthentication(pool,options);handle=membershipHttpHandler(pool,auth,options);
});
beforeEach(async()=>{
  await admin.query('TRUNCATE workspace,app_user,auth_user,auth_rate_limit,auth_verification,invitation_rate_limit CASCADE');
  owner=await createFirstOwner(pool,options,{name:'Owner',email:'owner@example.test',password});
  ownerCookie=await login('owner@example.test');workspace=(await verifiedActor(auth,pool,new Headers({cookie:ownerCookie}))).workspaceId;
});
after(async()=>{await pool?.end();await admin?.end();await local?.cluster.stop();});

test('real cookie identity, owner/editor/viewer matrix, forged identities and workspace boundaries',async()=>{
  const editor=await member('editor@example.test');const viewer=await member('viewer@example.test','viewer');
  assert.equal((await team(undefined,'')).status,401);
  assert.equal((await team({action:'invite',email:'bad@example.test',role:'owner',actorId:owner,workspaceId:workspace},'workspace.session_token=forged')).status,401);
  for(const user of [editor,viewer]) {
    const res=await team(undefined,user.cookie);assert.equal(res.status,200);const data=await res.json();
    assert.equal(data.members.length,3);assert.equal(data.canManage,false);assert.deepEqual(data.invitations,[]);
    for(const body of [{action:'invite',email:'bad@example.test',role:'owner'},{action:'role',id:owner,role:'viewer'},{action:'remove',id:owner},{action:'revoke',id:randomBytes(16).toString('hex')}]) assert.equal((await team({...body,actorId:owner,workspaceId:workspace},user.cookie)).status,403);
  }
  const other=(await admin.query("INSERT INTO workspace(name) VALUES('Other workspace') RETURNING id")).rows[0].id;
  const outsider=(await createAuthentication(pool,{...options,allowSignup:true}).api.signUpEmail({body:{name:'Other owner',email:'other@example.test',password}})).user.id;
  await admin.query("INSERT INTO membership(workspace_id,user_id,role) VALUES($1,$2,'owner')",[other,outsider]);
  assert.equal((await team({action:'remove',id:outsider,workspaceId:other})).status,404);
  const own=(await (await team({action:'invite',email:'scoped@example.test',role:'viewer',workspaceId:other})).json()).invitations[0];
  assert.equal((await admin.query('SELECT workspace_id FROM workspace_invitation WHERE id=$1',[own.id])).rows[0].workspace_id,workspace);
});

test('JSON mutations enforce same origin, bounded bodies, safe validation and no-store errors',async()=>{
  const body={action:'invite',email:'invite@example.test',role:'editor'};
  for(const origin of ['', 'https://attacker.example']) assert.equal((await req('/api/team',body,ownerCookie,origin)).status,403);
  assert.equal((await req('/api/invitations',{token:'fake'},'', 'https://attacker.example')).status,403);
  assert.equal((await team({...body,email:'x'.repeat(9000)})).status,413);
  assert.equal((await team({...body,role:'admin'})).status,400);
  assert.equal((await team({action:'revoke',id:'-'.repeat(36)})).status,400);
  assert.equal((await team({...body,email:'not-email'})).status,400);
  const malformed=await handle(new Request(`${options.baseURL}/api/team`,{method:'POST',headers:{origin:options.baseURL,'content-type':'application/json'},body:'{'}));
  assert.equal(malformed.status,400);assert.equal(malformed.headers.get('cache-control'),'no-store');
  const wrongType=await handle(new Request(`${options.baseURL}/api/team`,{method:'POST',headers:{origin:options.baseURL,'content-type':'text/plain'},body:'{}'}));assert.equal(wrongType.status,415);
});

test('hashed invitation reserves a seat, reveals only bearer details, survives restart and is accepted once concurrently',async()=>{
  const {token}=await invite('new@example.test','viewer');
  const saved=(await admin.query('SELECT * FROM workspace_invitation')).rows[0];
  assert.equal(saved.token_hash,createHash('sha256').update(token).digest('hex'));assert.ok(!JSON.stringify(saved).includes(token));
  assert.ok(new Date(saved.expires_at)-new Date(saved.created_at)>=23.9*3600*1000);
  const detail=await req(`/api/invitations?token=${token}`,undefined,'');assert.equal(detail.status,200);
  assert.deepEqual(await detail.json(),{email:'new@example.test',role:'viewer',workspaceName:'Workspace',existingAccount:false});
  assert.equal((await admin.query('SELECT accepted_at FROM workspace_invitation')).rows[0].accepted_at,null);
  await pool.end();pool=null;await admin.end();admin=null;await local.cluster.stop();await local.cluster.start();
  admin=createDatabase(local.adminUrl);pool=createDatabase(local.appUrl);auth=createAuthentication(pool,options);handle=membershipHttpHandler(pool,auth,options);
  const result=await Promise.all(Array.from({length:6},()=>accept(token,{email:'forged@example.test',role:'owner',workspaceId:randomBytes(16).toString('hex')})));
  assert.deepEqual(result.map(x=>x.status).sort(),[200,400,400,400,400,400]);
  assert.equal((await req(`/api/invitations?token=${token}`,undefined,'')).status,400);
  const accepted=await verifiedActor(auth,pool,new Headers({cookie:await login('new@example.test')}));assert.equal(accepted.role,'viewer');assert.equal(accepted.workspaceId,workspace);
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM auth_user WHERE email='forged@example.test'")).rows[0].n,0);
});

test('expired and cancelled links reject; capacity includes pending invites under competing requests',async()=>{
  const expired=await invite('expired@example.test');await admin.query("UPDATE workspace_invitation SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);
  assert.equal((await accept(expired.token)).status,400);
  const cancelled=await invite('cancelled@example.test');assert.equal((await team({action:'revoke',id:cancelled.id})).status,200);assert.equal((await accept(cancelled.token)).status,400);
  await invite('one@example.test');await invite('two@example.test');
  // Separate pools model two workers: the database lock, not the process queue,
  // must serialize the final seat reservation.
  const secondPool=createDatabase(local.appUrl);
  let results;
  try {
    const secondHandler=membershipHttpHandler(secondPool,createAuthentication(secondPool,options),options);
    results=await Promise.all([team({action:'invite',email:'three@example.test',role:'editor'}),secondHandler(new Request(`${options.baseURL}/api/team`,{
      method:'POST',headers:{origin:options.baseURL,'content-type':'application/json',cookie:ownerCookie},body:JSON.stringify({action:'invite',email:'four@example.test',role:'viewer'})
    }))]);
  } finally {await secondPool.end();}
  assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
  assert.equal((await team({action:'invite',email:'one@example.test',role:'editor'})).status,409);
});

test('last owner is protected, demotion/removal revoke sessions and removal preserves identity/task data',async()=>{
  for(const body of [{action:'remove',id:owner},{action:'role',id:owner,role:'viewer'}]) assert.equal((await team(body)).status,409);
  const editor=await member('editor@example.test');
  assert.equal((await team({action:'role',id:editor.id,role:'viewer'})).status,200);assert.equal(await verifiedActor(auth,pool,new Headers({cookie:editor.cookie})),null);
  const fresh=await login('editor@example.test');assert.equal((await verifiedActor(auth,pool,new Headers({cookie:fresh}))).role,'viewer');
  const board=(await admin.query("INSERT INTO board(workspace_id,name) VALUES($1,'Preserve') RETURNING id",[workspace])).rows[0].id;
  const group=(await admin.query("INSERT INTO board_group(workspace_id,board_id,name) VALUES($1,$2,'Group') RETURNING id",[workspace,board])).rows[0].id;
  const task=(await admin.query("INSERT INTO task(workspace_id,board_id,group_id,title) VALUES($1,$2,$3,'Preserve task') RETURNING id",[workspace,board,group])).rows[0].id;
  await admin.query('INSERT INTO task_assignee(workspace_id,task_id,user_id) VALUES($1,$2,$3)',[workspace,task,editor.id]);
  assert.equal((await team({action:'remove',id:editor.id})).status,200);assert.equal(await verifiedActor(auth,pool,new Headers({cookie:fresh})),null);
  assert.equal((await admin.query('SELECT 1 FROM app_user WHERE id=$1',[editor.id])).rowCount,1);
  assert.equal((await admin.query('SELECT title FROM task WHERE id=$1',[task])).rows[0].title,'Preserve task');
  assert.equal((await admin.query('SELECT 1 FROM task_assignee WHERE user_id=$1',[editor.id])).rowCount,0);
  const second=await member('second-owner@example.test','owner');
  const oldOwnerInvite=await invite('old-authority@example.test');
  const self=await team({action:'role',id:owner,role:'editor'});assert.equal(self.status,200);assert.equal((await self.json()).reauthenticate,true);
  assert.equal((await accept(oldOwnerInvite.token)).status,400);
  assert.equal((await team({action:'invite',email:'stale@example.test',role:'owner'})).status,401);
  assert.equal((await team({action:'remove',id:second.id},second.cookie)).status,409);
});

test('reinviting an existing identity verifies current password or matching live cookie, never replaces its password',async()=>{
  const prior=await member('returning@example.test');await team({action:'remove',id:prior.id});
  const {token}=await invite('returning@example.test','viewer');
  assert.equal((await (await req(`/api/invitations?token=${token}`,undefined,'')).json()).existingAccount,true);
  assert.equal((await accept(token,{password:'wrong current password'},ownerCookie)).status,401);
  assert.equal((await accept(token,{password:undefined},ownerCookie)).status,401);
  assert.equal((await accept(token,{password})).status,200);
  const restored=await verifiedActor(auth,pool,new Headers({cookie:await login('returning@example.test')}));assert.equal(restored.id,prior.id);assert.equal(restored.role,'viewer');
  // A legitimate unassigned identity can have a provider-authenticated session;
  // acceptance verifies the subject and live session, never a submitted email.
  const other=await member('cookie@example.test');await team({action:'remove',id:other.id});
  const signupAuth=createAuthentication(pool,options);
  const direct=await signupAuth.api.signInEmail({body:{email:'cookie@example.test',password},asResponse:true});
  const second=await invite('cookie@example.test');
  assert.equal((await accept(second.token,{password:undefined},cookies(direct))).status,200);
});

test('disabled accounts cannot accept invitations and failed membership insertion compensates only a newly created identity',async()=>{
  const prior=await member('disabled@example.test');await team({action:'remove',id:prior.id});await admin.query('UPDATE app_user SET disabled_at=now() WHERE id=$1',[prior.id]);
  const disabled=await invite('disabled@example.test');assert.equal((await accept(disabled.token)).status,400);
  const fresh=await invite('failure@example.test');
  await admin.query(`CREATE FUNCTION fail_invited_member() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced invitation failure'; END; $$;
    CREATE TRIGGER test_invitation_failure BEFORE INSERT ON membership FOR EACH ROW EXECUTE FUNCTION fail_invited_member()`);
  const failed=await accept(fresh.token);assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/forced invitation failure/);
  assert.equal((await admin.query("SELECT 1 FROM auth_user WHERE email='failure@example.test'")).rowCount,0);
  assert.equal((await admin.query('SELECT 1 FROM app_user WHERE id=$1',[prior.id])).rowCount,1);
  await admin.query('DROP TRIGGER test_invitation_failure ON membership; DROP FUNCTION fail_invited_member()');
  assert.equal((await accept(fresh.token)).status,200);
});

test('public acceptance throttle is persistent and cannot be bypassed with forged forwarded headers',async()=>{
  for(let i=0;i<10;i++) assert.equal((await accept('invalid-token')).status,400);
  const another=membershipHttpHandler(pool,createAuthentication(pool,options),options);
  const response=await another(new Request(`${options.baseURL}/api/invitations`,{method:'POST',headers:{origin:options.baseURL,'content-type':'application/json','x-forwarded-for':'1.2.3.4'},body:JSON.stringify({token:'invalid-token'})}));
  assert.equal(response.status,429);assert.equal((await admin.query('SELECT attempts FROM invitation_rate_limit')).rows[0].attempts,11);
});

test('an invitation cannot outlive an issuer whose account was disabled by the operator',async()=>{
  const {token}=await invite();
  await admin.query('UPDATE app_user SET disabled_at=now() WHERE id=$1',[owner]);
  assert.equal((await accept(token)).status,400);
  assert.equal((await team({action:'invite',email:'another@example.test',role:'viewer'})).status,401);
  assert.equal((await admin.query("SELECT 1 FROM auth_user WHERE email='invite@example.test'")).rowCount,0);
});

test('operator recovery for a reinvited account requires a live invitation and never restores membership itself',async()=>{
  const returning=await member('recover-return@example.test');
  await team({action:'remove',id:returning.id});
  await assert.rejects(issueRecovery(pool,options,returning.email),/No active/);
  const invitation=await invite(returning.email,'viewer');
  // Capture a provider session to prove password recovery invalidates it even
  // before this account has regained any workspace membership.
  const unassignedSession=await auth.api.signInEmail({body:{email:returning.email,password},asResponse:true});
  const sessionHeaders=new Headers({cookie:cookies(unassignedSession)});
  assert.ok(await auth.api.getSession({headers:sessionHeaders}));
  const reset=new URL(await issueRecovery(pool,options,returning.email)).searchParams.get('token');
  const newPassword='Reinvited fictional replacement 456!';
  const resetRequest=()=>authHttpHandler(auth,pool,options.baseURL)(new Request(`${options.baseURL}/api/auth/reset-password`,{
    method:'POST',headers:{origin:options.baseURL,'content-type':'application/json'},body:JSON.stringify({token:reset,newPassword})
  }));
  assert.equal((await resetRequest()).status,200);
  assert.equal((await resetRequest()).status,400);
  assert.equal(await auth.api.getSession({headers:sessionHeaders}),null);
  assert.equal((await admin.query('SELECT 1 FROM membership WHERE user_id=$1',[returning.id])).rowCount,0);
  assert.equal((await accept(invitation.token,{password})).status,401);
  assert.equal((await accept(invitation.token,{password:newPassword})).status,200);
  assert.equal((await admin.query('SELECT role FROM membership WHERE user_id=$1',[returning.id])).rows[0].role,'viewer');
});

test('operator recovery rejects cancelled, expired or inactive-issuer invitations and disabled invitees',async()=>{
  const returning=await member('recover-denied@example.test');
  await team({action:'remove',id:returning.id});
  const cancelled=await invite(returning.email);await team({action:'revoke',id:cancelled.id});
  await assert.rejects(issueRecovery(pool,options,returning.email),/No active/);
  const expired=await invite(returning.email);await admin.query("UPDATE workspace_invitation SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);
  await assert.rejects(issueRecovery(pool,options,returning.email),/No active/);
  await invite(returning.email);
  await admin.query('UPDATE app_user SET disabled_at=now() WHERE id=$1',[returning.id]);
  await assert.rejects(issueRecovery(pool,options,returning.email),/No active/);
  await admin.query('UPDATE app_user SET disabled_at=null WHERE id=$1',[returning.id]);
  await admin.query('UPDATE app_user SET disabled_at=now() WHERE id=$1',[owner]);
  await assert.rejects(issueRecovery(pool,options,returning.email),/No active/);
  await admin.query('UPDATE app_user SET disabled_at=null WHERE id=$1',[owner]);
  await admin.query("UPDATE membership SET role='editor' WHERE user_id=$1",[owner]);
  await assert.rejects(issueRecovery(pool,options,returning.email),/No active/);
});
