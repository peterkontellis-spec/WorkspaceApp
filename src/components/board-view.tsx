'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ChevronDown, FileText, LayoutList, Pencil, Plus } from 'lucide-react';
import { boardFor, DEMO_DATE, formatDue, members } from '@/lib/demo';
import {
  filterBoardTasks,
  taskGroups,
  taskPriorities,
  taskStatuses,
  type BoardFilters,
  type DemoTask,
} from '@/lib/demo-state';
import { useWorkspace } from './demo-provider';
import { useTaskNavigation } from './task-navigation';
import { AvatarStack, Button } from './ui';
import './board-view.css';
import { DatePicker } from './date-picker';
import { AssigneePicker } from './assignee-picker';

function InlineEdit({
  draftKey,
  value,
  label,
  type = 'text',
  onSave,
}: {
  draftKey: string;
  value: string;
  label: string;
  type?: 'text' | 'date';
  onSave: (value: string) => string | null;
}) {
  const { drafts, setDraft: saveDraft } = useWorkspace();
  const editing = Object.hasOwn(drafts, draftKey);
  const draft = drafts[draftKey] ?? value;
  const setDraft = (value: string) => saveDraft(draftKey, value);
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const dateTrigger = useRef<HTMLButtonElement>(null);
  const focusEditor = () => (type === 'date' ? dateTrigger.current : input.current)?.focus();
  const errorId = useId();
  function close() {
    saveDraft(draftKey, null);
    setError(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  return (
    <div className="board-inline-edit">
      <button
        ref={trigger}
        type="button"
        className="button button--ghost board-edit-trigger"
        aria-label={label}
        aria-expanded={editing}
        disabled={editing}
        onClick={() => {
          setDraft(value);
          setError(null);
          requestAnimationFrame(focusEditor);
        }}
      >
        <Pencil size={15} aria-hidden="true" />
        {type === 'date' ? formatDue(value || null) : 'Rename'}
      </button>
      {editing ? (
        <form
          className="board-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            const issue = onSave(draft);
            setError(issue);
            if (!issue) close();
            else focusEditor();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              event.preventDefault();
              close();
            }
          }}
        >
          {type === 'date' ? (
            <DatePicker label={label} value={draft} onChange={setDraft} triggerRef={dateTrigger} />
          ) : (
            <label>
              {label}
              <input
                ref={input}
                type="text"
                name="title"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                autoComplete="off"
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
              />
            </label>
          )}
          {error ? (
            <p role="alert" id={errorId} className="board-error">
              {error}
            </p>
          ) : null}
          <div className="board-form-actions">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Button onClick={close}>Cancel</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function EditableRow({ task }: { task: DemoTask }) {
  const { updateTask } = useWorkspace();
  const { taskHref, taskId, rememberOrigin } = useTaskNavigation();
  const [error, setError] = useState<string | null>(null);
  const overdue = task.dueDate && task.dueDate < DEMO_DATE && task.status !== 'Done';
  function change(patch: Partial<DemoTask>) {
    setError(updateTask(task.id, patch));
  }
  return (
    <li className={`board-task ${taskId === task.id ? 'board-task--selected' : ''}`}>
      <div className="board-task-title">
        <Link
          href={taskHref(task.id)}
          onClick={() => rememberOrigin(task.id)}
          scroll={false}
          data-task-id={task.id}
          className="task-title-link"
        >
          {task.title}
        </Link>
        <div className="board-task-meta">
          <InlineEdit
            draftKey={`${task.id}:title`}
            value={task.title}
            label={`Rename ${task.title}`}
            onSave={(title) => updateTask(task.id, { title })}
          />
          {task.documentId ? (
            <span>
              <FileText size={14} aria-hidden="true" />
              Linked Doc
            </span>
          ) : null}
          {task.subtasks.length ? (
            <span>
              {task.subtasks.length} subtask{task.subtasks.length === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      </div>
      <label className="board-cell">
        <span className="board-cell-label">
          Status<span className="sr-only"> for {task.title}</span>
        </span>
        <select
          aria-label={`Status for ${task.title}`}
          value={task.status}
          onChange={(event) => change({ status: event.target.value as DemoTask['status'] })}
        >
          {taskStatuses.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </label>
      <div className="board-cell board-assignees">
        <span className="board-cell-label" aria-hidden="true">
          Assignees
        </span>
        <AssigneePicker
          value={task.assigneeIds}
          taskTitle={task.title}
          onChange={(assigneeIds) => change({ assigneeIds })}
        />
      </div>
      <label className="board-cell">
        <span className="board-cell-label">
          Priority<span className="sr-only"> for {task.title}</span>
        </span>
        <select
          aria-label={`Priority for ${task.title}`}
          value={task.priority}
          onChange={(event) => change({ priority: event.target.value as DemoTask['priority'] })}
        >
          {taskPriorities.map((priority) => (
            <option key={priority}>{priority}</option>
          ))}
        </select>
      </label>
      <div className="board-cell board-date">
        <span className="board-cell-label">Due date</span>
        <InlineEdit
          draftKey={`${task.id}:date`}
          type="date"
          value={task.dueDate ?? ''}
          label={`Due date for ${task.title}`}
          onSave={(dueDate) => updateTask(task.id, { dueDate: dueDate || null })}
        />
        {overdue ? <span className="board-overdue">Overdue</span> : null}
      </div>
      {error ? (
        <p className="board-error board-row-error" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function AddTask({
  boardId,
  group,
  filtered,
}: {
  boardId: string;
  group: DemoTask['group'];
  filtered: boolean;
}) {
  const { addTask, drafts, setDraft } = useWorkspace();
  const draftKey = `${boardId}:${group}:new`;
  const adding = Object.hasOwn(drafts, draftKey);
  const title = drafts[draftKey] ?? '';
  const setTitle = (value: string) => setDraft(draftKey, value);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  function close() {
    setDraft(draftKey, null);
    setError(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  return (
    <div className="board-add-task">
      {adding ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const issue = addTask(boardId, group, title);
            setError(issue);
            if (!issue) {
              setMessage(filtered ? 'Task added. Clear filters if it is not visible.' : 'Task added.');
              close();
            } else input.current?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
        >
          <label>
            New task in {group}
            <input
              ref={input}
              name="newTask"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="For example, review the launch brief…"
              autoComplete="off"
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
            />
          </label>
          {error ? (
            <p className="board-error" id={errorId} role="alert">
              {error}
            </p>
          ) : null}
          <div className="board-form-actions">
            <Button variant="primary" type="submit">
              Add task
            </Button>
            <Button onClick={close}>Cancel</Button>
          </div>
        </form>
      ) : (
        <button
          ref={trigger}
          type="button"
          className="button button--ghost board-add-trigger"
          onClick={() => {
            setMessage('');
            setTitle('');
            requestAnimationFrame(() => input.current?.focus());
          }}
        >
          <Plus size={18} aria-hidden="true" />
          Add task<span className="sr-only"> in {group}</span>
        </button>
      )}
      <p className="board-add-message" role="status">
        {message}
      </p>
    </div>
  );
}

export function BoardView({ id }: { id: string }) {
  const board = boardFor(id);
  const { tasks } = useWorkspace();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const filterForm = useRef<HTMLFormElement>(null);
  const query = params.get('q') ?? '';
  const status = taskStatuses.find((value) => value === params.get('status')) ?? 'all';
  const priority = taskPriorities.find((value) => value === params.get('priority')) ?? 'all';
  const requestedAssignee = params.get('assignee');
  const assigneeId =
    requestedAssignee === 'unassigned' || members.some((member) => member.id === requestedAssignee)
      ? requestedAssignee!
      : 'all';
  // Synchronize uncontrolled fields after URL navigation without remounting the
  // form, so applying a filter preserves the submit button's keyboard focus.
  useEffect(() => {
    const form = filterForm.current;
    if (form)
      for (const [name, value] of Object.entries({ q: query, status, priority, assignee: assigneeId })) {
        const input = form.elements.namedItem(name);
        if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) input.value = value;
      }
  }, [query, status, priority, assigneeId]);
  const filters: BoardFilters = { query, status, priority, assigneeId };
  const filtered = !!query.trim() || status !== 'all' || priority !== 'all' || assigneeId !== 'all';
  const visible = filterBoardTasks(tasks, id, filters);
  const total = tasks.filter((task) => task.boardId === id).length;
  const collapsed = new Set((params.get('collapsed') ?? '').split(','));
  function replace(next: URLSearchParams) {
    router.replace(pathname + (next.size ? `?${next}` : ''), { scroll: false });
  }
  function clear() {
    filterForm.current?.querySelector<HTMLInputElement>('[name="q"]')?.focus();
    const next = new URLSearchParams(params.toString());
    ['q', 'status', 'priority', 'assignee'].forEach((key) => next.delete(key));
    replace(next);
  }
  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams(params.toString());
    for (const key of ['q', 'status', 'priority', 'assignee']) {
      const value = String(data.get(key) ?? '').trim();
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
    }
    replace(next);
  }
  if (!board)
    return (
      <p>
        This board could not be found. <Link href="/boards">View all boards</Link>
      </p>
    );
  return (
    <div className="editable-board">
      <Link href="/boards" className="back-link">
        <ArrowLeft size={18} aria-hidden="true" />
        All boards
      </Link>
      <div className="page-heading">
        <div>
          <h1>{board.name}</h1>
          <p className="page-description">{board.description}</p>
        </div>
        <AvatarStack ids={board.memberIds} />
      </div>
      <div className="board-views" aria-label="Board views">
        <span className="board-active-view">
          <LayoutList size={18} aria-hidden="true" />
          Table
        </span>
        <span>
          Kanban <span className="later-label">Later</span>
        </span>
        <span>
          Calendar <span className="later-label">Later</span>
        </span>
        <span>
          Custom columns <span className="later-label">Later</span>
        </span>
      </div>
      <p className="session-note">
        Edits last until refresh. Status, priority and assignees apply immediately; titles and dates use Save.
        Status changes keep tasks in their current group.
      </p>
      <form
        ref={filterForm}
        className="board-filters"
        onSubmit={applyFilters}
        aria-label="Filter board tasks"
      >
        <label className="board-query">
          Search tasks
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search title or notes…"
            autoComplete="off"
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="all">All statuses</option>
            {taskStatuses.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Assignee
          <select name="assignee" defaultValue={assigneeId}>
            <option value="all">Everyone</option>
            <option value="unassigned">Unassigned</option>
            {members.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select name="priority" defaultValue={priority}>
            <option value="all">All priorities</option>
            {taskPriorities.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <Button type="submit">Apply filters</Button>
        {filtered ? (
          <Button variant="ghost" onClick={clear}>
            Clear filters
          </Button>
        ) : null}
      </form>
      <p className="board-results" role="status">
        {filtered ? `${visible.length} of ${total} tasks match your filters.` : `${total} sample tasks`}
      </p>
      {visible.length === 0 ? (
        <div className="board-empty">
          <h2>{total === 0 ? 'No tasks in this board yet' : 'No tasks match these filters'}</h2>
          <p>
            {total === 0
              ? 'Add the first task to one of the groups below.'
              : 'Try a different search or clear filters to see every task.'}
          </p>
          {filtered ? <Button onClick={clear}>Clear filters</Button> : null}
        </div>
      ) : null}
      <div className="board-groups">
        {taskGroups.map((group, index) => {
          const groupTasks = visible.filter((task) => task.group === group);
          const isCollapsed = collapsed.has(group);
          const contentId = `board-${id}-group-${index}`;
          return (
            <section className="board-group" key={group}>
              <h2>
                <button
                  type="button"
                  className="board-group-toggle"
                  aria-expanded={!isCollapsed}
                  aria-controls={contentId}
                  onClick={() => {
                    const next = new URLSearchParams(params.toString());
                    const groups = new Set(collapsed);
                    if (isCollapsed) groups.delete(group);
                    else groups.add(group);
                    groups.delete('');
                    if (groups.size) next.set('collapsed', [...groups].join(','));
                    else next.delete('collapsed');
                    replace(next);
                  }}
                >
                  <ChevronDown
                    size={18}
                    className={isCollapsed ? 'board-chevron-collapsed' : ''}
                    aria-hidden="true"
                  />
                  {group}
                  <span className="count-badge">{groupTasks.length}</span>
                </button>
              </h2>
              <div id={contentId} hidden={isCollapsed}>
                {groupTasks.length ? (
                  <>
                    <div className="board-columns" aria-hidden="true">
                      <span>Task</span>
                      <span>Status</span>
                      <span>Assignees</span>
                      <span>Priority</span>
                      <span>Due date</span>
                    </div>
                    <ul className="board-task-list">
                      {groupTasks.map((task) => (
                        <EditableRow key={task.id} task={task} />
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="board-group-empty">
                    {filtered ? 'No matching tasks in this group.' : 'No tasks in this group yet.'}
                  </p>
                )}
                <AddTask boardId={id} group={group} filtered={filtered} />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
