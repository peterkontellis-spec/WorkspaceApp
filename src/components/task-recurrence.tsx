'use client';

import Link from 'next/link';
import { useId } from 'react';
import type { WorkTask, WorkRecurrence } from '@/lib/work';
import { workDate } from '@/lib/work';
import { DatePicker } from './date-picker';
import './task-recurrence.css';

export type RecurrenceDraft = {
  enabled: boolean;
  mode: WorkRecurrence['mode'];
  unit: WorkRecurrence['unit'];
  interval: string;
  timeZone: string;
  anchorDate: string;
  refreshTemplate: boolean;
};

export function recurrenceDraft(task: WorkTask): RecurrenceDraft {
  const series = task.recurrence;
  return {
    enabled: series?.enabled ?? false,
    mode: series?.mode ?? 'calendar',
    unit: series?.unit ?? 'day',
    interval: String(series?.interval ?? 1),
    timeZone: series?.timeZone ?? 'Europe/Athens',
    anchorDate: series?.anchorDate ?? task.dueDate ?? '',
    refreshTemplate: false,
  };
}

export function TaskRecurrence({
  task,
  draft: suppliedDraft,
  change,
  source,
  retainedDraft = false,
}: {
  task: WorkTask;
  draft?: RecurrenceDraft;
  change?: (draft: RecurrenceDraft) => void;
  source?: WorkTask;
  retainedDraft?: boolean;
}) {
  const id = useId();
  const series = task.recurrence;
  const generated = Boolean(series && !series.isSource);
  const draft = generated ? recurrenceDraft(task) : (suppliedDraft ?? recurrenceDraft(task));
  const editable = Boolean(change && !generated);
  const cadence = `Every ${draft.interval} ${draft.unit}${draft.interval === '1' ? '' : 's'}`;
  const patch = (values: Partial<RecurrenceDraft>) => change?.({ ...draft, ...values });
  return (
    <section className="saved-task-section task-recurrence" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>{retainedDraft ? 'Draft repetition' : 'Repeat task'}</h3>
      {editable ? (
        <label className="recurrence-choice">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) =>
              patch({
                enabled: event.target.checked,
                ...(!series && event.target.checked ? { anchorDate: task.dueDate ?? '' } : {}),
              })
            }
          />
          <span>Repeat this task</span>
        </label>
      ) : (
        <p className="recurrence-summary">
          {!series && !draft.enabled
            ? 'This task does not repeat.'
            : `${cadence}, ${draft.mode === 'calendar' ? 'on fixed calendar dates' : 'after completion'}. ${draft.enabled ? '' : 'Paused.'}`}
        </p>
      )}
      {editable && draft.enabled && (
        <div className="recurrence-controls">
          <label className="saved-task-label">
            <span>Mode</span>
            <select
              value={draft.mode}
              onChange={(event) => patch({ mode: event.target.value as RecurrenceDraft['mode'] })}
            >
              <option value="calendar">Fixed calendar dates</option>
              <option value="completion">After completion</option>
            </select>
          </label>
          <div className="saved-task-grid">
            <label className="saved-task-label">
              <span>Every</span>
              <input
                type="number"
                min={1}
                max={365}
                step={1}
                required
                inputMode="numeric"
                value={draft.interval}
                onChange={(event) => patch({ interval: event.target.value })}
              />
            </label>
            <label className="saved-task-label">
              <span>Period</span>
              <select
                value={draft.unit}
                onChange={(event) => patch({ unit: event.target.value as RecurrenceDraft['unit'] })}
              >
                <option value="day">Days</option>
                <option value="week">Weeks</option>
                <option value="month">Months</option>
              </select>
            </label>
          </div>
          <div className="saved-task-label">
            <label htmlFor={`${id}-zone`}>Time zone</label>
            <input
              id={`${id}-zone`}
              type="text"
              required
              maxLength={100}
              autoComplete="off"
              spellCheck={false}
              value={draft.timeZone}
              aria-describedby={`${id}-zone-help`}
              onChange={(event) => patch({ timeZone: event.target.value })}
            />
            <span className="saved-task-hint" id={`${id}-zone-help`}>
              Use a named time zone, such as Europe/Athens. Calendar days follow its daylight saving time.
            </span>
          </div>
          {draft.mode === 'calendar' && series && (
            <DatePicker
              label="Schedule anchor"
              value={draft.anchorDate}
              baseDate={task.dueDate ?? undefined}
              onChange={(anchorDate) => patch({ anchorDate })}
            />
          )}
          {draft.mode === 'calendar' && !series && (
            <p className="saved-task-hint">
              The schedule starts from this task’s due date: {workDate(task.dueDate)}.
            </p>
          )}
          <p className="saved-task-hint">
            {draft.mode === 'calendar'
              ? 'Keep a fixed schedule, even when a task is unfinished. One future task is prepared ahead of time. After downtime, only the latest missed date is created.'
              : 'Completing the latest task creates the next one, due after the chosen interval. Reopening an older task does not create another copy.'}
            {draft.unit === 'month'
              ? ' Short months use their last day; fixed schedules return to the original day in longer months.'
              : ''}
          </p>
          {series && (
            <label className="recurrence-choice">
              <input
                type="checkbox"
                checked={draft.refreshTemplate}
                onChange={(event) => patch({ refreshTemplate: event.target.checked })}
              />
              <span>Use current task details for future copies</span>
            </label>
          )}
          <p className="saved-task-hint">
            {series
              ? 'Future copies use the task details saved when repetition was set up, unless you update them above.'
              : 'Future copies use the task details you save now.'}{' '}
            Each starts as To do with unchecked checklist items. Subtasks, dependencies, files, time records,
            history, and date, status or link fields are not copied.
          </p>
        </div>
      )}
      {(series || draft.enabled) && (
        <p className="saved-task-hint" role="status">
          {retainedDraft
            ? 'These repetition choices have not been saved.'
            : series?.state === 'failed'
              ? 'The next task could not be created. Ask an owner to check the app. After fixing the cause, update the details for future copies or pause and re-enable repetition to retry.'
              : !draft.enabled
                ? 'Repetition is paused. Existing tasks are kept. Enable repetition and save to resume.'
                : series?.state === 'waiting'
                  ? 'Waiting for the latest task to be completed.'
                  : series
                    ? `Schedule time zone: ${series.timeZone}.${series.mode === 'calendar' && series.nextDate ? ` Next schedule date: ${workDate(series.nextDate)}.` : ''}`
                    : 'Repetition starts when you save the task.'}
          {editable && series
            ? ' Changes apply to future copies when you save; existing tasks stay as they are.'
            : ''}
        </p>
      )}
      {generated && series && (
        <>
          <p className="saved-task-hint">
            This is a separate occurrence. Editing it does not change future copies.
          </p>
          <Link
            className="recurrence-source"
            href={`/boards/${source?.boardId ?? task.boardId}?${source?.archivedAt || source?.boardArchived ? 'archived=1&' : ''}task=${series.sourceTaskId}`}
          >
            Manage original task
          </Link>
        </>
      )}
    </section>
  );
}
