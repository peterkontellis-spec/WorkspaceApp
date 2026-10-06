# Decisions

| Date / source | Decision | State and reason |
| --- | --- | --- |
| Existing PLANNING.md baseline | Self-host on UGREEN DXP2800 for up to four people; NAS-resident data and Docs; no required Google Drive | Confirmed in baseline; central product constraints |
| Existing PLANNING.md baseline | Approximately 4 GB app memory budget | Design constraint; actual usage must be measured |
| Existing PLANNING.md baseline | Deliver prototype, foundation, team workflow, advanced behavior, then NAS rollout | Existing delivery sequence; all confirmed features retained |
| Existing PLANNING.md baseline | React/Next.js/TypeScript, PostgreSQL, Tiptap/Yjs/Hocuspocus, Docker Compose | Proposed, not installed or finalized; validate when implementation begins |
| Existing PLANNING.md baseline | Comments/mentions, private boards, and inbox remain optional | Not approved; do not add silently |
| 2026-09-25 — user request | Apply the AI workflow to the workspace app | Confirmed in this conversation |
| 2026-09-25 — implementation choice | Keep instructions and progress documents directly in workspace-app | Reversible setup choice so the workflow travels with the project |
| 2026-09-25 — implementation choice | One coordinating assistant; bounded specialist assignments; main assistant owns shared records | Reduces conflicting edits and provides one integrated result |
| 2026-09-25 — user request | Break the five stages into small increments and provide a Markdown pre-session checklist | SESSION_CHECKLIST.md is the user-facing roadmap; STATUS.md stays authoritative for current progress and MILESTONES.md for stage acceptance. No additional product features or implementation are implied. |
| 2026-09-25 — M1.1 user preference replies | Dark workspace with subtle accents; equal desktop/phone focus and larger controls | Confirmed user direction. Phone task work and document writing receive equal design attention; no desktop-first assumption. |
| 2026-09-25 — M1.1 design proposals | Palette, type/size ranges, phone Home/Boards/Docs navigation plus full menu, task/document return behavior | Provisional details in DESIGN_SPEC.md; refine in the prototype. Final name/branding remain open. |
| 2026-09-25 — M1.1 delivery boundary | Screen/interaction specification only; runnable shell starts at M1.2 | Current request authorizes M1.1. Sign-in is conceptual; live accounts, saves and document collaboration remain later work. |
| 2026-09-25 — user request | Implement M1.2 locally | Shell/navigation scope authorized; no NAS or external deployment. Later detailed screens remain incremental. |
| 2026-09-25 — M1.2 implementation | Next.js 16.3.6, React 19.3.0, TypeScript, lucide-react 1.48.0; pnpm 11.25.0 lockfile; plain CSS | Frontend proposal adopted after official-documentation and registry checks. Minimal frontend dependencies; no database, auth, office/editor service, or cloud requirement added. |
| 2026-09-25 — M1.2 implementation | Real local routes with shared fictional fixtures; in-memory sample account; native dialog primitives | Supports shell navigation and later increments while labelling sample roles/content honestly. Account selection resets on refresh. |
| 2026-09-25 — M1.2 environment | Local server at 127.0.0.1:3100; standalone output configured for eventual self-hosting; generated agent rules disabled | Loopback preview only. Preserve project instructions; actual NAS packaging remains M5. |
| 2026-09-25 — M1.2 verification | Keep visual/keyboard/navigation acceptance pending | Browser tool refused access because its admin-enforced security policy could not be verified. No alternate browser mechanism was used to bypass the restriction. Build/source checks do not replace browser QA. |

Record later material changes with their rationale and authority. Preserve whether a decision is confirmed or proposed. Do not infer approval of deployment, purchases, or optional product features from this setup request.

## 2026-10-05 — required checks before task completion

The user requested a self-check loop that actually runs/tests the app, reviews it against design/UI skills, fixes failures, and reassesses the next action before closing. They selected **after each task/session only**, with no automatic daily review. AGENTS.md defines the standing loop; SESSION_CHECKLIST.md includes its closure gates. `pnpm check` and `pnpm check:smoke` provide repeatable build and HTTP checks. Browser checks and skill reviews remain explicit assistant actions, and blocked checks leave the affected feature incomplete. Preserve the current design and confirmed scope; this instruction does not authorize deployment or a redesign.

## 2026-10-05 — prototype execution and checkpoint policy

The user handed off M1.2–M1.5 and authorised commit/push checkpoints to WorkspaceApp, with work restricted to the existing project workspace and no credits/resets. Preserve the shell and existing design. A minimal task panel moves into M1.3 to support its task-opening requirement; M1.5 expands it. Shared in-memory state stays above routes so edits survive navigation but not refresh. Browser denial does not authorise bypasses or a completion claim; implementation continues under the latest handoff with acceptance explicitly pending. GitHub pushes are waiting for authentication; local commits remain available.

## 2026-10-05 — M1.5 implementation details

Prototype Docs use a small Markdown text/preview editor with formatting controls and only safe HTTP(S) links. No additional runtime dependency, raw HTML execution, cloud editor or persistence is introduced. Fixed document titles keep this increment focused on writing; real editor/collaboration choices remain M4. Edits promote the document in session recency. Board/task drafts remain in the shared provider through navigation, and changed sessions register a refresh/close warning. Native task dialogs preserve visible desktop board context and use the full phone width; rendered behavior remains pending verification. Checkpoints are named implemented, not complete.

## 2026-10-05 — GitHub authentication and upload complete

The user completed GitHub CLI browser sign-in. The assistant configured an HTTPS credential helper in this repository only and pushed `main` plus baseline/M1.2/M1.3/M1.4/M1.5 tags atomically to the supplied WorkspaceApp remote. Future authorised checkpoints can be pushed from this project. The CLI binary and authentication configuration live under untracked `.git` metadata, with the credential reported in the OS keyring. Earlier authentication-block notes are historical; STATUS.md is current. No source changes, credits, resets or deployment were involved in this upload step.

## 2026-10-05 — M1.6 review refinements

- User authorised assistant-run browser testing and fixes, plus an Assistant · Later navigation placeholder. Local AI with optional Astra handoff remains proposed future work; no service, spend or deployment is authorised by this placeholder.
- Replaced native date inputs with an in-page calendar after two embedded-browser crashes on opening the native popup. App HTTP responses remained healthy and keyboard date edits worked; browser internals were not diagnosed. Preserve ISO date-only values and existing board Save/Cancel vs task immediate-update semantics.
- Keep Docs mode controls reachable while scrolling and bring the editor start into view on mode changes. A 360px pre-fix inspection showed Preview content, so the user's complete mobile visibility concern remains to be confirmed after the refinement.
- Never close M1.6 solely on automated results: final browser access was denied by admin-policy verification after partial direct testing. STATUS.md records each failure and remaining check.

## 2026-10-06 — M2 authorization and foundation choices

The user requested an M2 outline and implementation, and explicitly confirmed a shared staff workspace with owner/editor/viewer access; customer access and private admin material remain separate. Continue bounded tested checkpoints under the existing no-spend/no-reset/no-deployment constraints.

Adopt PostgreSQL 18 with the pinned pg driver, a small server-side pool and explicit transactional/checksummed SQL migrations. Use the pinned embedded-postgres package only for project-local development and integration tests; production PostgreSQL packaging remains M5. All local database data and generated credentials stay under ignored `.local/`. The runtime role cannot alter schema/history. Keep the M1 UI clearly sample-only until authenticated persistence is wired in M2.4.

Select Better Auth with PostgreSQL for M2.2; its authentication schema will be generated from the reviewed pinned configuration then, not hand-invented now. Password/session handling, local owner setup, invitations, recovery without an assumed mail provider and stronger admin/customer requirements remain to implement/test. Staff workspace ownership does not imply portal administrator or NAS privileges. [DATABASE.md](DATABASE.md) records the exact boundaries and remaining gates.

## 2026-10-06 — M2.2 accounts and operator recovery

Adopt pinned Better Auth 1.7.7 with generated/reviewed PostgreSQL schema and a separate binding to application membership. Public signup is disabled; local first-owner setup is the sole bootstrap path, and M2.3 will add invitations. The user explicitly chose a local operator verifying identity and issuing a one-use 15-minute recovery link, with no email provider assumed. Recovery revokes sessions and replaces earlier outstanding links.

Use eight-hour absolute sessions and a 30-minute idle cutoff refreshed by actual activity, not passive polls. Require exact-origin JSON auth writes, bounded bodies, host-only HttpOnly/SameSite cookies and Secure on HTTPS. Loopback HTTP is a development exception; forwarding headers are not trusted. Missing auth configuration fails closed; anonymous sample mode requires an explicit setting. These choices do not establish production readiness. Preserve sample-only editing disclosures until M2.4; staff ownership is separate from portal admin/NAS privileges. See AUTHENTICATION.md and current STATUS.md for evidence and remaining gates.

## 2026-10-06 — M2.3 membership and invitations

User “Go on” continues the authorized M2 plan. Owners issue email-bound one-use 24-hour links and manage staff membership; editors/viewers can read the team. Links are shared manually; no email provider is connected. Reserve pending invitation seats within the initial four-person workspace. Prevent removing/demoting the final active owner, revoke sessions on role/removal, preserve removed identities/work, and cancel invitations whose issuer loses owner authority. The local operator remains a separate privileged boundary.

A reinvited person proves their existing password rather than replacing the account. After independent operator identity verification, an active removed identity may recover only while a valid pending invitation from an active owner exists; recovery alone grants no membership. Serialize mutations with a bounded per-pool queue plus database workspace locks to avoid exhausting the small connection pool and preserve cross-process correctness. Keep task-role claims explicitly future-facing until authenticated task endpoints arrive. MEMBERSHIP.md records limits; final browser acceptance remains governed by STATUS.md.

## 2026-10-06 — M2.4 saved-work boundary and recovery

Authenticated Home/Boards use stored staff-workspace records; the original fixtures remain only in explicit prototype mode and sample Docs. Owner/editor task permissions are enforced on the server under the same workspace lock used for membership changes. Viewers can read. No private admin/customer access is implied.

Updates retain an original revision and reject stale writes. Create forms retain a random entity UUID so an uncertain network retry cannot create duplicates; retries return the current record rather than replaying fields. Unsaved forms/task drafts are kept only in tab memory across navigation, with explicit discard and a warning on refresh where supported. No offline queue or durable draft promise. Numeric group/task order is the initial ordering UI. See SAVED_WORK.md.

## 2026-10-06 — M2.5 custom fields and local preview isolation

Keep each board's column definitions independent. Validate values and original column revisions alongside the task revision in one transaction. Save notes and the full checklist atomically with task fields. Protect populated definitions: permit rename/order and unused status-option changes; refuse type/number-format/currency changes while values exist. No implicit data conversion or column deletion. Limits are 20 columns, 20 status options, 50 checklist items and 50,000 note characters. Initial cost currencies are EUR/USD/GBP with at most two decimal places and no exchange-rate service.

Owner/editor forms use the established dark interface, explicit Save, in-memory draft recovery and visible conflict/error states. Viewers see read-only values, notes and checklist completion. Attachments and durable Docs remain later increments.

The user requested a reusable local preview login; preserve that account, boards and user edits separately from disposable QA fixtures. Serve the Mac preview from a copied build release under ignored `.local/preview-releases` so later builds cannot replace its scripts. Verify project/process/port ownership before replacement; never stop a foreign service. This does not authorize LAN/public exposure or NAS deployment.

## 2026-10-06 — M2.6 search within authorized snapshots

For the initial small staff workspace, search/filter the existing session-verified `/api/work` snapshot in the browser. Do not add a search cluster, duplicate cache or unauthenticated endpoint. This preserves the server's current workspace boundary; integration tests apply the actual filter helper to verified owner/viewer/outsider snapshots and confirm membership removal denies subsequent reads. Larger datasets will need measured pagination/query work later.

Search literal case-insensitive title/notes text, capped at 200 characters. Combine status, one assignee/unassigned, priority and due-date scope with AND. Dates are before today/today/after today/no date using the local calendar day; completion is controlled separately by Status. Explicit Search/Apply writes URL parameters, Clear removes them, and result task links preserve them. Show eight task matches in Go to plus an all-results link; the full workspace result list is available from Boards → Find tasks. Draft filter input is not applied until submission.

## 2026-10-06 — M2.7 private task attachments

Adopt bounded raw streaming uploads to a dedicated private ATTACHMENT_ROOT, with PostgreSQL metadata and UUID storage names. Initial types are PDF, PNG/JPEG and UTF-8 TXT/Markdown/CSV, up to 25 MiB; owners/editors upload and shared staff members download. Files are forced downloads, with no inline rendering or format parsing/malware-scanning claim. Same-origin requests and fresh role/membership checks apply, including after transfer. Two upload slots per process and deadlines bound active work. Task changes and upload commits are separate; uncertain responses require refresh before retry. Uncertain database commits preserve bytes, accepting possible orphan storage rather than deleting a committed attachment. No dependency, migration, deletion UI, public/NAS deployment or full publication audit is included. See FILES.md and STATUS.md.

## 2026-10-06 — personal stellar identity prototype

User approved a literal star-like orb replacing the top-left logo/title and requested applicable design/UI skills. Prototype appearance first with an explicit slider, spatial colour transitions (0 red, 60 orange, 80 green, 100 brighter green), optional neutral state and pause control. At 75, target approximately 25% orange/75% green; texture makes the boundary organic. Do not imply these values measure real performance. The future score formula, time period and treatment of unplanned/overdue work remain undecided.

Use a small dependency-free client WebGL renderer with visibility/motion gating and a static fallback; no generated bitmap, server inference or extra service. Mobile's star retains the existing navigation-button action. Preview preferences are intentionally temporary, reset per refresh/account. This is an approved visual prototype, not finalized branding or a new M3 feature.

## 2026-10-06 — M3.1 shared views and calmer flares

User authorized progression into M3 and reduced stellar activity to one or two visible flares. Cap the shader at two loops with half-cycle staggering. Keep the star a preview, independent of task scoring.

Use built-in task status for Kanban and built-in due date for Calendar. Table retains board groups; neither alternate view changes group membership. Show undated tasks separately and count dates outside the selected month. Preserve view/month/filters in URLs. Reuse the existing task editor and Save flow for status/date changes instead of introducing a second mutation path or drag-only interaction. No live subscription until M3.2. M3.1 acceptance requires supported browser evidence; passing server/helper tests alone does not close it.

## 2026-10-06 — bounded automatic refresh and deferred browser checks

User explicitly deferred phone preview and instructed continuation into M3.2 after recording open checks. Preserve M3.1 and M3.2 browser gates in PENDING_CHECKS.md; implementation progress is not acceptance.

For the initial four-user workspace, use authorized full-snapshot polling every five seconds after completion in visible online tabs, with immediate reconnect/focus retry and bounded backoff. Reuse the existing transactional membership/session boundary; passive reads never refresh idle expiry. Avoid a broker or persistent connection service until scale requires it. Existing task revisions remain the edit-conflict authority; background updates must not overwrite drafts or clear save failures. Keep attachment lists, sample Docs and Team administration outside this polling claim. See LIVE_UPDATES.md.
