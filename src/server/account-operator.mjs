import { createAuthentication } from './auth-core.mjs';
import { transaction } from './database.mjs';

export async function createFirstOwner(pool, options, { name, email, password }) {
  if (
    !name?.trim() ||
    name.trim().length > 120 ||
    !email ||
    typeof password !== 'string' ||
    password.length < 12 ||
    password.length > 128
  )
    throw new Error('Name, email and a 12–128 character password are required.');
  let createdUserId;
  try {
    return await transaction(pool, async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(73022001)');
      const exists = await c.query(
        'SELECT 1 FROM membership m JOIN app_user u ON u.id=m.user_id WHERE u.auth_user_id IS NOT NULL',
      );
      if (exists.rowCount)
        throw new Error('An account is already set up. Use invitations when M2.3 is available.');
      const auth = createAuthentication(pool, { ...options, allowSignup: true });
      const result = await auth.api.signUpEmail({
        body: { name: name.trim(), email: email.trim().toLowerCase(), password },
      });
      createdUserId = result.user.id;
      const workspace = await c.query("INSERT INTO workspace(name) VALUES ('Workspace') RETURNING id");
      await c.query("INSERT INTO membership(workspace_id,user_id,role) VALUES ($1,$2,'owner')", [
        workspace.rows[0].id,
        result.user.id,
      ]);
      return result.user.id;
    });
  } catch (error) {
    // Better Auth uses its own connections. Compensate only this newly created
    // identity after our membership transaction rolls back, so setup is retryable.
    if (createdUserId)
      await transaction(pool, async (c) => {
        await c.query(
          'DELETE FROM app_user WHERE auth_user_id=$1 AND NOT EXISTS (SELECT 1 FROM membership WHERE user_id=app_user.id)',
          [createdUserId],
        );
        await c.query(
          'DELETE FROM auth_user WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM app_user WHERE auth_user_id=$1)',
          [createdUserId],
        );
      });
    throw error;
  }
}

export async function issueRecovery(pool, options, email) {
  // A removed collaborator may need to recover their existing password before
  // accepting a new invitation. Recovery changes credentials only; it never
  // restores membership or bypasses the invitation's one-use acceptance.
  const eligible = `SELECT a.id, access.workspace_id FROM auth_user a
    JOIN app_user u ON u.auth_user_id=a.id
    JOIN LATERAL (
      SELECT m.workspace_id FROM membership m WHERE m.user_id=u.id
      UNION
      SELECT i.workspace_id FROM workspace_invitation i
        JOIN membership issuer ON issuer.workspace_id=i.workspace_id AND issuer.user_id=i.created_by AND issuer.role='owner'
        JOIN app_user creator ON creator.id=issuer.user_id AND creator.disabled_at IS NULL
        WHERE i.email=lower(a.email) AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now()
    ) access ON true
    WHERE lower(a.email)=lower($1) AND u.disabled_at IS NULL ORDER BY access.workspace_id LIMIT 1`;
  let resetToken;
  await transaction(pool, async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(73022002)');
    let user = (await c.query(eligible, [email])).rows[0];
    if (!user) throw new Error('No active workspace account or valid invitation matches that email.');
    // Share the membership mutation lock so a simultaneous invite cancellation
    // or owner demotion cannot race recovery issuance based on stale access.
    await c.query('SELECT id FROM workspace WHERE id=$1 FOR UPDATE', [user.workspace_id]);
    user = (await c.query(eligible, [email])).rows[0];
    if (!user) throw new Error('No active workspace account or valid invitation matches that email.');
    await c.query('DELETE FROM auth_verification WHERE value=$1', [user.id]);
    const auth = createAuthentication(pool, {
      ...options,
      onReset: async ({ token }) => {
        resetToken = token;
      },
    });
    await auth.api.requestPasswordReset({ body: { email, redirectTo: `${options.baseURL}/reset-password` } });
  });
  if (!resetToken) throw new Error('Reset link could not be issued.');
  return `${options.baseURL}/reset-password?token=${encodeURIComponent(resetToken)}`;
}

export async function revokeAccountSessions(pool, email, disable = false) {
  return transaction(pool, async (c) => {
    const user = (await c.query('SELECT id FROM auth_user WHERE lower(email)=lower($1)', [email])).rows[0];
    if (!user) throw new Error('No matching account.');
    if (disable) await c.query('UPDATE app_user SET disabled_at=now() WHERE auth_user_id=$1', [user.id]);
    await c.query('DELETE FROM auth_session WHERE "userId"=$1', [user.id]);
    await c.query('DELETE FROM auth_verification WHERE value=$1', [user.id]);
  });
}
