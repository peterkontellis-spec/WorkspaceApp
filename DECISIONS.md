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
