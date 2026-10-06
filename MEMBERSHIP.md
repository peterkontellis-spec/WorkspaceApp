# Team access — M2.3

Open **Team access** from the desktop sidebar, mobile navigation menu or account dialog. This manages real staff membership. Boards, tasks and Docs still contain temporary sample work; persistent task editing is M2.4. Customer folders and private admin material are separate and unavailable here.

## Invite and join

An owner enters the person's email and chooses owner, editor or viewer, then selects **Create invitation**. Copy the link immediately and share it directly with that person; no email is sent. Only a hash of the token is stored, so the full link cannot be retrieved later. Cancel and recreate an invitation if you lose it.

Links expire after 24 hours and can be accepted once. Pending invitations reserve a place in the four-person workspace. Duplicate pending invitations and existing members are rejected. Cancelling an invitation releases its place. Removing or demoting its owner cancels that owner's unused invitations; acceptance also checks that the issuer remains an active owner, including operator-disabled accounts.

The recipient opens the link, checks the displayed email/role, enters their name and a new password, and chooses **Join workspace**. They then sign in. The email and role come from the stored invitation, never editable request fields. Possession of the link is the invitation proof: share it privately with the intended person. This does not claim independent email ownership verification.

The current preview binds to this Mac only. A `127.0.0.1` invitation will not reach the Mac from another device. Real remote invitation use awaits a configured HTTPS address/deployment; do not expose the development server to work around that gate.

## Manage membership

| Action | Owner | Editor | Viewer |
| --- | --- | --- | --- |
| View current team | Yes | Yes | Yes |
| Issue/cancel invitations | Yes | No | No |
| Change roles/remove members | Yes | No | No |
| Read shared tasks once connected | Yes | Yes | Yes |
| Edit shared tasks once connected | Yes | Yes | No |

The first three rows are implemented in M2.3, with direct-request permission checks. Task permissions must also be enforced on each future task/search/file endpoint as it is added; sample editing does not establish those permissions. Existing repository-level task read/rename tests remain separate evidence.

Role changes and removal require confirmation. Changing a role revokes that person's sessions and outstanding recovery links. Removing someone also removes task assignments, but keeps their account and existing work. Self changes return the actor to sign-in. The last active owner cannot be demoted or removed through team management. Local operator authority remains separate; an operator can disable an account, including an owner, so operators must preserve a usable owner/recovery path.

A removed person can be reinvited using the same email and current password; this restores their existing identity without replacing their password. If they forgot it, a local operator must verify them and issue recovery while a valid invitation from an active owner exists. Recovery alone never grants membership. Disabled accounts cannot join or recover through invitations. Re-enabling an operator-disabled identity remains a deliberate operator maintenance task; there is no self-service bypass.

## Controls and operating limits

Migration 005 adds invitations and a persistent acceptance throttle. Owner mutations are serialized under a workspace row lock, then recheck the actor's live session and membership. A bounded per-process queue prevents database lock waiters from exhausting the small pool while authentication needs a connection. Database locks preserve capacity and last-owner rules across separate application pools.

Public acceptance limits attempts to ten per minute in a shared loopback bucket. HTTP mutations require exact-origin JSON and bound input to 8 KiB. Responses use no-store and no-referrer. Expired, cancelled, reused or inactive-issuer links do not create accounts. Failed account creation/membership insertion compensates only the newly created unassigned identity and leaves the invitation retryable. Existing-account password verification does not leave a newly issued session behind.

This is a local development increment, not production security certification. Proxy/throttle strategy, HTTPS deployment, audit history, retention/cleanup, backups and customer/admin authorization remain later work. There is no recurring cleanup or email delivery service.

## Checks

Membership tests use isolated PostgreSQL port 55435 and fictional accounts. They cover direct signed-out/forged/editor/viewer requests, cross-workspace targets, hashing/expiry/reuse, six simultaneous acceptances, competing capacity changes through separate pools, last-owner protection, revoked sessions, preserved tasks, reinviting existing identities, recovery eligibility, rollback compensation and persistent throttling. See STATUS.md for the final counts, desktop/narrow browser evidence and any remaining manual checks.
