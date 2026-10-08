'use client';
import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from './ui';
import type { WorkTask } from '@/lib/work';
import { useWork } from './work-provider';
import './task-dependencies.css';

const isComplete = (task: WorkTask | undefined) =>
  Boolean(task && task.status === 'Done' && !task.archivedAt && !task.boardArchived);
export function DependencySummary({ task, tasks }: { task: WorkTask; tasks: WorkTask[] }) {
  const ids = task.dependencyIds ?? [];
  if (!ids.length) return null;
  const remaining = ids.filter((id) => !isComplete(tasks.find((item) => item.id === id))).length;
  return (
    <span className="dependency-summary">
      {remaining
        ? `${remaining} prerequisite${remaining === 1 ? '' : 's'} unresolved`
        : 'Prerequisites complete'}
    </span>
  );
}
export function TaskDependencies({
  task,
  ids,
  initialIds = [],
  change,
}: {
  task: WorkTask;
  ids: string[];
  initialIds?: string[];
  change?: (ids: string[]) => void;
}) {
  const { data } = useWork();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [notice, setNotice] = useState('');
  const selectRef = useRef<HTMLSelectElement>(null);
  const id = useId();
  if (!data) return null;
  const tasks = [...data.tasks, ...data.archivedTasks];
  const remaining = ids.filter((key) => !isComplete(tasks.find((item) => item.id === key))).length;
  const removed = initialIds.filter((key) => !ids.includes(key));
  const candidates = data.tasks.filter(
    (item) =>
      item.id !== task.id &&
      !ids.includes(item.id) &&
      `${item.title} ${data.boards.find((board) => board.id === item.boardId)?.name ?? ''}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const options = candidates.slice(0, 100);
  const dependants = tasks.filter((item) => (item.dependencyIds ?? []).includes(task.id));
  const taskLink = (key: string, prerequisite = true) => {
    const item = tasks.find((row) => row.id === key);
    const board = [...data.boards, ...data.archivedBoards].find((row) => row.id === item?.boardId);
    return item ? (
      <>
        <Link
          className="text-link"
          href={`/boards/${item.boardId}?${item.archivedAt || item.boardArchived ? 'archived=1&' : ''}task=${item.id}`}
          scroll={false}
        >
          {item.title}
        </Link>
        <small>
          {board?.name} ·{' '}
          {item.archivedAt || item.boardArchived
            ? prerequisite
              ? 'Archived — restore or remove this prerequisite'
              : 'Archived'
            : item.status}
        </small>
      </>
    ) : (
      <span>Unavailable task — remove this prerequisite to resolve it.</span>
    );
  };
  return (
    <section className="saved-task-section task-dependencies" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>Prerequisites</h3>
      <p className="saved-task-hint">
        Work this task depends on. Prerequisites are advisory; completion is still allowed.{' '}
        {change ? 'Changes apply when you save the task.' : ''}
      </p>
      {ids.length ? (
        <>
          <p className="dependency-state" role="status">
            {remaining
              ? `${remaining} prerequisite${remaining === 1 ? ' is' : 's are'} unresolved.`
              : 'All prerequisites are complete.'}
          </p>
          <ul className="dependency-list">
            {ids.map((key) => (
              <li key={key}>
                <div>{taskLink(key)}</div>
                {change && (
                  <Button
                    onClick={() => {
                      change(ids.filter((value) => value !== key));
                      setNotice('Prerequisite removed from this draft. Save task to apply.');
                      selectRef.current?.focus();
                    }}
                    aria-label={`Remove prerequisite ${tasks.find((item) => item.id === key)?.title ?? 'unavailable task'}`}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="detail-empty">No prerequisites. This task can stand on its own.</p>
      )}
      {change && (
        <>
          <div className="dependency-picker">
            <label className="saved-task-label">
              Find a prerequisite
              <input
                type="search"
                name="dependency-search"
                autoComplete="off"
                maxLength={240}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected('');
                }}
                placeholder="Search tasks or boards…"
              />
            </label>
            <label className="saved-task-label">
              Prerequisite task
              <select
                ref={selectRef}
                name="dependency-task"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
                aria-describedby={`${id}-hint`}
              >
                <option value="">Choose task…</option>
                {options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {data.boards.find((board) => board.id === item.boardId)?.name} · {item.title}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={!options.some((item) => item.id === selected) || ids.length >= 50}
              onClick={() => {
                if (!options.some((item) => item.id === selected)) return;
                change([...ids, selected]);
                setSelected('');
                setNotice('Prerequisite added to this draft. Save task to apply.');
                selectRef.current?.focus();
              }}
            >
              Add prerequisite
            </Button>
          </div>
          <p id={`${id}-hint`} className="saved-task-hint">
            {ids.length >= 50
              ? 'This task has the maximum 50 prerequisites.'
              : candidates.length > 100
                ? 'Showing the first 100 matches. Refine your search to find another task.'
                : !candidates.length
                  ? 'No matching active tasks available.'
                  : ''}
          </p>
          {removed.length > 0 && (
            <ul className="dependency-undo">
              {removed.map((key) => (
                <li key={key}>
                  <span>Removed: {tasks.find((item) => item.id === key)?.title ?? 'unavailable task'}</span>
                  <Button
                    onClick={() => {
                      change([...ids, key]);
                      setNotice('Prerequisite restored in this draft.');
                      selectRef.current?.focus();
                    }}
                    disabled={ids.length >= 50}
                  >
                    Undo removal
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="saved-task-hint" role="status">
            {notice}
          </p>
        </>
      )}
      {dependants.length > 0 && (
        <details className="dependency-dependants">
          <summary>
            Needed by {dependants.length} task{dependants.length === 1 ? '' : 's'}
          </summary>
          <ul className="dependency-list">
            {dependants.map((item) => (
              <li key={item.id}>
                <div>{taskLink(item.id, false)}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
