# Saved board views — M3.1

Table, Kanban and Calendar present the same authorized `/api/work` snapshot. They do not copy or independently store tasks. The board's current filters apply before tasks are mapped into a view.

- **Table** keeps the existing board groups and custom-field rows.
- **Kanban** uses the built-in To do / In progress / Done status. It does not change a task's board group or use a custom status column.
- **Calendar** uses the built-in due date, interpreted as a date without a time zone. Weeks start Monday. Undated tasks remain in a separate list; tasks outside the selected month remain saved and appear in their own month. Custom date fields do not schedule tasks.
- Subtasks remain individual stored records and are labelled with their parent; they must not be duplicated as a second task in any view.

The URL carries view, selected month, filters and opened task. Switching views or opening/closing task details preserves applicable context. Ordinary refresh reloads the stored records. M3.2 now automatically refreshes the authorized snapshot in visible online tabs approximately every five seconds after the previous read. Manual Refresh remains available. See LIVE_UPDATES.md; browser acceptance is pending.

Open a task from any view to change its status or due date in the existing editor, then choose Save task. Existing owner/editor permissions, viewer read-only details, validation, revision conflicts and in-tab draft handling remain authoritative. No drag-only editing or new write endpoint is introduced.

Acceptance evidence and any remaining gaps are recorded in STATUS.md. This document defines mapping and interaction; it does not by itself sign off the increment.
