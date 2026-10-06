'use client';

import { useId, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { type WorkTask, localToday, workDate } from '@/lib/work';
import { useWork } from './work-provider';
import { AssigneePicker } from './assignee-picker';
import { DatePicker } from './date-picker';
import { Button, StatusLabel } from './ui';

type QuickPatch = Partial<Pick<WorkTask, 'status' | 'priority' | 'dueDate' | 'assigneeIds'>>;
export function TaskDue({ task }: { task: WorkTask }) {
  const overdue = Boolean(task.dueDate && task.dueDate < localToday() && task.status !== 'Done');
  return (
    <span className={overdue ? 'saved-due saved-due--overdue' : 'saved-due'}>
      {overdue && <strong>Overdue · </strong>}
      {task.dueDate === localToday() ? 'Today' : workDate(task.dueDate)}
    </span>
  );
}

/** One explicit mutation at a time. A failed selection retains its original revision. */
export function SavedQuickFields({ task, statusOnly = false }: { task: WorkTask; statusOnly?: boolean }) {
  const work = useWork();
  const dateId = useId();
  const dateMenu = useRef<HTMLDivElement>(null);
  const dateTrigger = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const cacheKey = `quick:${task.id}`;
  const attempt = (work.drafts[cacheKey] as { patch: QuickPatch; revision: number } | undefined) ?? null;
  const setAttempt = (value: { patch: QuickPatch; revision: number } | null) =>
    work.setDraft(cacheKey, value);
  const [failed, setFailed] = useState(Boolean(attempt));
  const [dateVersion, setDateVersion] = useState(0);
  const canEdit = work.data?.actor.role !== 'viewer' && !task.archivedAt && !task.boardArchived;
  const value = { ...task, ...(attempt?.patch ?? {}) };
  const disabled = work.pending || Boolean(attempt) || Boolean(work.drafts[`task:${task.id}`]);
  async function change(patch: QuickPatch, revision = task.revision) {
    if (inFlight.current || work.pending) return;
    inFlight.current = true;
    setAttempt({ patch, revision });
    setFailed(false);
    const ok = await work.save({ action: 'updateTask', id: task.id, revision, patch });
    if (ok) setAttempt(null);
    else setFailed(true);
    inFlight.current = false;
  }
  const status = canEdit ? (
    <select
      aria-label={`Status for ${task.title}`}
      className={`quick-status status--${value.status === 'Done' ? 'done' : value.status === 'In progress' ? 'progress' : 'todo'}`}
      value={value.status}
      disabled={disabled}
      onChange={(e) => void change({ status: e.target.value as WorkTask['status'] })}
    >
      {['To do', 'In progress', 'Done'].map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  ) : (
    <StatusLabel status={task.status} />
  );
  return (
    <div
      role={statusOnly ? undefined : 'presentation'}
      className={statusOnly ? 'saved-quick saved-quick--card' : 'saved-quick'}
      aria-busy={Boolean(attempt && !failed)}
    >
      <div role={statusOnly ? undefined : 'cell'}>{status}</div>
      {!statusOnly && (
        <>
          <div role="cell" className="saved-quick-owner">
            {canEdit ? (
              <AssigneePicker
                people={work.data?.members}
                value={value.assigneeIds}
                taskTitle={task.title}
                disabled={disabled}
                onChange={(assigneeIds) => void change({ assigneeIds })}
              />
            ) : (
              <span>
                {task.assigneeIds
                  .map((id) => work.data?.members.find((m) => m.id === id)?.name)
                  .filter(Boolean)
                  .join(', ') || 'Unassigned'}
              </span>
            )}
          </div>
          <div role="cell" className="saved-quick-date">
            {canEdit ? (
              <>
                <button
                  type="button"
                  ref={dateTrigger}
                  className="quick-date-trigger"
                  popoverTarget={dateId}
                  disabled={disabled}
                  aria-label={`Due date for ${task.title}`}
                >
                  <TaskDue task={value} />
                  <CalendarDays size={16} aria-hidden="true" />
                </button>
                <div
                  ref={dateMenu}
                  id={dateId}
                  popover="auto"
                  className="quick-date-popover"
                  onToggle={(event) => {
                    if (event.newState === 'open') setDateVersion((value) => value + 1);
                  }}
                >
                  <DatePicker
                    key={dateVersion}
                    label={`Due date for ${task.title}`}
                    value={value.dueDate ?? ''}
                    baseDate={localToday()}
                    initiallyOpen
                    onDismiss={() => {
                      dateMenu.current?.hidePopover();
                      dateTrigger.current?.focus({ preventScroll: true });
                    }}
                    onChange={(dueDate) => {
                      dateMenu.current?.hidePopover();
                      void change({ dueDate: dueDate || null });
                    }}
                  />
                </div>
              </>
            ) : (
              <TaskDue task={task} />
            )}
          </div>
          <div role="cell">
            {canEdit ? (
              <select
                aria-label={`Priority for ${task.title}`}
                value={value.priority}
                disabled={disabled}
                onChange={(e) => void change({ priority: e.target.value as WorkTask['priority'] })}
              >
                {['Low', 'Medium', 'High'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            ) : (
              <span>{task.priority}</span>
            )}
          </div>
        </>
      )}
      {attempt && !failed && (
        <span className="quick-feedback" role="status">
          Saving…
        </span>
      )}
      {failed && attempt && (
        <div className="quick-feedback" role="alert">
          <p>
            Could not confirm this change. Your selection is kept. Reload saved work before retrying an
            uncertain save; conflicting changes are never overwritten.
          </p>
          <Button disabled={work.pending} onClick={() => void change(attempt.patch, attempt.revision)}>
            Retry selection
          </Button>
          <Button
            variant="ghost"
            disabled={work.pending}
            onClick={() => {
              setAttempt(null);
              setFailed(false);
              work.clearError();
            }}
          >
            Discard selection
          </Button>
        </div>
      )}
      {Boolean(work.drafts[`task:${task.id}`]) && (
        <span className="quick-feedback">Finish the open draft to use quick edits.</span>
      )}
    </div>
  );
}
