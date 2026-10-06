# Local accounts — M2.2

Password accounts and server-checked sessions now protect workspace pages. Accounts-mode boards/tasks/details and attachments are saved; only Docs remain an in-memory sample. Invitations and staff role administration are implemented; see [MEMBERSHIP.md](MEMBERSHIP.md). The complete local foundation is accepted through M2.8; see FOUNDATION_REVIEW.md. No customer portal, private admin access, MFA, email service or NAS deployment is enabled.

## Create your first owner

From this project folder, with Node and pnpm on your PATH:

1. Run `pnpm db:start` if the project's database is not already running. Keep its terminal open. It applies migrations and creates owner-only local configuration without overwriting existing credentials.
2. Run `pnpm account:setup` in another local terminal. Enter your name, email and a password of 12–128 characters; password input is hidden. Email is a sign-in identifier; no email is sent. Do not paste your password into chat.
3. Reuse the running [Mac preview](http://127.0.0.1:3100/sign-in), or run `pnpm dev:db` after stopping that preview. Sign in with your new account.

Setup allows only the first bound workspace owner. It never gives the fictional seed accounts a password. Failed membership creation cleans up the newly created identity so setup can be retried. This staff owner has no NAS or customer-portal privileges. There is no default production login. Temporary QA accounts may exist while current browser checks are open; STATUS.md records their cleanup before first real owner setup.

For attachment-enabled development, set `ATTACHMENT_ROOT="$PWD/.local/attachments"` before `pnpm dev:db`; `pnpm preview` configures it automatically. `pnpm dev:db` loads `.local/database.env` and `.local/auth.env`. Plain `pnpm dev` requires equivalent environment configuration; missing configuration fails closed. Use `pnpm dev:prototype` only for an explicitly anonymous sample-data preview. Never deploy prototype mode with real records.

For the isolated production preview, follow RUNNING.md and use:

```sh
pnpm build
pnpm preview
```

## Recovery and operator actions

The user selected local identity verification rather than an assumed email provider. Run `pnpm account:recover`, enter the account email, independently verify the person, and type `verified`. The command writes a one-use, 15-minute reset link to an owner-only file under `.local/recovery/`. Share it directly with that verified person, then remove the local file. The person opens it and enters their new password themselves. Issuing another link invalidates the previous one; successful recovery revokes existing sessions. Expired or reused links cannot reset a password. Disabled accounts cannot recover. A removed person with a valid pending invitation from an active owner can use verified operator recovery; recovery does not grant membership, and they must still accept the invitation.

`pnpm account:revoke` signs out all sessions and cancels outstanding recovery links. `pnpm account:disable` also blocks future sign-ins. Each prompts for an email and explicit confirmation. These are trusted local operator commands, not public HTTP endpoints. Team membership administration is described in MEMBERSHIP.md. Re-enabling an operator-disabled account is not exposed in the UI.

## Session and request boundaries

Better Auth 1.7.7 owns password hashing, session credentials and reset tokens. Generated migration 003 was reviewed before application; migration 004 binds authenticated subjects to app users. Seed users remain unbound. No caller-supplied identity or sample-account selection grants real access.

Sessions have an eight-hour absolute lifetime and a 30-minute idle cutoff. Page navigation and observed user activity refresh idle activity; passive status polls do not. Logout, reset, operator revocation, disabled accounts and removed membership invalidate access. Client status checks run while visible, on focus and after activity. The UI hides workspace content if it cannot verify the session; requests time out instead of waiting indefinitely. Sign-out clears temporary sample edits before leaving, avoiding a misleading unsaved-draft prompt. Back navigation after sign-out does not restore the workspace.

Cookies are host-only, HttpOnly and SameSite=Lax, with Secure on HTTPS. HTTP is allowed only for local development origins. The application exposes only the required sign-in, sign-out and reset-password operations; public signup and recovery issuance are unavailable. Writes require the configured exact Origin and JSON, reject cross-site requests, and limit bodies to 8 KiB. Sign-in responses do not expose the raw session token. Recovery pages use no-referrer; account responses are not cached.

Database-backed throttling limits login/reset attempts to ten per minute. The current loopback deployment uses one shared client bucket and discards caller-supplied forwarding headers. Trusted reverse-proxy handling, distributed/per-account controls and production abuse testing remain deployment gates. Auth configuration and basic schema are included in `/api/health` readiness; health exposes no account contents.

All local databases, credentials, recovery files and auth configuration are ignored under `.local/`. Git checkpoints do not back them up. Do not replace the auth secret casually or copy development superuser credentials into deployment. HTTPS deployment, backups/restoration, production dependency/security review, private-admin/customer boundaries and NAS resource measurements remain open.

## Verification

`pnpm check` runs TypeScript, 23 existing behavioral tests and a production build. `pnpm test:db` runs 30 real PostgreSQL tests across isolated clusters on ports 55433/55434/55435, including auth, restart, membership, recovery, concurrency and foundation checks. They stop their own clusters and preserve development data.

For HTTP smoke checks in accounts mode, supply `WORKSPACE_SMOKE_CREDENTIALS_FILE` pointing to an ignored owner-only JSON file with a disposable test account's `email` and `password`. The script uses the cookie only in memory. Remove the file/account after testing. With an explicit prototype preview, no account file is needed. Never put passwords in command arguments, committed fixtures or test output.

Actual desktop/narrow browser and user-assisted reset evidence is in STATUS.md. This increment does not claim fresh physical-phone or 200% zoom testing, a complete accessibility audit, or production security certification.

Primary references: [Next.js integration](https://better-auth.com/docs/integrations/next), [session management](https://better-auth.com/docs/concepts/session-management), [email/password and recovery](https://better-auth.com/docs/authentication/email-password). Implementation was checked against the installed pinned package as well as these references.
