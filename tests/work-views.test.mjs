import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardViewHref, readBoardView, readCalendarMonth, shiftCalendarMonth, groupTasksByStatus, calendarTasks } from '../src/lib/work-views.mjs';
import { readWorkFilters, filterWorkTasks } from '../src/lib/work-filters.mjs';
const task = (id, dueDate = null, status = 'To do', extra = {}) => ({ id, title: id, dueDate, status, notes: '', priority: 'Medium', assigneeIds: [], ...extra });

test('view and month navigation preserve combined filters and remove the open task', () => {
  const params = new URLSearchParams('q=Launch&status=To+do&assignee=a&priority=High&due=upcoming&task=123&view=calendar&month=2028-02');
  const result = new URL(boardViewHref('/boards/abc', params, { view: 'kanban' }), 'http://localhost');
  assert.equal(result.pathname, '/boards/abc');
  assert.equal(result.searchParams.get('view'), 'kanban');
  assert.equal(result.searchParams.get('month'), '2028-02');
  assert.equal(result.searchParams.has('task'), false);
  assert.deepEqual(readWorkFilters(result.searchParams), readWorkFilters(params));
  const changedMonth = new URL(boardViewHref('/boards/abc', params, { month: '2028-03' }), 'http://localhost');
  assert.equal(changedMonth.searchParams.get('view'), 'calendar');
  assert.equal(changedMonth.searchParams.get('month'), '2028-03');
  assert.equal(params.get('task'), '123');
  for (const view of ['table', 'kanban', 'calendar']) assert.equal(readBoardView(new URLSearchParams({ view })), view);
  for (const view of ['', 'tasks', 'unknown']) assert.equal(readBoardView(new URLSearchParams({ view })), 'table');
});

test('calendar validates months and crosses year boundaries without timezone or short-year errors', () => {
  for (const value of [null, '', '0000-01', '2028-13', '2028-00', '2028-2', '2028-02-01']) assert.equal(readCalendarMonth(value, '2028-03-01'), '2028-03');
  for (const value of ['0001-01', '0099-12', '2028-02', '9999-12']) assert.equal(readCalendarMonth(value, '2028-03-01'), value);
  assert.equal(shiftCalendarMonth('2028-01', -1), '2027-12');
  assert.equal(shiftCalendarMonth('2028-12', 1), '2029-01');
  assert.equal(shiftCalendarMonth('0099-12', 1), '0100-01');
  assert.equal(shiftCalendarMonth('0001-01', -1), null);
  assert.equal(shiftCalendarMonth('9999-12', 1), null);
});

test('Monday-first calendar covers leap years, every real day and complete weeks', () => {
  for (const [month, days, leading] of [['2028-02', 29, 1], ['2027-02', 28, 0], ['2026-11', 30, 6], ['2026-10', 31, 3], ['0099-02', 28, 6], ['2000-02', 29, 1], ['1900-02', 28, 3]]) {
    const result = calendarTasks([], month);
    assert.equal(result.days.length, days, month);
    assert.equal(result.cells.findIndex(Boolean), leading, month);
    assert.equal(result.cells.length % 7, 0);
    assert.deepEqual(result.cells.filter(Boolean), result.days);
    assert.equal(result.days[0].date, `${month}-01`);
    assert.equal(result.days.at(-1).date, `${month}-${days}`);
  }
});

test('views use the same records exactly once, include subtasks and preserve task order without mutation', () => {
  const tasks = Object.freeze([
    Object.freeze(task('parent', '2028-02-29')),
    Object.freeze(task('child', '2028-02-29', 'In progress', { parentId: 'parent' })),
    Object.freeze(task('later', '2028-03-01', 'Done')),
    Object.freeze(task('undated', null, 'Done')),
  ]);
  const columns = groupTasksByStatus(tasks);
  assert.deepEqual(columns.map(column => [column.status, column.tasks.map(item => item.id)]), [['To do', ['parent']], ['In progress', ['child']], ['Done', ['later', 'undated']]]);
  const month = calendarTasks(tasks, '2028-02');
  assert.deepEqual(month.days.at(-1).tasks, tasks.slice(0, 2));
  assert.equal(month.days.at(-1).tasks[0], tasks[0]);
  assert.deepEqual(month.undated, [tasks[3]]);
  assert.equal(month.outsideMonth, 1);
  assert.equal(month.scheduled, 2);
  assert.equal(month.scheduled + month.outsideMonth + month.undated.length, tasks.length);
  const filtered = filterWorkTasks(tasks, readWorkFilters(new URLSearchParams('status=Done&due=none')), '2028-02-01');
  assert.deepEqual(groupTasksByStatus(filtered)[2].tasks, [tasks[3]]);
  assert.deepEqual(calendarTasks(filtered, '2028-02').undated, [tasks[3]]);
  const edited = tasks.map(item => item.id === 'parent' ? { ...item, dueDate: '2028-03-02', status: 'Done' } : item);
  assert.equal(groupTasksByStatus(edited)[0].tasks.length, 0);
  assert.equal(calendarTasks(edited, '2028-02').scheduled, 1);
  assert.equal(calendarTasks(edited, '2028-03').scheduled, 2);
  assert.equal(tasks[0].dueDate, '2028-02-29');
});
