# Workspace app — working instructions

## Context and scope

For substantive work, read BRIEF.md and STATUS.md. Use PLANNING.md for detailed requirements, MILESTONES.md for acceptance criteria, and DECISIONS.md when a decision affects the task. Do not read every document again for a minor edit.

PLANNING.md is the existing planning baseline. Preserve its confirmed scope. Proposed technology choices are not installed or final merely because they appear in the plan. Latest user instructions take precedence; record changes and distinguish confirmed decisions from working assumptions. Preserve synced reference material and unrelated projects.

This is a self-hosted app for up to four collaborators on a UGREEN DXP2800, with an approximate 4 GB RAM design budget. Keep application data and collaborative documents on the NAS. Google Drive must not be required. All confirmed features remain in scope across incremental milestones.

## Main assistant and task execution

The main assistant owns the plan, shared records, integration, and result. Select one coherent task within the active milestone, define an observable output and checks, implement it, and verify it before marking it complete. Choose routine reversible implementation details within the user's request; ask only about consequential missing decisions. Advance authorized work without seeking repeated permission for routine steps.

Do not silently expand into optional comments, mentions, private boards, or inbox features. Visual identity, product name, network setup, and backup retention remain open decisions. Use provisional design only when the current task permits it; label it as provisional.

## Specialist agents

Delegate concrete independent subtasks when parallel work materially helps; prefer at most two specialists concurrently within available limits. Use the current model settings. Roles are assignments to available subagents, not separate installed services:

- Explorer: inspect existing code or current primary documentation; return relevant findings and uncertainty.
- Builder: implement a bounded task within explicitly assigned files; return changes and check results.
- Reviewer: read the actual output and acceptance criteria; return actionable issues with evidence. Read-only unless assigned fixes.

Each assignment includes objective, input files, permitted edit scope, deliverable, dependencies, and verification. Use exclusive file ownership. Only the main assistant edits BRIEF.md, STATUS.md, MILESTONES.md, and DECISIONS.md. A specialist proposes record updates instead. Integrate required results before dependent work. Do not create separate user-visible tasks unless requested. If delegation is unavailable, proceed sequentially and disclose that.

## Checks and delivery

### Required self-check loop — every task and session

User instruction confirmed 2026-10-05: perform this loop after each meaningful implementation batch and before closing a task/session. No daily automation is requested. Batch related edits; do not run a full review after every tool call or trivial edit.

1. Define the observable result and relevant milestone acceptance checks before implementation. Use DESIGN_SPEC.md and the user's latest preferences as design authority.
2. Implement the bounded change, then inspect the actual changed files for correctness, scope drift, edge cases, and misleading prototype behavior.
3. For application changes, run `pnpm check` (typecheck, behavioural tests and production build), start or reuse the local server, and run `pnpm check:smoke`. Add or run targeted behavioral tests where the change warrants them. HTTP checks verify server responses only; they do not prove client behavior, layout, focus, or accessibility. Documentation-only changes need link/content consistency checks, not a redundant build.
4. For UI changes, actually exercise the changed journey in the supported browser. Inspect desktop and narrow layouts, keyboard/focus, dialogs, empty/error states, console/runtime errors where available, and navigation/refresh as relevant. For shell changes use the full RUNNING.md checklist. Record viewport/device and evidence; emulated phone layouts do not establish physical phone or software-keyboard behavior.
5. Apply the installed Impeccable skill for scoped design/UX review and Web Design Guidelines for interface/accessibility review. Read their current SKILL.md instructions and required references; fetch current interface guidelines. Apply React best practices for React/Next.js implementation changes. Review hierarchy, readable density, contrast, overflow, touch targets, focus and honest state messaging against the established dark/subtle design. Skills guide review; a detector pass is not visual verification. If a skill/tool is unavailable, record the missing review explicitly.
6. Fix verified in-scope failures, then rerun the affected checks. Use one batched desktop/mobile inspection and one confirmation pass for routine visual polish. Continue for concrete correctness failures or regressions, not indefinite aesthetic refinement. If required checks remain blocked or fail, leave the increment open and report the exact gap; never convert an untested check into a pass or bypass tool/security restrictions.
7. Reassess the next action from the results, dependencies and current milestone. Fix blockers before expanding features. Update STATUS.md and relevant SESSION_CHECKLIST.md boxes with the commands/results, browser/design evidence, unresolved issues and one concrete next action. Record material decisions in DECISIONS.md. Close only the scope whose required checks actually passed; a session can end with the feature explicitly incomplete.

This is a project instruction followed by the assistant, not a background watcher or an automatically enforced browser-test suite. Never imply unattended checks happened.

Verify behavior proportionately. For code, discover actual project commands after scaffolding; do not invent successful build or test results. For UI work, inspect desktop and narrow layouts, keyboard interaction, and whether controls work. For persistent features, check data survives refresh/restart. For multi-user work, test authorization on the server and competing updates. MILESTONES.md specifies later checks.

At meaningful progress points and before a handoff, update STATUS.md with delivered outputs, actual check results, blockers, and one next action. Record consequential decisions with rationale in DECISIONS.md. Keep the records concise. A mockup is not a completed backend feature; a plan is not an implementation; an untested check is not a pass.

Prepare NAS deployment incrementally. Changing live infrastructure or granting external access requires authorization for that action; a local prototype request does not authorize deployment. Respect existing environment permissions. Do not record secrets in project documents.

## Git checkpoints and current handoff

User authorization on 2026-10-05: implement M1.2 through M1.5, commit and push a checkpoint after each meaningful step to https://github.com/peterkontellis-spec/WorkspaceApp.git. Work only in this project workspace; do not move the project or modify unrelated files. Preserve the current design. No purchases, credits, reset redemption or NAS deployment. Check account usage at milestones and stop with a checkpoint before exhausting the allowance.

Keep a baseline and incremental commits; never force-push or rewrite published checkpoints. Include source, specifications and actual test results; exclude secrets, dependencies, generated builds and production data. Use progress wording when required checks are pending. A blocked push must be reported; local commits are still checkpoints but are not a remote backup. Repository-local author is Workspace Checkpoint Agent <checkpoint@localhost> until the user supplies a preferred Git identity.

The current explicit M1.2–M1.5 handoff authorizes implementation while browser tooling remains blocked. This supersedes the earlier sequencing instruction to stop feature implementation at M1.2, but not the acceptance gate: every affected increment remains browser-verification-pending until real supported browser checks pass.

User continuation on 2026-10-05 authorises M1.6 review/refinements, assistant-run checks, native date-picker troubleshooting/replacement, mobile Docs preview fixes and an Assistant · Later navigation placeholder. Preserve the existing per-step Git checkpoint authority and no-spend/no-deployment constraints. AI integration itself remains a discussion, not an enabled service.
