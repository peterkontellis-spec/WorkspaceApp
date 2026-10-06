'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button, StatusLabel } from './ui';
import { SavedQuickFields, TaskDue } from './saved-quick-fields';
import { calendarTasks, groupTasksByStatus, shiftCalendarMonth } from '@/lib/work-views.mjs';
import { workDate, type WorkGroup, type WorkMember, type WorkTask } from '@/lib/work';
import './saved-board-views.css';

type ViewProps = {
  tasks: WorkTask[];
  allTasks: WorkTask[];
  groups: WorkGroup[];
  members: WorkMember[];
  taskHref: (task: WorkTask) => string;
  openTask: () => void;
  drafts: Record<string, unknown>;
};
function TaskCard({ task, compact = false, ...props }: ViewProps & { task: WorkTask; compact?: boolean }) {
  const parent = task.parentId ? props.allTasks.find((item) => item.id === task.parentId) : undefined;
  const group = props.groups.find((item) => item.id === task.groupId);
  const people = task.assigneeIds
    .map((id) => props.members.find((member) => member.id === id)?.name)
    .filter(Boolean)
    .join(', ');
  return (
    <div className={`saved-view-card${compact ? ' saved-view-card--compact' : ''}`}>
      <Link
        href={props.taskHref(task)}
        scroll={false}
        className={`saved-view-task${compact ? ' saved-view-task--compact' : ''}`}
        data-saved-task={task.id}
        onClick={props.openTask}
      >
        <strong>{task.title}</strong>
        {task.parentId ? (
          <span className="saved-view-task__context">Subtask of {parent?.title ?? 'another task'}</span>
        ) : null}
        {props.drafts[`task:${task.id}`] ? (
          <span className="saved-view-task__draft">Unsaved draft in this tab</span>
        ) : null}
        {compact ? (
          <StatusLabel status={task.status} />
        ) : (
          <>
            <span className="saved-view-task__context">{group?.name}</span>
            <span>
              <TaskDue task={task} /> · {task.priority} priority
            </span>
            <span>{people || 'Unassigned'}</span>
          </>
        )}
      </Link>
      {compact ? <TaskDue task={task} /> : <SavedQuickFields task={task} statusOnly />}
    </div>
  );
}
export function SavedViewAddTask({
  groups,
  addTask,
  addGroup,
}: {
  groups: WorkGroup[];
  addTask: (groupId: string) => void;
  addGroup: () => void;
}) {
  const [chosen, setChosen] = useState('');
  const selected = groups.some((group) => group.id === chosen) ? chosen : (groups[0]?.id ?? '');
  return (
    <div className="saved-view-add">
      {groups.length ? (
        <>
          <label>
            Group for new task
            <select value={selected} onChange={(event) => setChosen(event.target.value)}>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => addTask(selected)}>
            <Plus size={18} aria-hidden="true" />
            Add task
          </Button>
        </>
      ) : (
        <Button onClick={addGroup}>Add first group</Button>
      )}
    </div>
  );
}
export function SavedKanbanView(props: ViewProps) {
  return (
    <div className="saved-kanban">
      {groupTasksByStatus(props.tasks).map((column) => (
        <section key={column.status} className="saved-kanban-column" aria-label={`${column.status} tasks`}>
          <header>
            <h2>{column.status}</h2>
            <span>{column.tasks.length}</span>
          </header>
          {column.tasks.length ? (
            <ul>
              {column.tasks.map((task) => (
                <li key={task.id}>
                  <TaskCard {...props} task={task} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="saved-view-empty">No tasks with this status.</p>
          )}
        </section>
      ))}
    </div>
  );
}
export function SavedCalendarView({
  month,
  today,
  monthHref,
  ...props
}: ViewProps & { month: string; today: string; monthHref: (month: string) => string }) {
  const calendar = calendarTasks(props.tasks, month);
  const previous = shiftCalendarMonth(month, -1);
  const next = shiftCalendarMonth(month, 1);
  const monthName = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
  const fullDate = new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return (
    <section className="saved-calendar" aria-label="Tasks by due date">
      <div className="saved-calendar-toolbar">
        <h2 aria-live="polite">{monthName}</h2>
        <nav aria-label="Calendar month">
          {previous ? (
            <Link href={monthHref(previous)} scroll={false} aria-label="Previous month">
              <ChevronLeft size={20} aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
          <Link href={monthHref(today.slice(0, 7))} scroll={false}>
            This month
          </Link>
          {next ? (
            <Link href={monthHref(next)} scroll={false} aria-label="Next month">
              <ChevronRight size={20} aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
      <p className="saved-calendar-count">
        {calendar.scheduled} {calendar.scheduled === 1 ? 'task' : 'tasks'} scheduled this month
        {calendar.outsideMonth ? ` · ${calendar.outsideMonth} in other months` : ''} ·{' '}
        {calendar.undated.length} without a date
      </p>
      <div className="saved-calendar-weekdays" aria-hidden="true">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <ol className="saved-calendar-days">
        {calendar.cells.map((day, index) =>
          day ? (
            <li
              key={day.date}
              className={`saved-calendar-day${day.tasks.length ? '' : ' saved-calendar-day--empty'}${day.date === today ? ' saved-calendar-day--today' : ''}`}
            >
              <h3>
                <time dateTime={day.date} aria-label={fullDate.format(new Date(`${day.date}T12:00:00Z`))}>
                  <span className="saved-calendar-number">{Number(day.date.slice(-2))}</span>
                  <span className="saved-calendar-date">
                    {fullDate.format(new Date(`${day.date}T12:00:00Z`))}
                  </span>
                </time>
                {day.date === today ? <span className="saved-calendar-today">Today</span> : null}
              </h3>
              {day.tasks.length ? (
                <ul>
                  {day.tasks.map((task) => (
                    <li key={task.id}>
                      <TaskCard {...props} task={task} compact />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="saved-calendar-empty-day">No tasks</p>
              )}
            </li>
          ) : (
            <li key={`blank-${index}`} className="saved-calendar-blank" aria-hidden="true" />
          ),
        )}
      </ol>
      {!calendar.scheduled ? (
        <p className="saved-view-empty">
          No tasks scheduled in {monthName}.{' '}
          {calendar.outsideMonth
            ? 'Use the month controls to find tasks with other dates.'
            : 'Open a task to check or set its due date.'}
        </p>
      ) : null}
      <section className="saved-calendar-undated">
        <h2>
          Without a date <span>({calendar.undated.length})</span>
        </h2>
        {calendar.undated.length ? (
          <ul>
            {calendar.undated.map((task) => (
              <li key={task.id}>
                <TaskCard {...props} task={task} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="saved-view-empty">Every matching task has a due date.</p>
        )}
      </section>
    </section>
  );
}
