import { betterAuth } from 'better-auth';

export function authOptions(pool, { secret, baseURL, allowSignup = false, onReset = async () => { throw new Error('Use the local recovery command.'); } }) {
  const origin = new URL(baseURL);
  if (origin.origin !== baseURL || (origin.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(origin.hostname))) throw new Error('Authentication requires HTTPS except on loopback.');
  if (!secret || secret.length < 32) throw new Error('Set a private authentication secret of at least 32 characters.');
  return {
    appName: 'Workspace', baseURL, secret, database: pool,
    trustedOrigins: [baseURL], logger: { disabled: true },
    user: { modelName: 'auth_user' },
    account: { modelName: 'auth_account' },
    verification: { modelName: 'auth_verification', storeIdentifier: 'hashed' },
    session: { modelName: 'auth_session', expiresIn: 8 * 60 * 60, disableSessionRefresh: true, cookieCache: { enabled: false } },
    emailAndPassword: {
      enabled: true, disableSignUp: !allowSignup, minPasswordLength: 12, maxPasswordLength: 128,
      autoSignIn: false, resetPasswordTokenExpiresIn: 15 * 60,
      revokeSessionsOnPasswordReset: true, sendResetPassword: onReset,
    },
    rateLimit: { enabled: true, storage: 'database', modelName: 'auth_rate_limit', window: 60, max: 100,
      customRules: { '/sign-in/email': { window: 60, max: 10 }, '/reset-password': { window: 60, max: 10 } } },
    advanced: {
      cookiePrefix: 'workspace', useSecureCookies: origin.protocol === 'https:',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      // The handler overwrites this header. Never trust client-supplied proxy IPs.
      ipAddress: { ipAddressHeaders: ['x-workspace-client-ip'] },
    },
    databaseHooks: { user: { create: { after: async (user) => {
      await pool.query('INSERT INTO app_user(id, auth_user_id, display_name) VALUES ($1,$1,$2)', [user.id, user.name]);
    } } } },
  };
}
export function createAuthentication(pool, options) { return betterAuth(authOptions(pool, options)); }

export async function verifiedActor(auth, pool, headers, { touch = false } = {}) {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const result = await pool.query(`SELECT u.id, u.display_name, u.disabled_at, m.workspace_id, m.role
    FROM app_user u JOIN membership m ON m.user_id=u.id WHERE u.auth_user_id=$1 ORDER BY m.workspace_id LIMIT 1`, [session.user.id]);
  const member = result.rows[0];
  if (!member || member.disabled_at || Date.now() - new Date(session.session.updatedAt).getTime() >= 30 * 60 * 1000) {
    await pool.query('DELETE FROM auth_session WHERE id=$1', [session.session.id]);
    return null;
  }
  // Idle timeout is independent of the library's fixed eight-hour expiry.
  if (touch) await pool.query(`UPDATE auth_session SET "updatedAt"=now() WHERE id=$1 AND "updatedAt" < now()-interval '1 minute'`, [session.session.id]);
  return { id: member.id, name: member.display_name, email: session.user.email, role: member.role, workspaceId: member.workspace_id };
}
