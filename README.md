# Workspace app — how to work on this project

A local workspace app for four collaborators. M1's prototype and M2's saved-data foundation are accepted locally. M3.1–M3.3 add saved board views, polling, activity and in-app notifications; see [STATUS.md](STATUS.md) for current verification and [PENDING_CHECKS.md](PENDING_CHECKS.md) for the remaining acceptance work.

## Run and verify

Use the configured Node/pnpm runtime. [RUNNING.md](RUNNING.md) explains local database/account setup and the private preview. `pnpm preview` runs a copied production build at http://127.0.0.1:3100 and preserves existing application data.

- `pnpm check`: type checking, behavior tests and a production build.
- `pnpm check:smoke`: HTTP checks against the running preview; use the private credential-file configuration in RUNNING.md.
- `pnpm test:db`: isolated PostgreSQL behavior, authorization and recovery tests.
- `pnpm test:e2e`: isolated browser regression suite against the latest production build. Setup and coverage: [E2E_TESTING.md](E2E_TESTING.md).
- `pnpm format:check`: source formatting check. `pnpm check:all` runs formatting, build/behavior, database and browser suites in sequence.

Automated browser checks complement manual visual, keyboard and physical-phone inspection. They do not establish NAS performance or publication readiness. No hosted CI service or daily automation is configured.

## Continue work

1. Read [AGENTS.md](AGENTS.md), [STATUS.md](STATUS.md) and the relevant increment in [SESSION_CHECKLIST.md](SESSION_CHECKLIST.md).
2. Implement one bounded result, preserving user data, permissions, drafts and revision checks.
3. Run the required per-task self-check loop, fix verified failures and record exactly what passed or remains open.
4. Save a Git checkpoint; exclude credentials, database files, attachments and private test artifacts.

The approved Mineral light / Midnight dark themes and star are the visual baseline. Accounts-mode Docs is a storage-pending placeholder; durable collaborative Docs remains later work after NAS configuration is settled. Prototype mode retains its sample editor.

## Where information lives

| Document | Use |
| --- | --- |
| [BRIEF.md](BRIEF.md) | Goal, scope, constraints, and current delivery target |
| [PLANNING.md](PLANNING.md) | Existing detailed requirements and proposed architecture |
| [DESIGN_SPEC.md](DESIGN_SPEC.md) | M1.1 screen map, selected design direction, and prototype interaction brief |
| [RUNNING.md](RUNNING.md) | Start the local preview and inspect its source |
| [MILESTONES.md](MILESTONES.md) | Five delivery stages and acceptance checks |
| [SESSION_CHECKLIST.md](SESSION_CHECKLIST.md) | Before-session routine and 35 small delivery increments |
| [STATUS.md](STATUS.md) | Current progress, evidence, and next action |
| [DECISIONS.md](DECISIONS.md) | Confirmed decisions, proposals, and reasons |
| [AGENTS.md](AGENTS.md) | How the main assistant and specialists work |
| [HANDOFF.md](HANDOFF.md) | Move the work to another chat |
| [HANDOFF_REPORT.md](HANDOFF_REPORT.md) | Compact conversation summary, implementation checkpoint, and exact next task |

## Useful requests

- “Show the current milestone, what is working, and what remains.”
- “Use a reviewer subagent to check this implementation against the milestone criteria. Fix and verify actionable findings.”
- “Record this scope change and explain its effect on the remaining work.”
- “Prepare the project handoff for a new Work chat.”

Keep one authoritative project copy and one coordinating chat. Work in the app project; the generic ai-workflow folder remains a template for other projects. Subagents run only during assigned work, not continuously. This setup creates no scheduled automation and does not connect external accounts.

Keep a durable copy of the project outside any regenerated mirror before relying on it as your only development location. Before code development grows, version the active project in a repository and maintain backups; never commit secrets or production data.

Instruction behavior reference: [OpenAI project instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md). Delegation reference: [OpenAI subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
