import { randomBytes, createHash } from 'node:crypto';
import { transaction } from './database.mjs';
import { createAuthentication } from './auth-core.mjs';

export class MembershipError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new MembershipError(status, message);
};
const invalid = () => fail(400, 'This invitation is unavailable. Ask the owner for a new link.');
const roles = new Set(['owner', 'editor', 'viewer']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mutationQueues = new WeakMap();
async function serializeMutation(pool, action) {
  // Do not occupy all four pool connections with lock waiters while the lock
  // holder needs another connection for Better Auth. The database lock remains
  // authoritative across processes; this bounded queue protects each local pool.
  let queue = mutationQueues.get(pool);
  if (!queue) {
    queue = { tail: Promise.resolve(), waiting: 0 };
    mutationQueues.set(pool, queue);
  }
  if (queue.waiting >= 24) fail(429, 'Team service is busy. Try again shortly.');
  queue.waiting++;
  const previous = queue.tail;
  let release;
  queue.tail = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await action();
  } finally {
    queue.waiting--;
    release();
  }
}
const tokenHash = (token) => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) invalid();
  return createHash('sha256').update(token).digest('hex');
};
const pending = 'accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()';

// Validate the signed cookie with Better Auth, then recheck its live database row
// after obtaining the workspace lock. Request bodies never choose an actor/workspace.
async function signedSession(auth, headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) fail(401, 'Sign in required.');
  return session;
}
async function liveMember(c, session, workspaceId) {
  const result = await c.query(
    `SELECT u.id,u.auth_user_id,m.workspace_id,m.role FROM app_user u
    JOIN membership m ON m.user_id=u.id JOIN auth_session s ON s."userId"=u.auth_user_id
    WHERE u.auth_user_id=$1 AND s.id=$2 AND u.disabled_at IS NULL AND s."expiresAt">now()
    AND s."updatedAt">now()-interval '30 minutes' AND ($3::uuid IS NULL OR m.workspace_id=$3)
    ORDER BY m.workspace_id LIMIT 1`,
    [session.user.id, session.session.id, workspaceId ?? null],
  );
  if (!result.rows[0]) fail(401, 'Sign in required.');
  return result.rows[0];
}
async function roster(c, member) {
  const members = (
    await c.query(
      `SELECT u.id,u.display_name AS name,a.email,m.role FROM membership m
    JOIN app_user u ON u.id=m.user_id JOIN auth_user a ON a.id=u.auth_user_id
    WHERE m.workspace_id=$1 ORDER BY u.display_name,u.id`,
      [member.workspace_id],
    )
  ).rows;
  const invitations =
    member.role === 'owner'
      ? (
          await c.query(
            `SELECT id,email,role,expires_at AS "expiresAt"
    FROM workspace_invitation WHERE workspace_id=$1 AND ${pending} ORDER BY created_at`,
            [member.workspace_id],
          )
        ).rows
      : [];
  return { members, invitations, canManage: member.role === 'owner', actorId: member.id };
}
export async function readTeam(pool, auth, headers) {
  const session = await signedSession(auth, headers);
  return transaction(pool, async (c) => roster(c, await liveMember(c, session)));
}
export function manageTeam(pool, auth, options, headers, input) {
  return serializeMutation(pool, () => manageTeamLocked(pool, auth, options, headers, input));
}
async function manageTeamLocked(pool, auth, options, headers, input) {
  const session = await signedSession(auth, headers);
  return transaction(pool, async (c) => {
    const initial = await liveMember(c, session);
    await c.query('SELECT id FROM workspace WHERE id=$1 FOR UPDATE', [initial.workspace_id]);
    const member = await liveMember(c, session, initial.workspace_id);
    if (member.role !== 'owner') fail(403, 'Only an owner can manage the team.');
    let link;
    if (input.action === 'invite') {
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !roles.has(input.role))
        fail(400, 'Enter a valid email and role.');
      const duplicate = await c.query(
        `SELECT 1 FROM membership m JOIN app_user u ON u.id=m.user_id JOIN auth_user a ON a.id=u.auth_user_id
        WHERE m.workspace_id=$1 AND lower(a.email)=$2 UNION ALL SELECT 1 FROM workspace_invitation WHERE workspace_id=$1 AND email=$2 AND ${pending}`,
        [member.workspace_id, email],
      );
      if (duplicate.rowCount) fail(409, 'That person is already a member or has a pending invitation.');
      const seats = (
        await c.query(
          `SELECT (SELECT count(*) FROM membership WHERE workspace_id=$1)+(SELECT count(*) FROM workspace_invitation WHERE workspace_id=$1 AND ${pending}) AS count`,
          [member.workspace_id],
        )
      ).rows[0].count;
      if (Number(seats) >= 4)
        fail(
          409,
          'The workspace has four members or reserved invitation places. Cancel an invitation or remove a member first.',
        );
      const token = randomBytes(32).toString('base64url');
      await c.query(
        'INSERT INTO workspace_invitation(workspace_id,email,role,token_hash,created_by) VALUES($1,$2,$3,$4,$5)',
        [member.workspace_id, email, input.role, tokenHash(token), member.id],
      );
      link = `${options.baseURL}/join?token=${encodeURIComponent(token)}`;
    } else if (input.action === 'revoke') {
      if (typeof input.id !== 'string' || !uuid.test(input.id)) fail(400, 'Choose an invitation.');
      const result = await c.query(
        `UPDATE workspace_invitation SET revoked_at=now() WHERE id=$1 AND workspace_id=$2 AND ${pending}`,
        [input.id, member.workspace_id],
      );
      if (!result.rowCount) fail(404, 'Invitation not found.');
    } else if (input.action === 'role' || input.action === 'remove') {
      if (
        typeof input.id !== 'string' ||
        input.id.length > 128 ||
        (input.action === 'role' && !roles.has(input.role))
      )
        fail(400, 'Choose a member and valid role.');
      const target = (
        await c.query(
          `SELECT m.role,u.auth_user_id FROM membership m JOIN app_user u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.user_id=$2`,
          [member.workspace_id, input.id],
        )
      ).rows[0];
      if (!target) fail(404, 'Member not found.');
      if (target.role === 'owner' && (input.action === 'remove' || input.role !== 'owner')) {
        const owners = (
          await c.query(
            `SELECT count(*)::int AS count FROM membership m JOIN app_user u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.role='owner' AND u.disabled_at IS NULL`,
            [member.workspace_id],
          )
        ).rows[0].count;
        if (owners <= 1) fail(409, 'Keep at least one active owner in the workspace.');
      }
      if (target.role === 'owner' && (input.action === 'remove' || input.role !== 'owner')) {
        await c.query(
          `UPDATE workspace_invitation SET revoked_at=now() WHERE workspace_id=$1 AND created_by=$2 AND ${pending}`,
          [member.workspace_id, input.id],
        );
      }
      if (input.action === 'remove')
        await c.query('DELETE FROM membership WHERE workspace_id=$1 AND user_id=$2', [
          member.workspace_id,
          input.id,
        ]);
      else
        await c.query('UPDATE membership SET role=$3 WHERE workspace_id=$1 AND user_id=$2', [
          member.workspace_id,
          input.id,
          input.role,
        ]);
      await c.query('DELETE FROM auth_session WHERE "userId"=$1', [target.auth_user_id]);
      await c.query('DELETE FROM auth_verification WHERE value=$1', [target.auth_user_id]);
    } else fail(400, 'Choose a valid team action.');
    // Self changes revoke this request's session too; the client must sign in again.
    const result = await roster(c, member);
    return {
      ...result,
      ...(link ? { link } : {}),
      reauthenticate: input.id === member.id && ['role', 'remove'].includes(input.action),
    };
  });
}

export async function invitationDetails(pool, token) {
  const row = (
    await pool.query(
      `SELECT i.email,i.role,w.name AS "workspaceName",EXISTS(SELECT 1 FROM auth_user a WHERE lower(a.email)=i.email) AS "existingAccount"
    FROM workspace_invitation i JOIN workspace w ON w.id=i.workspace_id WHERE token_hash=$1 AND ${pending}`,
      [tokenHash(token)],
    )
  ).rows[0];
  if (!row) invalid();
  return row;
}
export async function invitationThrottle(pool) {
  // Loopback service: all visitors share one persistent bucket. Never trust a
  // browser-supplied forwarded address. Production proxy policy is a later gate.
  const result = await pool.query(`INSERT INTO invitation_rate_limit(bucket) VALUES('accept-local')
    ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN invitation_rate_limit.window_start<now()-interval '1 minute' THEN 1 ELSE invitation_rate_limit.attempts+1 END,
    window_start=CASE WHEN invitation_rate_limit.window_start<now()-interval '1 minute' THEN now() ELSE invitation_rate_limit.window_start END RETURNING attempts`);
  if (result.rows[0].attempts > 10) fail(429, 'Too many attempts. Wait a minute and try again.');
}
export async function acceptInvitation(pool, auth, options, headers, input) {
  await invitationThrottle(pool);
  return serializeMutation(pool, () => acceptInvitationLocked(pool, auth, options, headers, input));
}
async function acceptInvitationLocked(pool, auth, options, headers, input) {
  const hash = tokenHash(input.token);
  let createdUserId;
  try {
    return await transaction(pool, async (c) => {
      const lookup = (
        await c.query(`SELECT workspace_id FROM workspace_invitation WHERE token_hash=$1`, [hash])
      ).rows[0];
      if (!lookup) invalid();
      await c.query('SELECT id FROM workspace WHERE id=$1 FOR UPDATE', [lookup.workspace_id]);
      const invite = (
        await c.query(`SELECT * FROM workspace_invitation WHERE token_hash=$1 AND ${pending} FOR UPDATE`, [
          hash,
        ])
      ).rows[0];
      if (!invite) invalid();
      const issuer = await c.query(
        `SELECT 1 FROM membership m JOIN app_user u ON u.id=m.user_id
        WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.role='owner' AND u.disabled_at IS NULL`,
        [invite.workspace_id, invite.created_by],
      );
      if (!issuer.rowCount) invalid();
      const seats = Number(
        (
          await c.query('SELECT count(*) AS count FROM membership WHERE workspace_id=$1', [
            invite.workspace_id,
          ])
        ).rows[0].count,
      );
      if (seats >= 4) fail(409, 'The workspace is full. Ask its owner for help.');
      const existing = (
        await c.query(
          `SELECT a.id,u.id AS app_id,u.disabled_at FROM auth_user a JOIN app_user u ON u.auth_user_id=a.id WHERE lower(a.email)=$1`,
          [invite.email],
        )
      ).rows[0];
      let userId;
      if (existing) {
        if (existing.disabled_at) invalid();
        const session = await auth.api.getSession({ headers });
        const validSession =
          session &&
          session.user.id === existing.id &&
          (await c.query(
            `SELECT 1 FROM auth_session WHERE id=$1 AND "userId"=$2 AND "expiresAt">now() AND "updatedAt">now()-interval '30 minutes'`,
            [session.session.id, existing.id],
          ));
        if (!validSession?.rowCount) {
          if (typeof input.password !== 'string' || input.password.length > 128)
            fail(401, 'Sign in with the invited account or enter its current password.');
          let verified;
          try {
            verified = await auth.api.signInEmail({
              body: { email: invite.email, password: input.password },
            });
          } catch {
            fail(401, 'The current password could not be verified.');
          }
          await pool.query('DELETE FROM auth_session WHERE token=$1', [verified.token]);
          if (verified.user.id !== existing.id) fail(401, 'The current password could not be verified.');
        }
        userId = existing.app_id;
      } else {
        if (
          typeof input.name !== 'string' ||
          !input.name.trim() ||
          input.name.trim().length > 120 ||
          typeof input.password !== 'string' ||
          input.password.length < 12 ||
          input.password.length > 128
        )
          fail(400, 'Enter your name and a password of 12–128 characters.');
        const signup = createAuthentication(pool, { ...options, allowSignup: true });
        const result = await signup.api.signUpEmail({
          body: { email: invite.email, name: input.name.trim(), password: input.password },
        });
        createdUserId = result.user.id;
        userId = result.user.id;
      }
      if ((await c.query('SELECT 1 FROM membership WHERE user_id=$1', [userId])).rowCount)
        fail(409, 'This account already belongs to a workspace.');
      await c.query('INSERT INTO membership(workspace_id,user_id,role) VALUES($1,$2,$3)', [
        invite.workspace_id,
        userId,
        invite.role,
      ]);
      await c.query('UPDATE workspace_invitation SET accepted_at=now() WHERE id=$1', [invite.id]);
      return { ok: true };
    });
  } catch (error) {
    if (createdUserId)
      await transaction(pool, async (c) => {
        await c.query(
          'DELETE FROM app_user WHERE auth_user_id=$1 AND NOT EXISTS(SELECT 1 FROM membership WHERE user_id=app_user.id)',
          [createdUserId],
        );
        await c.query(
          'DELETE FROM auth_user WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM app_user WHERE auth_user_id=$1)',
          [createdUserId],
        );
      });
    throw error;
  }
}
