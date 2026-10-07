'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, Plus, MoreHorizontal, ArrowLeft } from 'lucide-react';
import { Button, Dialog, StatusLabel } from './ui';
import { useWork } from './work-provider';
import { PersonalDashboard } from './saved-dashboard';
import { useWorkDay } from './use-work-day';
import { buildWorkDashboard } from '@/lib/work-dashboard.mjs';
import { SavedQuickFields } from './saved-quick-fields';
import { ArchiveControl } from './archive-control';
import { SavedColumnForm, columnFormKey, type ColumnEdit } from './saved-column-form';
import { SavedFieldValue } from './saved-field-value';
import { SavedTaskEditor } from './saved-task-editor';
import { SavedWorkFilters } from './saved-work-filters';
import { SavedCalendarView, SavedKanbanView, SavedViewAddTask } from './saved-board-views';
import { boardViewHref, readBoardView, readCalendarMonth } from '@/lib/work-views.mjs';
import { readWorkFilters, filterWorkTasks, hasWorkFilters, type WorkFilters } from '@/lib/work-filters.mjs';
import { localToday, workDate, type WorkBoard, type WorkGroup, type WorkTask } from '@/lib/work';
import './auth.css';
import './saved-work.css';

type FormCache = { edit: Edit; values: Record<string, string> };
function formKey(edit: Edit) {
  return edit.kind === 'column'
    ? columnFormKey(edit)
    : edit.kind === 'board'
      ? `form:board:${edit.board?.id ?? 'new'}`
      : edit.kind === 'group'
        ? `form:group:${edit.group?.id ?? edit.boardId}`
        : `form:task:${edit.boardId}:${edit.groupId}:${edit.parentId ?? ''}`;
}
type Edit = (
  | ColumnEdit
  | { kind: 'board'; board?: WorkBoard }
  | { kind: 'group'; boardId: string; group?: WorkGroup }
  | { kind: 'task'; boardId: string; groupId: string; parentId?: string }
) & { creationId?: string };
export function SavedWorkPage({ section, boardId }: { section: 'home' | 'boards'; boardId?: string }) {
  const work = useWork();
  const deviceToday = useWorkDay();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedId = params.get('task');
  const showArchived = params.get('archived') === '1';
  const boardView = readBoardView(params);
  const workspaceSearch = section === 'boards' && !boardId && params.get('view') === 'tasks';
  const filters = readWorkFilters(params);
  const activeFilters = hasWorkFilters(filters);
  const filterKey = JSON.stringify(filters);
  const previousFilters = useRef(filterKey);
  useEffect(() => {
    const changed = previousFilters.current !== filterKey;
    previousFilters.current = filterKey;
    if (changed && !selectedId) {
      const frame = requestAnimationFrame(() =>
        document.getElementById('saved-filter-result')?.focus({ preventScroll: true }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [filterKey, selectedId]);
  const previousTask = useRef(selectedId);
  useEffect(() => {
    if (previousTask.current && !selectedId) {
      const closedId = previousTask.current;
      requestAnimationFrame(() => {
        const trigger = [...document.querySelectorAll<HTMLAnchorElement>('[data-saved-task]')].find(
          (link) => link.dataset.savedTask === closedId,
        );
        (trigger ?? document.getElementById('main-content'))?.focus({ preventScroll: true });
      });
    }
    previousTask.current = selectedId;
  }, [selectedId]);
  function applyFilters(next: WorkFilters) {
    const search = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
      else search.delete(key);
    }
    search.delete('task');
    router.push(`${pathname}${search.size ? `?${search}` : ''}`, { scroll: false });
  }
  const [edit, setEdit] = useState<Edit | null>(null);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [version, setVersion] = useState(0);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (work.error && !selectedId && !edit) errorRef.current?.focus();
  }, [work.error, selectedId, edit]);
  const data = work.data;
  const canEdit = Boolean(data && data.actor.role !== 'viewer');
  const allBoards = [...(data?.boards ?? []), ...(data?.archivedBoards ?? [])];
  const allTasks = [...(data?.tasks ?? []), ...(data?.archivedTasks ?? [])];
  const board = allBoards.find((item) => item.id === boardId);
  const selected = allTasks.find((task) => task.id === selectedId);
  const activeBoard = board && !board.archivedAt;
  const canEditBoard = canEdit && (!boardId || Boolean(activeBoard));
  function taskHref(task: WorkTask) {
    const search = new URLSearchParams(params);
    search.set('task', task.id);
    return `${pathname}?${search}`;
  }
  function leave() {
    if (selectedId) work.setDraft(`task:${selectedId}`, null);
    if (edit) work.setDraft(formKey(edit), null);
    setDirty(false);
    setDiscard(false);
    setEdit(null);
    work.clearError();
    if (selectedId) {
      const search = new URLSearchParams(params);
      search.delete('task');
      router.replace(`${pathname}${search.size ? `?${search}` : ''}`, { scroll: false });
    }
  }
  function close() {
    if (work.pending) return;
    if (discard) setDiscard(false);
    else if (dirty) setDiscard(true);
    else leave();
  }
  function openEdit(next: Edit) {
    work.clearError();
    setDirty(Boolean(work.drafts[formKey(next)]));
    setDiscard(false);
    setVersion((value) => value + 1);
    const restored = (work.drafts[formKey(next)] as FormCache | undefined)?.edit ?? next;
    setEdit({ ...restored, creationId: restored.creationId ?? crypto.randomUUID() });
  }
  async function reloadTask() {
    if (await work.refresh()) {
      if (selectedId) work.setDraft(`task:${selectedId}`, null);
      setDirty(false);
      setVersion((value) => value + 1);
    }
  }
  function tasksList(tasks: WorkTask[]) {
    return (
      <div className="saved-table" role="table" aria-label="Tasks">
        <div className="saved-table-head" role="row">
          <span role="columnheader">Task</span>
          <span role="columnheader">Status</span>
          <span role="columnheader">Assignees</span>
          <span role="columnheader">Due</span>
          <span role="columnheader">Priority</span>
        </div>
        <ul className="saved-task-list" role="rowgroup">
          {tasks.map((task) => (
            <li
              key={task.id}
              role="row"
              className={task.parentId ? 'saved-task saved-task--child' : 'saved-task'}
            >
              <div role="cell">
                <Link
                  href={taskHref(task)}
                  scroll={false}
                  className="saved-task-title"
                  data-saved-task={task.id}
                  onClick={() => {
                    work.clearError();
                    setDirty(false);
                  }}
                >
                  <strong>{task.title}</strong>
                  {work.drafts[`task:${task.id}`] ? <span>Unsaved draft in this tab</span> : null}
                  <span>
                    {task.parentId
                      ? `Subtask of ${allTasks.find((parent) => parent.id === task.parentId)?.title ?? 'another task'}`
                      : boardId
                        ? ''
                        : allBoards.find((item) => item.id === task.boardId)?.name}
                  </span>
                </Link>
              </div>
              <SavedQuickFields task={task} />
              {boardId && data?.columns.some((c) => c.boardId === task.boardId) ? (
                <dl className="saved-row-fields">
                  {data.columns
                    .filter((c) => c.boardId === task.boardId)
                    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
                    .map((column) => (
                      <div key={column.id}>
                        <dt>{column.name}</dt>
                        <dd>
                          <SavedFieldValue
                            column={column}
                            value={task.fields.find((f) => f.columnId === column.id)?.value}
                          />
                        </dd>
                      </div>
                    ))}
                </dl>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  function boardsList() {
    const listedBoards = showArchived ? (data?.archivedBoards ?? []) : (data?.boards ?? []);
    return listedBoards.length ? (
      <div className="project-grid">
        {listedBoards.map((item) => (
          <Link key={item.id} className="project-card" href={`/boards/${item.id}`}>
            <div className="project-card__top">
              <LayoutGrid size={24} aria-hidden="true" />
            </div>
            <h2>{item.name}</h2>
            <p>{item.description || 'A shared board for your team.'}</p>
            <span className="section-count">
              {
                (showArchived ? allTasks : (data?.tasks ?? [])).filter((task) => task.boardId === item.id)
                  .length
              }{' '}
              tasks
            </span>
          </Link>
        ))}
      </div>
    ) : (
      <div className="saved-empty">
        <h2>{showArchived ? 'No archived boards' : 'No boards yet'}</h2>
        <p>
          {canEdit
            ? 'Create your first board to start saving work for the team.'
            : 'An owner or editor can create the first board. You’ll be able to read it here.'}
        </p>
        {canEdit ? (
          <Button variant="primary" onClick={() => openEdit({ kind: 'board' })}>
            Create first board
          </Button>
        ) : null}
      </div>
    );
  }
  if (!data)
    return (
      <section>
        <h1>{section === 'home' ? 'Your workspace' : 'Boards'}</h1>
        <p className="page-description" role={work.error ? 'alert' : 'status'}>
          {work.error || 'Loading saved work…'}
        </p>
        {work.error ? (
          <div className="saved-actions">
            <Button onClick={() => void work.refresh()}>Retry</Button>
            <Link className="text-link" href="/sign-in">
              Sign in
            </Link>
          </div>
        ) : null}
      </section>
    );
  const boardGroups = data.groups
    .filter((group) => group.boardId === boardId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const boardColumns = data.columns
    .filter((column) => column.boardId === boardId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const boardTasks = data.tasks
    .filter((task) => task.boardId === boardId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const today = deviceToday || localToday();
  const dashboard = section === 'home' ? buildWorkDashboard(data, today) : null;
  const calendarMonth = readCalendarMonth(params.get('month'), today);
  const matchingTasks = filterWorkTasks(boardId ? boardTasks : data.tasks, filters, today);
  const viewProps = {
    tasks: matchingTasks,
    allTasks,
    groups: boardGroups,
    members: data.members,
    taskHref,
    drafts: work.drafts,
    openTask: () => {
      work.clearError();
      setDirty(false);
    },
  };
  const filterControls = (
    <SavedWorkFilters
      key={JSON.stringify(filters)}
      filters={filters}
      members={data.members}
      count={matchingTasks.length}
      total={boardId ? boardTasks.length : data.tasks.length}
      apply={applyFilters}
    />
  );
  const buckets = dashboard
    ? ([
        ['Overdue', dashboard.personalBuckets.overdue],
        ['Today', dashboard.personalBuckets.today],
        ['Upcoming', dashboard.personalBuckets.upcoming],
        ['Without a date', dashboard.personalBuckets.undated],
      ] as const)
    : [];
  return (
    <section className="saved-work">
      <div className="page-heading">
        <div>
          {boardId && (
            <Link href="/boards" className="saved-back">
              <ArrowLeft size={16} aria-hidden="true" />
              Boards
            </Link>
          )}
          <h1>
            {section === 'home'
              ? `Welcome back, ${data.actor.name.split(' ')[0]}.`
              : boardId
                ? board?.name || 'Board not found'
                : workspaceSearch
                  ? 'Find tasks'
                  : 'Boards'}
          </h1>
          <p className="page-description">
            {section === 'home'
              ? 'Your assigned work and the team’s shared boards.'
              : boardId
                ? board?.description
                : workspaceSearch
                  ? 'Search saved titles and notes across your shared workspace.'
                  : 'Shared projects, saved in your workspace.'}
          </p>
        </div>
        <div className="saved-actions">
          <span className="saved-sync" role="status">
            {work.pending ? 'Saving…' : work.syncState === 'current' ? 'Up to date' : 'Checking updates…'}
          </span>
          {canEdit && !boardId && !workspaceSearch ? (
            <Button variant="primary" onClick={() => openEdit({ kind: 'board' })}>
              <Plus size={18} aria-hidden="true" />
              New board
            </Button>
          ) : null}
          {board ? (
            <>
              <Button
                onClick={() => {
                  const search = new URLSearchParams(params);
                  search.delete('task');
                  showArchived ? search.delete('archived') : search.set('archived', '1');
                  router.push(`${pathname}?${search}`, { scroll: false });
                }}
              >
                {showArchived ? 'Active tasks' : 'Archived tasks'}
              </Button>
              {canEditBoard ? (
                <Button onClick={() => openEdit({ kind: 'board', board })}>Edit board</Button>
              ) : null}
              {board.archivedAt && <ArchiveControl key={board.id} item={board} kind="board" />}
            </>
          ) : section === 'boards' ? (
            <Link className="text-link" href={showArchived ? '/boards' : '/boards?archived=1'}>
              {showArchived ? 'Active boards' : 'Archived boards'}
            </Link>
          ) : null}
        </div>
      </div>
      {Object.entries(work.drafts)
        .filter(([key]) => key.startsWith('form:'))
        .map(([key, value]) => (
          <p key={key} className="saved-draft-note">
            Unsaved {(value as FormCache).edit.kind} input is kept in this tab.{' '}
            <Button variant="ghost" onClick={() => openEdit((value as FormCache).edit)}>
              Resume draft
            </Button>
          </p>
        ))}
      {Object.keys(work.drafts)
        .filter((key) => key.startsWith('quick:'))
        .map((key) => {
          const task = allTasks.find((item) => item.id === key.slice(6));
          return task ? (
            <p className="saved-draft-note" key={key}>
              Unconfirmed quick edit for “{task.title}”.{' '}
              <Link
                className="text-link"
                href={`/boards/${task.boardId}${task.archivedAt ? '?archived=1' : ''}`}
              >
                Review selection on board
              </Link>
            </p>
          ) : null;
        })}
      {!canEdit && <p className="saved-scope">Viewer access · shared work is read-only.</p>}
      {board?.archivedAt && (
        <p className="saved-scope">
          This board is archived. Its tasks and files are kept read-only until an owner restores it.
        </p>
      )}
      {work.notice && (
        <p role="status" className="saved-notice">
          {work.notice}
        </p>
      )}
      {work.error && !selectedId && !edit ? (
        <div className="saved-feedback">
          <p ref={errorRef} tabIndex={-1} role="alert" className="auth-error">
            {work.error}
          </p>
          <Button onClick={() => void work.refresh()}>Reload saved work</Button>
        </div>
      ) : null}
      {section === 'home' ? (
        <>
          <PersonalDashboard data={data} today={today} />
          <section className="saved-section">
            <h2>My Day</h2>
            {dashboard?.personal.open ? (
              buckets
                .filter(([, tasks]) => tasks.length)
                .map(([name, tasks]) => (
                  <section key={name} className="saved-group">
                    <h3>{name}</h3>
                    {tasksList(tasks)}
                  </section>
                ))
            ) : (
              <p className="page-description">No open tasks are assigned to you.</p>
            )}
          </section>
          <section className="saved-section">
            <h2>Shared boards</h2>
            {boardsList()}
          </section>
        </>
      ) : !boardId ? (
        <>
          <nav className="saved-view-links" aria-label="Boards and task search">
            <Link href="/boards" aria-current={!workspaceSearch ? 'page' : undefined}>
              Boards
            </Link>
            <Link href="/boards?view=tasks" aria-current={workspaceSearch ? 'page' : undefined}>
              Find tasks
            </Link>
          </nav>
          {workspaceSearch ? (
            <>
              {filterControls}
              {matchingTasks.length ? (
                tasksList(matchingTasks)
              ) : (
                <div className="saved-empty">
                  <h2>{activeFilters ? 'No matching tasks' : 'No tasks yet'}</h2>
                  <p>
                    {activeFilters
                      ? 'Try different words or clear your filters.'
                      : 'Open a board to add the first task.'}
                  </p>
                </div>
              )}
            </>
          ) : (
            boardsList()
          )}
        </>
      ) : board ? (
        <>
          {showArchived || board.archivedAt ? (
            <section className="saved-section">
              <h2>Archived tasks</h2>
              {(data.archivedTasks ?? []).some((task) => task.boardId === board.id) ? (
                tasksList((data.archivedTasks ?? []).filter((task) => task.boardId === board.id))
              ) : (
                <p>No archived tasks on this board.</p>
              )}
            </section>
          ) : (
            <>
              <div className="saved-board-toolbar">
                <nav className="saved-view-links saved-board-view-links" aria-label="Board views">
                  {(['table', 'kanban', 'calendar'] as const).map((view) => (
                    <Link
                      key={view}
                      href={boardViewHref(pathname, params, { view })}
                      scroll={false}
                      aria-current={boardView === view ? 'page' : undefined}
                    >
                      {view === 'table' ? 'Table' : view === 'kanban' ? 'Kanban' : 'Calendar'}
                    </Link>
                  ))}
                </nav>
                {filterControls}
              </div>
              {activeFilters && !matchingTasks.length ? (
                <div className="saved-empty">
                  <h2>No matching tasks</h2>
                  <p>Try different words or clear your filters. Saved tasks are unchanged.</p>
                </div>
              ) : null}
              {boardView === 'table' ? (
                <>
                  {boardGroups
                    .filter(
                      (group) => !activeFilters || matchingTasks.some((task) => task.groupId === group.id),
                    )
                    .map((group) => (
                      <section key={group.id} className="saved-group">
                        <header className="saved-group-heading">
                          <h2>{group.name}</h2>
                          {canEdit ? (
                            <Button
                              variant="ghost"
                              aria-label={`Edit ${group.name} group`}
                              onClick={() => openEdit({ kind: 'group', boardId: board.id, group })}
                            >
                              <MoreHorizontal size={18} aria-hidden="true" />
                            </Button>
                          ) : null}
                        </header>
                        {matchingTasks.some((task) => task.groupId === group.id) ? (
                          tasksList(matchingTasks.filter((task) => task.groupId === group.id))
                        ) : (
                          <p className="saved-empty-row">No tasks in this group.</p>
                        )}
                        {canEdit ? (
                          <Button
                            className="saved-add-task"
                            variant="ghost"
                            onClick={() => openEdit({ kind: 'task', boardId: board.id, groupId: group.id })}
                          >
                            <Plus size={18} aria-hidden="true" />
                            Add task to {group.name}
                          </Button>
                        ) : null}
                      </section>
                    ))}
                  {canEdit ? (
                    <Button onClick={() => openEdit({ kind: 'group', boardId: board.id })}>Add group</Button>
                  ) : null}
                </>
              ) : (
                <>
                  {canEdit ? (
                    <SavedViewAddTask
                      key={board.id}
                      groups={boardGroups}
                      addTask={(groupId) => openEdit({ kind: 'task', boardId: board.id, groupId })}
                      addGroup={() => openEdit({ kind: 'group', boardId: board.id })}
                    />
                  ) : null}
                  {boardView === 'kanban' ? (
                    <SavedKanbanView {...viewProps} />
                  ) : (
                    <SavedCalendarView
                      {...viewProps}
                      month={calendarMonth}
                      today={today}
                      monthHref={(month) => boardViewHref(pathname, params, { view: 'calendar', month })}
                    />
                  )}
                </>
              )}
            </>
          )}
        </>
      ) : (
        <p className="page-description">
          This board is unavailable in your workspace.{' '}
          <Link href="/boards" className="text-link">
            Back to boards
          </Link>
        </p>
      )}
      <Dialog
        open={Boolean(edit || selectedId)}
        onClose={close}
        title={
          discard
            ? 'Discard unsaved changes?'
            : edit
              ? edit.kind === 'column'
                ? edit.column
                  ? 'Edit column'
                  : 'New column'
                : edit.kind === 'board'
                  ? edit.board
                    ? 'Edit board'
                    : 'New board'
                  : edit.kind === 'group'
                    ? edit.group
                      ? 'Edit group'
                      : 'New group'
                    : 'New task'
              : 'Task details'
        }
        className={`saved-work-dialog${selectedId ? ' saved-task-dialog' : ''}`}
        footer={
          selected && !discard ? (
            <>
              <div className="saved-actions">
                {canEdit && !selected.archivedAt && !selected.boardArchived ? (
                  <Button type="submit" form="saved-task-edit-form" variant="primary" disabled={work.pending}>
                    {work.pending ? 'Saving…' : 'Save task'}
                  </Button>
                ) : null}
                <Button disabled={work.pending} onClick={close}>
                  {canEdit && !selected.archivedAt && !selected.boardArchived ? 'Cancel' : 'Close'}
                </Button>
              </div>
              {dirty && (
                <span className="saved-task-hint" role="status">
                  Unsaved changes
                </span>
              )}
            </>
          ) : undefined
        }
      >
        {discard ? (
          <div>
            <p className="dialog-intro">
              Your unsaved input will be discarded. Saved work will stay unchanged.
            </p>
            <div className="saved-actions">
              <Button onClick={() => setDiscard(false)}>Keep editing</Button>
              <Button onClick={leave}>Discard changes</Button>
            </div>
          </div>
        ) : null}
        <div hidden={discard}>
          {edit?.kind === 'board' && edit.board && canEdit ? (
            <details className="saved-column-settings">
              <summary>Custom columns ({boardColumns.length})</summary>
              <p className="auth-hint">
                Add fields for this board. Values are shown below each task and edited in task details.
              </p>
              {boardColumns.length ? (
                <ul>
                  {boardColumns.map((column) => (
                    <li key={column.id}>
                      <span>
                        <strong>{column.name}</strong>
                        <small>
                          {column.kind === 'number' && column.configuration.format === 'cost'
                            ? `Cost · ${column.configuration.currency}`
                            : column.kind}
                        </small>
                      </span>
                      <Button
                        variant="ghost"
                        onClick={() => openEdit({ kind: 'column', boardId: edit.board!.id, column })}
                      >
                        Edit {column.name} column
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="page-description">No custom columns yet.</p>
              )}
              <Button
                disabled={boardColumns.length >= 20}
                onClick={() => openEdit({ kind: 'column', boardId: edit.board!.id })}
              >
                Add column
              </Button>
              {boardColumns.length >= 20 ? (
                <p className="auth-hint">This board has the maximum 20 custom columns.</p>
              ) : null}
            </details>
          ) : null}
          {edit?.kind === 'column' ? (
            <SavedColumnForm
              key={`column-${version}`}
              edit={edit}
              pending={work.pending}
              error={work.error}
              conflict={work.conflict}
              close={close}
              saved={leave}
              dirty={() => setDirty(true)}
            />
          ) : edit ? (
            <>
              <WorkForm
                key={`${edit.kind}-${version}`}
                edit={edit}
                pending={work.pending}
                error={work.error}
                conflict={work.conflict}
                save={work.save}
                close={close}
                saved={leave}
                dirty={() => setDirty(true)}
              />
              {edit.kind === 'board' && edit.board && (
                <ArchiveControl
                  key={edit.board.id}
                  item={edit.board}
                  kind="board"
                  blocked={dirty}
                  onApplied={leave}
                />
              )}
            </>
          ) : selected ? (
            <>
              {(selected.archivedAt || selected.boardArchived) && (
                <p className="auth-hint">Archived task · history and files are retained.</p>
              )}
              <SavedTaskEditor
                key={`${selected.id}-${Boolean(selected.archivedAt || selected.boardArchived)}-${version}`}
                task={selected}
                columns={data.columns}
                groups={data.groups}
                tasks={allTasks}
                members={data.members}
                canEdit={canEdit && !selected.archivedAt && !selected.boardArchived}
                save={work.save}
                pending={work.pending}
                error={work.error}
                close={close}
                saved={leave}
                reload={() => void reloadTask()}
                onDirtyChange={setDirty}
              />
              <ArchiveControl
                key={selected.id}
                item={selected}
                kind="task"
                blocked={dirty && !selected.archivedAt && !selected.boardArchived}
              />
              <section className="saved-subtasks">
                <h3>Subtasks</h3>
                {allTasks
                  .filter((task) => task.parentId === selected.id)
                  .map((task) => (
                    <p key={task.id}>
                      <Link
                        href={taskHref(task)}
                        scroll={false}
                        className="text-link"
                        onClick={() => {
                          work.clearError();
                          setDirty(false);
                          setVersion((value) => value + 1);
                        }}
                      >
                        {task.title}
                        {task.archivedAt || task.boardArchived ? ' · Archived' : ''}
                      </Link>
                    </p>
                  ))}
                {canEdit && !selected.archivedAt && !selected.boardArchived ? (
                  <Button
                    disabled={dirty || work.pending}
                    onClick={() => {
                      const next = {
                        kind: 'task' as const,
                        boardId: selected.boardId,
                        groupId: selected.groupId,
                        parentId: selected.id,
                      };
                      const search = new URLSearchParams(params);
                      search.delete('task');
                      router.replace(`${pathname}${search.size ? `?${search}` : ''}`, { scroll: false });
                      openEdit(next);
                    }}
                  >
                    Add subtask
                  </Button>
                ) : null}
                {dirty ? (
                  <p className="auth-hint">Save or cancel your edits before adding a subtask.</p>
                ) : null}
              </section>
            </>
          ) : selectedId ? (
            <p>This task is unavailable. Close this panel and refresh the workspace.</p>
          ) : null}
        </div>
      </Dialog>
    </section>
  );
}

function WorkForm({
  edit,
  pending,
  error,
  conflict,
  save,
  close,
  saved,
  dirty,
}: {
  edit: Exclude<Edit, ColumnEdit>;
  pending: boolean;
  error: string;
  conflict: boolean;
  save: (payload: object) => Promise<boolean>;
  close: () => void;
  saved: () => void;
  dirty: () => void;
}) {
  const { drafts, setDraft } = useWork();
  const cached = drafts[formKey(edit)] as FormCache | undefined;
  const errorRef = useRef<HTMLParagraphElement>(null);
  function keepForm(event: FormEvent<HTMLFormElement>) {
    dirty();
    const values = Object.fromEntries(
      [...new FormData(event.currentTarget)].map(([key, value]) => [key, String(value)]),
    );
    setDraft(formKey(edit), { edit, values });
  }
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let payload: object;
    if (edit.kind === 'board')
      payload = {
        action: edit.board ? 'updateBoard' : 'createBoard',
        ...(edit.board ? { id: edit.board.id, revision: edit.board.revision } : {}),
        name: String(form.get('name')).trim(),
        description: String(form.get('description') ?? ''),
      };
    else if (edit.kind === 'group')
      payload = {
        action: edit.group ? 'updateGroup' : 'createGroup',
        ...(edit.group
          ? { id: edit.group.id, revision: edit.group.revision, position: Number(form.get('position')) }
          : { boardId: edit.boardId }),
        name: String(form.get('name')).trim(),
      };
    else
      payload = {
        action: 'createTask',
        boardId: edit.boardId,
        groupId: edit.groupId,
        title: String(form.get('name')).trim(),
        ...(edit.parentId ? { parentId: edit.parentId } : {}),
      };
    if (
      await save({
        ...payload,
        ...((edit.kind === 'task' ||
          (edit.kind === 'board' && !edit.board) ||
          (edit.kind === 'group' && !edit.group)) &&
        edit.creationId
          ? { creationId: edit.creationId }
          : {}),
      })
    )
      saved();
  }
  const current = edit.kind === 'board' ? edit.board : edit.kind === 'group' ? edit.group : undefined;
  return (
    <form className="saved-form" onSubmit={submit} onChange={keepForm} aria-busy={pending}>
      <label className="auth-field" htmlFor="work-name">
        {edit.kind === 'task' ? 'Task title' : 'Name'}
        <input
          id="work-name"
          data-dialog-initial-focus
          name="name"
          required
          maxLength={edit.kind === 'task' ? 240 : 120}
          defaultValue={cached?.values.name ?? current?.name ?? ''}
          readOnly={pending}
          autoComplete="off"
        />
      </label>
      {edit.kind === 'board' ? (
        <label className="auth-field" htmlFor="work-description">
          Description
          <textarea
            id="work-description"
            name="description"
            maxLength={4000}
            defaultValue={cached?.values.description ?? edit.board?.description ?? ''}
            readOnly={pending}
            rows={3}
          />
        </label>
      ) : null}
      {edit.kind === 'group' && edit.group ? (
        <label className="auth-field" htmlFor="work-position">
          Order
          <input
            id="work-position"
            name="position"
            type="number"
            min={0}
            max={2147483646}
            step={1}
            required
            defaultValue={cached?.values.position ?? edit.group.position}
            readOnly={pending}
          />
          <span className="auth-hint">Lower numbers appear first.</span>
        </label>
      ) : null}
      {error ? (
        <p ref={errorRef} tabIndex={-1} role="alert" className="auth-error">
          {error}
        </p>
      ) : null}
      {conflict ? (
        <p className="auth-hint">
          Your input is still here. Copy anything you need, cancel this form, refresh the workspace and reopen
          it to edit the latest version.
        </p>
      ) : null}
      <div className="saved-actions">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        <Button onClick={close} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
