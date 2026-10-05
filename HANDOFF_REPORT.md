# Workspace app — current conversation checkpoint

Saved: **2026-10-06**, before browser-policy diagnostics. This is a durable project checkpoint, not a claim that internal conversation compaction occurred. Read STATUS.md for detailed test evidence. October 5 ZIPs remain historical snapshots.

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
- Earlier 2–3 weeks for a core / 2–3 months for full scope were rough calendar estimates assuming sufficient allowance and working tools. Re-estimate after measured backend sessions; do not promise completion against the subscription budget.

## New ideas — proposals, not implementation approval

- Private email briefing for each admin: rank Urgent / Action needed / Informational / Low priority / Suspected junk, explain ranking, show source links and summarize when asked. Proposed first version is read-only; each admin's mailbox remains separate unless shared explicitly. Email provider is unknown.
- Mobile meeting/task alerts through Web Push, with quiet hours and configurable reminders. iPhone Home Screen web apps can receive push with user permission; no App Store submission or paid developer membership is required. Delivery uses platform push infrastructure. SMS is an optional paid alternative, not enabled.
- Local NAS helper with optional heavier-task handoff remains a future proposal. No model, external AI integration, credentials or spend configured. Benchmark local inference separately from the four-GB app design budget.

## Immediate next action

User explicitly requested: answer weekly-usage question, save this checkpoint, then troubleshoot the intermittent browser-policy issue now. Diagnose supported browser access and local app reachability separately. Do not change security policies, switch origins/control paths to evade denial, or claim the app can fix a host policy-verification failure.

Supported browser sometimes works, then reports: “The admin-enforced policy could not be verified.” An earlier suggested Settings → Browser permission UI was not visible to this user; do not repeat that path as verified for their app. The cause is not established.

After access is restored, remaining acceptance includes refresh/close warning, physical phone/software keyboard, full screen/viewport coverage, and exact task→Doc→task filter/collapse/scroll preservation. Reuse existing evidence for calendar, mobile preview and reset checks unless code changes justify repetition.

## Working-tree caution

Pre-existing security-planning edits in BRIEF.md, DECISIONS.md and STATUS.md, plus untracked SECURITY_CHECKLIST.md, came from a parallel discussion. Preserve them. They were not included in checkpoint 397af19; do not call the entire working tree remotely backed up.

## Continue after compaction

Read this file, AGENTS.md and STATUS.md; then diagnose browser access within the user's project scope and no-spend constraints. Do not restart planning or repeat completed implementation. Consult RUNNING.md for preview commands and SESSION_CHECKLIST.md/MILESTONES.md for remaining acceptance.
