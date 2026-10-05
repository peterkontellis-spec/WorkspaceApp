# Workspace app — how to work on this project

The AI workflow is integrated into this folder. No agent server or API setup is required to use it in this chat. The M1.2 application shell is implemented locally, with browser verification still pending. See [RUNNING.md](RUNNING.md) to open or restart it.

Every implementation task/session now follows the required self-check loop in [AGENTS.md](AGENTS.md): run and test the app, review relevant design/UI skills, fix verified issues, confirm results, and reassess the next action. `pnpm check` and `pnpm check:smoke` cover build and HTTP checks; browser acceptance remains a separate required step. No daily automation is configured.

## Your normal workflow

Before each session, open [SESSION_CHECKLIST.md](SESSION_CHECKLIST.md). It breaks the five milestones into 35 increments with deliverables, completion criteria, and reusable opening/closing routines. Use STATUS.md to find the current position; the checklist is the delivery roadmap.

1. Start or continue a chat with access to this workspace-app folder. In Codex, working from this directory allows its AGENTS.md to be discovered; in an existing or hosted chat, explicitly ask the assistant to read it.
2. State the result you want. You can simply ask: “Use the workspace-app workflow and implement the next task in the current milestone.” For the first prototype, provide design direction or use the starter below.
3. The main assistant reads current status, selects a bounded task, implements it, delegates useful independent work, and checks the result. You do not need to manage each specialist separately.
4. Review the actual preview or delivered artifact. Give concrete feedback; the assistant fixes it and updates the status and decisions.
5. Resume with “Continue the workspace app from STATUS.md.” For a different chat, use HANDOFF.md and provide the latest project files.

## Start the first prototype

M1.1 is recorded in [DESIGN_SPEC.md](DESIGN_SPEC.md). The chosen direction is dark with subtle accents, equal desktop/phone focus, and larger controls. M1.2 is implemented; complete its pending browser checks before calling the increment complete. Use STATUS.md for one increment at a time, or use this broader prompt when you want the whole M1 prototype:

> Use the workspace-app workflow and DESIGN_SPEC.md. Continue M1 using the selected dark design with subtle accents, equal desktop/phone focus, and larger controls. Build a local, reviewable prototype of the shell, Home, grouped task board, task detail panel, and Docs screen using sample data. Make the main navigation and demonstrated interactions work. Use subagents where independent work helps, verify desktop and narrow layouts, and update STATUS.md with the preview, checks, and next action. Keep sample behavior clearly distinguished from server persistence. Do not deploy to my NAS yet.

Add any further visual references or changes to the existing design direction when starting the next increment.

## Where information lives

| Document | Use |
| --- | --- |
| [BRIEF.md](BRIEF.md) | Goal, scope, constraints, and current delivery target |
| [PLANNING.md](PLANNING.md) | Existing detailed requirements and proposed architecture |
| [DESIGN_SPEC.md](DESIGN_SPEC.md) | M1.1 screen map, selected design direction, and prototype interaction brief |
| [RUNNING.md](RUNNING.md) | Start the local prototype, source guide, and pending browser checks |
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
