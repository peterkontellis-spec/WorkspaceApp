'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useWork } from './work-provider';
import { useWorkDay } from './use-work-day';
import { Button, StatusLabel } from './ui';
import { buildWorkDashboard, type DashboardSummary } from '@/lib/work-dashboard.mjs';
import { workDate, type WorkSnapshot, type WorkTask } from '@/lib/work';
import './saved-work.css';
import './saved-dashboard.css';

function Summary({ summary, label }: { summary: DashboardSummary; label: string }) {
  return (
    <dl className="dashboard-summary" aria-label={label}>
      {(
        [
          ['Open', summary.open],
          ['In progress', summary.inProgress],
          ['Overdue', summary.overdue],
          ['Due today', summary.today],
          ['Done', summary.done],
        ] as const
      ).map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TaskLinks({
  tasks,
  data,
  recent = false,
}: {
  tasks: WorkTask[];
  data: WorkSnapshot;
  recent?: boolean;
}) {
  const boardNames = new Map(data.boards.map((board) => [board.id, board.name]));
  return (
    <ul className="dashboard-task-list">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link href={`/boards/${task.boardId}?task=${task.id}`}>
            <span>
              <strong>{task.title}</strong>
              <small>
                {boardNames.get(task.boardId)}
                {task.parentId ? ' · Subtask' : ''}
              </small>
            </span>
            <span className="dashboard-task-meta">
              <StatusLabel status={task.status} />
              <small>
                {recent && task.updatedAt
                  ? `Updated ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(task.updatedAt))}`
                  : task.dueDate
                    ? `Due ${workDate(task.dueDate)}`
                    : 'No due date'}
              </small>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PersonalDashboard({ data, today }: { data: WorkSnapshot; today: string }) {
  const dashboard = useMemo(() => buildWorkDashboard(data, today), [data, today]);
  return (
    <section className="dashboard-personal" aria-label="Your work summary">
      <div className="dashboard-section-heading">
        <h2>Your work</h2>
        <Link className="text-link" href="/overview">
          Team overview
        </Link>
      </div>
      <Summary summary={dashboard.personal} label="Your task counts" />
      <div className="dashboard-personal-links">
        <Link className="text-link" href="/notifications">
          Notifications · {data.unreadNotifications} unread
        </Link>
        <Link className="text-link" href={`/boards?view=tasks&assignee=${encodeURIComponent(data.actor.id)}`}>
          All your assigned tasks
        </Link>
      </div>
      <p className="dashboard-note">
        Dates follow your device timezone. Tasks and subtasks count separately; archived work is excluded.
      </p>
      {dashboard.recentTasks.length > 0 && (
        <details className="dashboard-recent">
          <summary>Recently updated assigned tasks</summary>
          <TaskLinks tasks={dashboard.recentTasks} data={data} recent />
        </details>
      )}
    </section>
  );
}

export function SavedOverviewPage() {
  const work = useWork();
  const today = useWorkDay();
  const data = work.data;
  const dashboard = useMemo(() => (data && today ? buildWorkDashboard(data, today) : null), [data, today]);
  return (
    <section className="saved-work dashboard-page">
      <div className="page-heading">
        <div>
          <h1>Overview</h1>
          <p className="page-description">Shared progress and the work that needs attention.</p>
        </div>
        <Link className="text-link" href="/home">
          My Day
        </Link>
      </div>
      {work.error && (
        <div className="saved-feedback">
          <p role="alert">{work.error}</p>
          <Button onClick={() => void work.refresh()}>Reload saved work</Button>
        </div>
      )}
      {!data || !dashboard ? (
        <p role="status">
          {work.error
            ? 'Your dashboard is unavailable until the workspace reconnects.'
            : 'Loading saved work…'}
        </p>
      ) : (
        <>
          <p className="dashboard-note" role="status">
            {work.syncState === 'current'
              ? 'Up to date'
              : work.syncState === 'offline'
                ? 'Offline or unable to connect · showing the last received work.'
                : 'Showing the last received work; checking for updates…'}
          </p>
          {data.actor.role === 'viewer' && (
            <p className="saved-scope">Viewer access · shared work is read-only.</p>
          )}
          <Summary summary={dashboard.team} label="Team task counts" />
          <p className="dashboard-note">
            Each task and subtask counts once. Archived work is excluded. Overdue means unfinished and due
            before today in your device timezone.
          </p>
          <section className="dashboard-section" aria-labelledby="board-progress-heading">
            <h2 id="board-progress-heading">Board progress</h2>
            {dashboard.boards.length ? (
              <ul className="dashboard-board-list">
                {dashboard.boards.map(({ board, summary }) => (
                  <li key={board.id}>
                    <Link href={`/boards/${board.id}`}>
                      <strong>{board.name}</strong>
                      <span>
                        {summary.total
                          ? `${summary.done} of ${summary.total} done · ${summary.completionPercent}%`
                          : 'No tasks yet'}
                      </span>
                    </Link>
                    {summary.total > 0 && (
                      <progress
                        max={summary.total}
                        value={summary.done}
                        aria-label={`${board.name} completion`}
                      />
                    )}
                    <p className="dashboard-note">
                      {summary.toDo} to do · {summary.inProgress} in progress · {summary.overdue} overdue
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="page-description">
                No shared boards yet.{' '}
                <Link className="text-link" href="/boards">
                  Go to boards
                </Link>{' '}
                to get started.
              </p>
            )}
          </section>
          <section className="dashboard-section" aria-labelledby="overdue-work-heading">
            <h2 id="overdue-work-heading">
              Overdue work <span className="section-count">{dashboard.team.overdue}</span>
            </h2>
            {dashboard.overdueTasks.length ? (
              <TaskLinks tasks={dashboard.overdueTasks} data={data} />
            ) : (
              <p className="page-description">No unfinished tasks are overdue.</p>
            )}
          </section>
          <section className="dashboard-section" aria-labelledby="workload-heading">
            <h2 id="workload-heading">Workload</h2>
            <p className="dashboard-note">
              Open assignments, not time estimates. A task with several assignees appears for each person;
              team totals count it once.
            </p>
            <div className="dashboard-workload" role="table" aria-label="Team workload">
              <div role="row" className="dashboard-workload-head">
                <span role="columnheader">Person</span>
                <span role="columnheader">Open</span>
                <span role="columnheader">Due today</span>
                <span role="columnheader">Overdue</span>
              </div>
              {dashboard.members.map(({ member, summary }) => (
                <div role="row" key={member.id}>
                  <div role="cell">
                    <Link href={`/boards?view=tasks&assignee=${encodeURIComponent(member.id)}`}>
                      {member.name}
                      <small>View assigned tasks</small>
                    </Link>
                  </div>
                  <span role="cell">{summary.open}</span>
                  <span role="cell">{summary.today}</span>
                  <span role="cell">{summary.overdue}</span>
                </div>
              ))}
              <div role="row">
                <div role="cell">
                  <Link href="/boards?view=tasks&assignee=unassigned">
                    Unassigned<small>View unassigned tasks</small>
                  </Link>
                </div>
                <span role="cell">{dashboard.unassigned.open}</span>
                <span role="cell">{dashboard.unassigned.today}</span>
                <span role="cell">{dashboard.unassigned.overdue}</span>
              </div>
              {dashboard.unavailableAssignees.total > 0 && (
                <div role="row">
                  <div role="cell">No active assignee</div>
                  <span role="cell">{dashboard.unavailableAssignees.open}</span>
                  <span role="cell">{dashboard.unavailableAssignees.today}</span>
                  <span role="cell">{dashboard.unavailableAssignees.overdue}</span>
                </div>
              )}
            </div>
            {dashboard.unavailableAssigneeTasks.length > 0 && (
              <details className="dashboard-recent">
                <summary>Review tasks with no active assignee</summary>
                <p className="dashboard-note">
                  These tasks are assigned only to people who are no longer active in this workspace. An owner
                  or editor can open a task to reassign it.
                </p>
                <TaskLinks tasks={dashboard.unavailableAssigneeTasks} data={data} />
              </details>
            )}
          </section>
        </>
      )}
    </section>
  );
}
