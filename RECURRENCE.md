# Recurring tasks

M4.3 behavior confirmed on 9 October 2026. See STATUS.md for executed checks and remaining acceptance gates.

## Rules people can choose

Owners/editors configure repetition on the original task and save it with the usual task revision. Viewers see the saved rule. A task starts with repetition off. Both modes support an integer interval of 1–365 days, weeks or months and a named timezone, initially Europe/Athens.

- **Fixed calendar dates:** the original due date is the first occurrence and initial anchor. Keep at most one future occurrence prepared so day-before reminders can work. After downtime, create only the latest missed date plus one future occurrence when needed. Older missed dates are skipped, and existing records are retained. Monthly dates derive from the original anchor: 31 January → 28/29 February → 31 March.
- **After completion:** the latest occurrence's first committed transition into Done queues one successor immediately. Its deadline is the actual completion's local date plus the interval. Reopening/recompleting an old occurrence cannot create another successor. Distinct tasks completed on the same day can legitimately produce distinct successors with the same deadline. Configuring an already completed original does not invent a completion event; a future real reopen→Done transition is needed.
- **Pause/resume:** turn repetition off and save. Existing tasks remain independent. Archiving the original or its board persistently pauses repetition; restoring it does not resume automatically. Archiving a generated occurrence alone does not stop the series. A genuine completion queued while paused remains durable until explicit resume.
- **Change a schedule:** changes affect future creation only. Existing generated tasks and occurrence identities remain. A prepared future task survives a schedule edit and prevents a second future task until its scheduled date passes. Same-mode completion edits recalculate an already queued deadline from its original completion time; switching modes discards an incompatible pending queue.

## What a new task copies

The first setup freezes one task's title, notes, priority, assignee IDs, extra reminder choices, checklist labels, and text/number custom fields. Future tasks start as standalone To do tasks in the captured board/group with a new due date and unchecked checklist items. Only currently enabled workspace members among the captured assignees are assigned.

Subtasks, parent links, dependencies, files, time records, historical activity, and date/status/link custom fields are not copied. Template-library behavior is unchanged; template copies are not recurring. Editing a generated occurrence changes only that task. On the original, “Use current task details for future copies” explicitly refreshes the recipe from the fields saved in the same transaction. Ordinary edits do not silently refresh it. Existing copies remain untouched.

Generated tasks show their rule and a link to the original. Creation activity is attributed to **Recurrence**, not a fabricated human edit. Assigned members receive the existing in-app assignment notification. Reminder scheduling follows the normal [Athens reminder rules](JOBS.md), independently of the recurrence timezone.

## Durability and failure behavior

Migration012 adds the series and permanent occurrence ledger. Calendar occurrence keys use the scheduled date; completion keys use the predecessor task ID. Generation, copied fields, assignment notifications and schedule advancement commit atomically under the shared workspace/account locking protocol. Worker progress does not increment the original task's revision or overwrite a draft. The shared 30-second worker processes recurrence before reminder reconciliation; browser tabs need not stay open.

One series creates at most two tasks in a tick; at most 50 series are examined per tick. Failures roll back the series transaction effects and retry up to five times with bounded exponential delay. Exhausted series remain visible and make job readiness unavailable. After correcting the cause, explicitly refresh the future-copy recipe, change the schedule, or pause/save and re-enable/save to reset retries. An ordinary unchanged save does not reset an exhausted series. Changed/missing copied custom-column definitions fail visibly rather than silently dropping the intended data. Logs contain counts and fixed error codes, not task contents or credentials.

Calendar calculations use date-only arithmetic and named-zone local dates, not repeated 24-hour elapsed durations. Runtime process restarts and concurrent workers must preserve duplicate prevention. Populated backup restoration, NAS installation/memory measurement, physical devices and the full pre-publication security audit remain separate release gates.
