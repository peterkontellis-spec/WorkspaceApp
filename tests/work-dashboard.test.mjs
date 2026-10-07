import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildWorkDashboard, dashboardSummary, localDateKey } from '../src/lib/work-dashboard.mjs';

const today = '2028-03-01';
const task = (id, extra = {}) => ({
  id,
  boardId: 'main',
  title: `Task ${id}`,
  status: 'To do',
  dueDate: null,
  parentId: null,
  assigneeIds: ['a'],
  ...extra,
});
const snapshot = (tasks, extra = {}) => ({
  boards: [{ id: 'main' }, { id: 'empty' }],
  tasks,
  archivedTasks: [],
  archivedBoards: [],
  members: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  actor: { id: 'a' },
  ...extra,
});
const ids = (tasks) => tasks.map((entry) => entry.id);

test('dashboard summaries count records once, include subtasks and exclude completed tasks from due buckets', () => {
  const tasks = [
    task('late', { dueDate: '2028-02-29' }),
    task('now', { dueDate: today, status: 'In progress' }),
    task('future', { dueDate: '2028-03-02' }),
    task('child', { parentId: 'late' }),
    task('done', { dueDate: '2027-12-31', status: 'Done' }),
    task('archived', { archivedAt: '2028-02-28T12:00:00Z' }),
    task('board-archived', { boardArchived: true }),
  ];
  assert.deepEqual(dashboardSummary([...tasks, tasks[0]], today), {
    total: 5,
    open: 4,
    done: 1,
    toDo: 3,
    inProgress: 1,
    overdue: 1,
    today: 1,
    upcoming: 1,
    undated: 1,
    completionPercent: 20,
  });
  assert.equal(
    dashboardSummary([task('a'), task('b'), task('c', { status: 'Done' })], today).completionPercent,
    33,
  );
  assert.equal(dashboardSummary([task('a', { status: 'Done' })], today).completionPercent, 100);
  assert.equal(dashboardSummary([], today).completionPercent, null);
});

test('personal and team dashboards keep assignment totals distinct and only include active accessible boards', () => {
  const input = snapshot(
    [
      task('shared', { assigneeIds: ['a', 'b', 'a'], dueDate: '2028-02-29' }),
      task('done', { status: 'Done' }),
      task('unassigned', { assigneeIds: [] }),
      task('other', { assigneeIds: ['b'] }),
      task('unknown-board', { boardId: 'missing' }),
      task('archived-board', { boardId: 'archived' }),
      task('archived-task', { archivedAt: '2028-02-29T00:00:00Z' }),
    ],
    { boards: [{ id: 'main' }, { id: 'empty' }, { id: 'archived', archivedAt: '2028-02-29T00:00:00Z' }] },
  );
  const result = buildWorkDashboard(input, today);
  assert.equal(result.team.total, 4);
  assert.equal(result.personal.total, 2);
  assert.equal(result.personal.done, 1);
  assert.deepEqual(ids(result.personalTasks), ['shared', 'done']);
  assert.deepEqual(
    result.members.map(({ member, summary }) => [member.id, summary.total]),
    [
      ['a', 2],
      ['b', 2],
      ['c', 0],
    ],
  );
  assert.equal(result.unassigned.total, 1);
  assert.deepEqual(
    result.boards.map(({ board, summary }) => [board.id, summary.total]),
    [
      ['main', 4],
      ['empty', 0],
    ],
  );
  assert.equal(result.boards[1].summary.completionPercent, null);
  assert.deepEqual(ids(result.overdueTasks), ['shared']);
});

test('open due buckets use calendar boundaries and stable due/title/id ordering without mutating snapshot arrays', () => {
  const tasks = [
    task('z', { dueDate: '2028-02-29', title: 'Same' }),
    task('a', { dueDate: '2028-02-29', title: 'Same' }),
    task('alpha', { dueDate: '2028-02-29', title: 'Alpha' }),
    task('oldest', { dueDate: '2028-02-28', title: 'Zed' }),
    task('today', { dueDate: today }),
    task('future', { dueDate: '2029-01-01' }),
    task('undated'),
    task('done-today', { dueDate: today, status: 'Done' }),
  ].map((entry) => Object.freeze({ ...entry, assigneeIds: Object.freeze(entry.assigneeIds) }));
  Object.freeze(tasks);
  const originalIds = ids(tasks);
  const result = buildWorkDashboard(snapshot(tasks), today);
  assert.deepEqual(ids(result.personalBuckets.overdue), ['oldest', 'alpha', 'a', 'z']);
  assert.deepEqual(ids(result.personalBuckets.today), ['today']);
  assert.deepEqual(ids(result.personalBuckets.upcoming), ['future']);
  assert.deepEqual(ids(result.personalBuckets.undated), ['undated']);
  assert.deepEqual(ids(tasks), originalIds);
  assert.equal(result.personalBuckets.today[0], tasks[4]);
  const midnight = buildWorkDashboard(snapshot(tasks), '2028-03-02');
  assert.equal(midnight.personal.today, 0);
  assert.equal(midnight.personal.overdue, 5);
});

test('recent personal tasks use real saved timestamps, exclude invalid dates and cap five with deterministic ties', () => {
  const tasks = [
    task('missing'),
    task('invalid', { updatedAt: 'not-a-date' }),
    task('outside', { updatedAt: '2028-03-09T12:00:00Z', assigneeIds: ['b'] }),
    task('archived', { updatedAt: '2028-03-09T12:00:00Z', archivedAt: '2028-03-09T13:00:00Z' }),
    ...Array.from({ length: 6 }, (_, index) =>
      task(`dated-${index}`, { updatedAt: `2028-03-0${index + 1}T12:00:00Z` }),
    ),
    task('a-tie', { updatedAt: '2028-03-06T14:00:00+02:00', status: 'Done' }),
  ];
  assert.deepEqual(ids(buildWorkDashboard(snapshot(tasks), today).recentTasks), [
    'a-tie',
    'dated-5',
    'dated-4',
    'dated-3',
    'dated-2',
  ]);
});

test('dashboard updates reflect reassignment, completion, date clearing, archive and empty work', () => {
  let current = task('one', { dueDate: '2028-02-29' });
  const read = () => buildWorkDashboard(snapshot([current]), today);
  assert.equal(read().personal.overdue, 1);
  current = { ...current, dueDate: null };
  assert.equal(read().personal.undated, 1);
  current = { ...current, status: 'Done' };
  assert.equal(read().personal.undated, 0);
  assert.equal(read().personal.completionPercent, 100);
  current = { ...current, assigneeIds: ['b'] };
  assert.equal(read().personal.total, 0);
  assert.equal(read().team.done, 1);
  current = { ...current, archivedAt: '2028-03-01T12:00:00Z' };
  assert.equal(read().team.total, 0);
  const empty = buildWorkDashboard(snapshot([], { boards: [], members: [] }), today);
  assert.deepEqual(empty.personalBuckets, { overdue: [], today: [], upcoming: [], undated: [] });
  assert.deepEqual(empty.boards, []);
  assert.deepEqual(empty.members, []);
  assert.deepEqual(empty.recentTasks, []);
});

test('local calendar key handles leap day, timezone midnight and DST without UTC date drift', () => {
  const instant = new Date('2028-02-29T22:30:00Z');
  assert.equal(localDateKey(instant, 'Europe/Athens'), '2028-03-01');
  assert.equal(localDateKey(instant, 'America/New_York'), '2028-02-29');
  assert.equal(localDateKey(new Date('2028-03-01T02:30:00Z'), 'America/New_York'), '2028-02-29');
  for (const value of [
    '2028-03-26T00:59:59Z',
    '2028-03-26T01:00:00Z',
    '2028-10-29T00:59:59Z',
    '2028-10-29T01:00:00Z',
  ]) {
    assert.equal(localDateKey(new Date(value), 'Europe/Athens'), value.slice(0, 10));
  }
  assert.equal(localDateKey(new Date(2028, 1, 29, 12)), '2028-02-29');
  assert.match(localDateKey(), /^\d{4}-\d{2}-\d{2}$/);
});

test('assignments without an active member remain visible separately from genuinely unassigned work', () => {
  const tasks = [
    task('inactive-open', { assigneeIds: ['inactive'], dueDate: '2028-02-29' }),
    task('inactive-done', { assigneeIds: ['inactive', 'also-inactive'], status: 'Done' }),
    task('mixed', { assigneeIds: ['a', 'inactive'], dueDate: today }),
    task('unassigned', { assigneeIds: [] }),
    task('active', { assigneeIds: ['b'] }),
    task('archived', { assigneeIds: ['inactive'], archivedAt: '2028-02-29T12:00:00Z' }),
  ];
  const input = snapshot(tasks, { members: [{ id: 'a' }, { id: 'b' }] });
  const result = buildWorkDashboard(input, today);
  assert.deepEqual(ids(result.unavailableAssigneeTasks), ['inactive-open', 'inactive-done']);
  assert.equal(result.unavailableAssignees.total, 2);
  assert.equal(result.unavailableAssignees.open, 1);
  assert.equal(result.unavailableAssignees.done, 1);
  assert.equal(result.unavailableAssignees.overdue, 1);
  assert.equal(result.unassigned.total, 1);
  assert.equal(result.team.total, 5);
  assert.equal(result.team.open, 4);
  assert.deepEqual(
    result.members.map(({ summary }) => summary.open),
    [1, 1],
  );

  const removedMember = buildWorkDashboard({ ...input, members: [{ id: 'b' }] }, today);
  assert.equal(removedMember.unavailableAssignees.open, 2);
  assert.equal(removedMember.unavailableAssignees.today, 1);
  assert.equal(removedMember.team.total, 5);
  assert.equal(removedMember.unassigned.total, 1);

  const noMembers = buildWorkDashboard({ ...input, members: [] }, today);
  assert.equal(noMembers.unavailableAssignees.total, 4);
  assert.equal(noMembers.unavailableAssignees.open, 3);
  assert.equal(noMembers.team.total, 5);
  assert.equal(noMembers.unassigned.total, 1);
});
