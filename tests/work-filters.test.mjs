import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readWorkFilters, filterWorkTasks, hasWorkFilters } from '../src/lib/work-filters.mjs';

const empty = { q: '', status: '', assignee: '', priority: '', due: '' };
const today = '2028-03-01';
const makeTask = (id, extra = {}) => ({ id, title: `Task ${id}`, notes: '', status: 'To do', priority: 'Medium', assigneeIds: [], dueDate: null, ...extra });
const tasks = [
  makeTask('past', { title: 'Launch [v2].*', notes: 'Résumé for ΑΘΉΝΑ', dueDate: '2028-02-29', assigneeIds: ['a', 'b'], priority: 'High' }),
  makeTask('today', { notes: 'Launch checklist', dueDate: today, assigneeIds: ['b'], status: 'In progress' }),
  makeTask('future', { title: 'Next year', dueDate: '2029-01-01', priority: 'Low' }),
  makeTask('undated'),
  makeTask('done', { title: 'Launch complete', dueDate: '2027-12-31', status: 'Done', assigneeIds: ['a'] }),
];
const ids = (filters, input = tasks, date = today) => filterWorkTasks(input, { ...empty, ...filters }, date).map(task => task.id);

test('URL filters normalize known choices, preserve query text and unknown assignees, and cap search length', () => {
  assert.deepEqual(readWorkFilters(new URLSearchParams()), empty);
  assert.deepEqual(readWorkFilters(new URLSearchParams('q=++Launch+%5Bv2%5D.*++&status=In+progress&priority=High&due=today&assignee=member-a')), {
    q: '  Launch [v2].*  ', status: 'In progress', priority: 'High', due: 'today', assignee: 'member-a',
  });
  assert.deepEqual(readWorkFilters(new URLSearchParams('status=unknown&priority=high&due=tomorrow&assignee=unknown')), { ...empty, assignee: 'unknown' });
  assert.equal(readWorkFilters(new URLSearchParams({ q: 'a'.repeat(220) })).q.length, 200);
  assert.equal(readWorkFilters(new URLSearchParams('q=first&q=second')).q, 'first');
  assert.equal(hasWorkFilters(empty), false);
  assert.equal(hasWorkFilters({ ...empty, q: ' \n\t ' }), false);
  for (const filter of [{ q: 'word' }, { status: 'Done' }, { priority: 'Low' }, { assignee: 'unknown' }, { due: 'none' }]) assert.equal(hasWorkFilters({ ...empty, ...filter }), true);
});

test('search matches title or notes as trimmed literal, case-insensitive Unicode text', () => {
  assert.deepEqual(ids({ q: '  LAUNCH  ' }), ['past', 'today', 'done']);
  assert.deepEqual(ids({ q: '[v2].*' }), ['past']);
  assert.deepEqual(ids({ q: 'résumé' }), ['past']);
  assert.deepEqual(ids({ q: 'αθήνα' }), ['past']);
  assert.deepEqual(ids({ q: 'Task past' }), []);
  assert.deepEqual(ids({ q: '.*' }), ['past']);
  assert.deepEqual(ids({ q: '^Task' }), []);
  assert.deepEqual(ids({ q: '   ' }), tasks.map(task => task.id));
  assert.deepEqual(ids({ q: 'a'.repeat(201) }, [makeTask('long', { title: 'a'.repeat(200) })]), ['long']);
});

test('assignees include each member of multiple assignments, unassigned and unknown values', () => {
  assert.deepEqual(ids({ assignee: 'a' }), ['past', 'done']);
  assert.deepEqual(ids({ assignee: 'b' }), ['past', 'today']);
  assert.deepEqual(ids({ assignee: 'unassigned' }), ['future', 'undated']);
  assert.deepEqual(ids({ assignee: 'unknown' }), []);
});

test('date filters use exact local calendar boundaries, independent of status', () => {
  assert.deepEqual(ids({ due: 'overdue' }), ['past', 'done']);
  assert.deepEqual(ids({ due: 'today' }), ['today']);
  assert.deepEqual(ids({ due: 'upcoming' }), ['future']);
  assert.deepEqual(ids({ due: 'none' }), ['undated']);
  assert.deepEqual(ids({ due: 'today' }, tasks, '2028-02-29'), ['past']);
  assert.deepEqual(ids({ due: 'upcoming' }, tasks, '2028-02-29'), ['today', 'future']);
  assert.deepEqual(ids({ due: 'overdue', status: 'Done' }), ['done']);
});

test('filters combine with AND and recompute after an edited task stops matching', () => {
  const filters = { q: 'launch', status: 'To do', assignee: 'b', priority: 'High', due: 'overdue' };
  assert.deepEqual(ids(filters), ['past']);
  assert.deepEqual(ids({ ...filters, priority: 'Low' }), []);
  assert.deepEqual(ids({ status: 'In progress', due: 'today' }), ['today']);
  const updated = tasks.map(task => task.id === 'past' ? { ...task, status: 'Done' } : task);
  assert.deepEqual(ids(filters, updated), []);
});

test('filtering preserves ordering, original objects, nested assignments and inputs, including empty results', () => {
  const input = tasks.map(task => Object.freeze({ ...task, assigneeIds: Object.freeze([...task.assigneeIds]) }));
  Object.freeze(input);
  const filters = Object.freeze({ ...empty });
  const result = filterWorkTasks(input, filters, today);
  assert.notEqual(result, input);
  assert.deepEqual(result, tasks);
  result.forEach((task, index) => assert.equal(task, input[index]));
  assert.deepEqual(filterWorkTasks([], filters, today), []);
  assert.deepEqual(filterWorkTasks(input, { ...filters, q: 'no matching task' }, today), []);
  assert.deepEqual(input, tasks);
  assert.deepEqual(filters, empty);
});
