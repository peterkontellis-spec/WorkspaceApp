'use client';

import { useId } from 'react';
import type { WorkTask } from '@/lib/work';
import './task-reminders.css';

type ReminderChoices = { reminderBefore: boolean; reminderAfter: boolean };
type Props = {
  task: Pick<
    WorkTask,
    'dueDate' | 'assigneeIds' | 'status' | 'archivedAt' | 'boardArchived' | 'reminderActive'
  >;
  before: boolean;
  after: boolean;
  change?: (choices: Partial<ReminderChoices>) => void;
};

export function TaskReminders({ task, before, after, change }: Props) {
  const id = useId();
  const paused = task.status === 'Done' || task.archivedAt || task.boardArchived;
  return (
    <section className="saved-task-section task-reminders" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>Deadline reminders</h3>
      <p className="reminder-default">On the due date at 09:00 Athens time.</p>
      <p className="saved-task-hint" id={`${id}-help`}>
        In-app notifications for everyone assigned to this task. All reminder times follow Athens daylight
        saving time.
      </p>
      {change ? (
        <fieldset className="reminder-options" aria-describedby={`${id}-help`}>
          <legend>Additional reminders</legend>
          <label>
            <input
              type="checkbox"
              name="reminder-before"
              checked={before}
              onChange={(event) => change({ reminderBefore: event.target.checked })}
            />
            <span>
              One day before <small>09:00 Athens</small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              name="reminder-after"
              checked={after}
              onChange={(event) => change({ reminderAfter: event.target.checked })}
            />
            <span>
              One day overdue <small>09:00 Athens</small>
            </span>
          </label>
        </fieldset>
      ) : (
        <p className="saved-task-hint">
          Additional reminders:{' '}
          {before && after
            ? 'one day before and one day overdue'
            : before
              ? 'one day before'
              : after
                ? 'one day overdue'
                : 'none'}
          .
        </p>
      )}
      <p className="saved-task-hint" role="status">
        {paused
          ? 'Completed and archived tasks do not send reminders.'
          : !task.dueDate
            ? 'Choose a due date to schedule reminders.'
            : task.reminderActive === false
              ? 'This older deadline is not scheduled. Change its date or enable an additional reminder to start reminders.'
              : !task.assigneeIds.length
                ? 'Assign someone to receive reminders.'
                : 'If the app is offline, only the latest missed reminder is delivered when it returns.'}
        {change ? ' Changes apply when you save the task.' : ''}
      </p>
    </section>
  );
}
