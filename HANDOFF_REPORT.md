# Workspace app — current conversation checkpoint

Saved: **2026-10-06**, with browser-policy diagnostic results. This is a durable project checkpoint, not a claim that internal conversation compaction occurred. Read STATUS.md for detailed test evidence. October 5 ZIPs remain historical snapshots.

## Current state

- Working folder: `/Users/peterkontellis/.codex/.chatgpt-projects/g-p-6a0f76716e988191962260a53dc7ed97/workspace-app`.
- GitHub: https://github.com/peterkontellis-spec/WorkspaceApp.git. Latest implementation checkpoint **397af19** was pushed to main.
- M1.2–M1.5 implemented as session-only sample data. M1.6 refinements and review underway; Stage 1 remains open. M2 backend work has not started.
- Shell/Home, editable boards, task notes/checklists/subtasks and linked Markdown Docs work in the prototype. Refresh/tab closure clears demo edits.
- Fixed embedded native-calendar crash with an in-page calendar; verified date selection, Save/Cancel, month/year keyboard navigation, Clear and Escape.
- Verified mobile Preview, nested bold/italic links, inert unsafe markup, empty document state and Assistant · Later on desktop/mobile. Assistant is a placeholder, not a connected AI service.
- Reset demo now uses an in-page confirmation. Cancel/Escape preserve edits; explicit Reset sample data restores sample records. The earlier native popup appeared to the user while browsing settings; it affected temporary prototype data only. Warn before tests that may present browser/system prompts.
- Last full validation: TypeScript, **20 tests**, production build and **16 HTTP checks** passed. Supported browser evidence is recorded in STATUS.md. A Next.js development profiler error on a not-found route did not reproduce in the production preview.
- Preview: `http://127.0.0.1:3100/home`. Last started using the standalone production server; verify current lifetime rather than assuming it is running.

## User constraints and cadence

- Work only in the project workspace; preserve unrelated changes and read-only synced sources. No NAS/public deployment without specific approval.
- Preserve dark/subtle design, larger controls, equal phone/desktop emphasis, four collaborators, NAS-owned data and customer/admin privacy boundaries.
- Save meaningful Git checkpoints and push to the existing repository; never rewrite published history.
- Self-check after each meaningful task/session: inspect, test, run UI/design review, fix verified failures, reassess next step, record gaps. No daily automation.
- User can work **two hours per day**. Their question about resource intensity meant **weekly Codex usage**, not NAS RAM.
- No purchases, credits or usage-reset redemption. Snapshot: **24% used / 76% remaining**, reset **11 October 2026 at 09:59 Europe/Athens**. Limits are account-wide, not attributable to this task alone.
- Suggested planning budget: about 8–10 percentage points per session, measured before/after bounded batches; this is not a usage forecast or guaranteed hard cap. Keep reserve and pause before allowance exhaustion. Avoid redundant rereads, duplicate agents and repeated already-passed tests without cause.
- Theoretical allowance estimate given to the user: roughly 4–9 full weekly allowances for the original full scope, with 1–2 of those for the persistent foundation. This is a low-confidence planning scenario derived from assumed sessions and budget per session, not measured consumption or a guarantee; email/local-AI additions are extra. Recalibrate using actual sessions.
- Earlier 2–3 weeks for a core / 2–3 months for full scope were rough calendar estimates assuming sufficient allowance and working tools. Re-estimate after measured backend sessions; do not promise completion against the subscription budget.

## New ideas — proposals, not implementation approval

- Private email briefing for each admin: rank Urgent / Action needed / Informational / Low priority / Suspected junk, explain ranking, show source links and summarize when asked. Proposed first version is read-only; each admin's mailbox remains separate unless shared explicitly. Email provider is unknown.
- Mobile meeting/task alerts through Web Push, with quiet hours and configurable reminders. iPhone Home Screen web apps can receive push with user permission; no App Store submission or paid developer membership is required. Delivery uses platform push infrastructure. SMS is an optional paid alternative, not enabled.
- Local NAS helper with optional heavier-task handoff remains a future proposal. No model, external AI integration, credentials or spend configured. Benchmark local inference separately from the four-GB app design budget.

## Immediate next action (historical browser diagnosis)

User explicitly requested: answer weekly-usage question, save this checkpoint, then troubleshoot the intermittent browser-policy issue now. Diagnose supported browser access and local app reachability separately. Do not change security policies, switch origins/control paths to evade denial, or claim the app can fix a host policy-verification failure.

Supported browser sometimes works, then reports: “The admin-enforced policy could not be verified.” An earlier suggested Settings → Browser permission UI was not visible to this user; do not repeat that path as verified for their app. The cause is not established. On this retry, inspection worked but navigation failed because no preview server was listening. Restarted the existing standalone production build on loopback in its own process session (log: `.git/preview-server.log`); no system service/autostart was installed. Recovered from the generated connection-error data URL by opening the original local origin in a fresh tab of the same supported browser. Home → Website refresh → Home passed, with no captured browser warnings/errors. The preview is restored for now; neither long-term server lifetime nor a permanent policy fix is established. No security permissions changed.

### Explicit site approval verified — 2026-10-06

A subsequent read of the existing diagnostic tab was rejected by automatic approval review: it interpreted site access as potentially changing origin permissions without explicit authorization. This was a distinct rejection from the earlier inability to verify admin policy. After the risk explanation, the user explicitly approved browser access to `http://127.0.0.1:3100`. Retrying the same tab through the same supported tool succeeded. Home → Launch brief → Preview and a clean page refresh all passed; captured browser warnings/errors were empty. The user's separate preview tab was not manipulated. No browser protections were disabled, no configuration files were changed, and no alternate control path was used. Current access denial is resolved; the earlier intermittent verification error was not reproduced and is not proven permanently fixed. No further user settings change is needed now. The clean refresh did not test the unsaved-changes warning.

With access currently restored, remaining acceptance includes refresh/close warning, physical phone/software keyboard, full screen/viewport coverage, and exact task→Doc→task filter/collapse/scroll preservation. Reuse existing evidence for calendar, mobile preview and reset checks unless code changes justify repetition.

## Working-tree caution

Pre-existing security-planning edits in BRIEF.md, DECISIONS.md and STATUS.md, plus untracked SECURITY_CHECKLIST.md, came from a parallel discussion. Preserve them. They were not included in checkpoint 397af19; do not call the entire working tree remotely backed up.

## Pre-M2 reconciliation — 2026-10-06

**Handoff position:** M1.2–M1.5 are implemented and the core journeys have browser evidence. M1.6/Stage 1 remain formally open for the explicit gaps below. M2 has not started. The coherent screen structure supports M2.1 architecture/data planning now; do not describe M1 as fully accepted or silently discard these checks.

Additional checks in the supported in-app browser at its default **1165 × 814** viewport:
- Filtered Website refresh to Sam, collapsed Next, opened Gather content references → Content outline → Back to task → Escape. Filter and collapsed state survived; page scroll was **436.5 px before and after**, and settled focus returned to Gather content references. No captured browser warnings/errors. This establishes one desktop return-state case, not the full device/history matrix.
- Home's new-collaborator preview showed an explanatory empty state and a shared-boards link. Unchecking restored assigned tasks; sample boards remained present.
- Entered temporary text in the diagnostic Launch brief, then requested refresh. The text remained; the browser exposed no JavaScript dialog and its screenshot contained no warning. The reload/close warning is **inconclusive**, not passed. Do not rely on this warning to protect real work. Only diagnostic-tab sample state was changed; the user's separate browsing tab was untouched.
- Scoped source/UI review used Impeccable and the fetched Web Interface Guidelines for navigation, shared dialog and unload handling. Visible keyboard focus, semantic links/labels, dark tokens and modal scroll containment were present; detector returned `[]`. No new confirmed source defect in this scope; warning verification remains a gap. No global accessibility/performance score or physical-phone coverage is claimed. No application code changed, so the existing 20-test/build/16-HTTP results were retained rather than rerun.

### Open register to carry into M2

| Item | State and next action |
| --- | --- |
| Unsaved refresh/close warning | Inconclusive in the embedded browser. Perform a user-observed refresh/cancel/leave and tab-close check with disposable text; record actual dialog and retained/lost text. Warn before prompts. |
| Responsive/keyboard coverage | Existing 360/390/1024/1440 evidence is partial. Finish screen-by-screen Home, both boards, Docs lists/editors, task panels and dialogs; verify focus/Tab/Shift+Tab and 200% zoom. Do not infer a full matrix from one screenshot. |
| Return-state matrix | Desktop filtered/collapsed/scrolled task→Doc→task now passes. Confirm the corresponding narrow-layout and browser Back/Forward variants; prior Home and history tests remain valid but are not every combination. |
| Physical phone/software keyboard | Untested. Requires an authorized phone-accessible test setup; current 127.0.0.1 link is only on this Mac. No LAN/NAS/public exposure was enabled. |
| Native warning/tool behavior | Native Reset confirmation was replaced and verified in-page. Browser-owned unload warning remains separate; do not reintroduce native date picker or reset confirmation. |
| Next.js development profiler | Negative-time `performance.measure` error on not-found route in dev remains unresolved; same production build/recovery passed. Reproduce in an isolated dev session before choosing a dependency fix. |
| Browser policy / preview lifetime | Explicit local-site approval restored current access. Earlier intermittent verification failure remains unproven; preview is a local process, not an installed managed service. Recheck server and browser separately if it returns. |
| Security-planning drafts | BRIEF.md, DECISIONS.md and STATUS.md contain pre-existing planning edits; SECURITY_CHECKLIST.md is untracked. Preserved locally, not included in this checkpoint. Review and checkpoint separately before a repository-only handoff. All security controls are unimplemented/unverified. |
| M2 scope/model decision | Reconcile internal owner/editor/viewer roles with the separate proposed admin/customer-folder boundary before schema/auth decisions. Customer count and access actions are unresolved; four staff is not a measured customer capacity. |
| Future ideas | Assistant is a disabled placeholder. NAS AI, heavy-task routing, admin email ranking and mobile push are proposals, not implemented or silently added to M2. |

**Next session: Q:M2 / M2.1.** Read AGENTS.md, this section, HANDOFF_REPORT.md, BRIEF.md, DECISIONS.md and the local SECURITY_CHECKLIST.md. Choose and document the database/authentication approach against NAS constraints, define the access matrix and schema, then deliver one local save/read/restart/migration slice with tests. Preserve design and carried M1 checks; no deployment, purchases, credits or resets. Latest usage snapshot: **27% used / 73% remaining** account-wide.

## Continue after compaction

Read this file, AGENTS.md and STATUS.md; then start Q:M2 / M2.1 planning while preserving the open M1 register within the user's project scope and no-spend constraints. Do not restart planning or repeat completed implementation. Consult RUNNING.md for preview commands and SESSION_CHECKLIST.md/MILESTONES.md for remaining acceptance.
