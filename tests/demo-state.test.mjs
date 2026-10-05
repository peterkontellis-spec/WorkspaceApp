import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Exercise the actual TypeScript model without a runner dependency or emitted files.
function moduleUrl(source) {
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } });
  return `data:text/javascript;base64,${Buffer.from(result.outputText).toString('base64')}`;
}
const fixtureUrl = moduleUrl(await readFile(new URL('../src/lib/demo.ts', import.meta.url), 'utf8'));
const modelSource = (await readFile(new URL('../src/lib/demo-state.ts', import.meta.url), 'utf8')).replaceAll("'@/lib/demo'", JSON.stringify(fixtureUrl));
const model = await import(moduleUrl(modelSource));
const fixtures = await import(fixtureUrl);

function freeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return value;
}

test('seeding and nested task edits never mutate fixture records or earlier states', () => {
  const before = JSON.stringify(fixtures.tasks);
  const initial = freeze(model.createDemoState());
  const checklist = [{ id: 'new-check', text: ' A new check ', done: false }];
  const result = model.patchDemoTask(initial, 't1', { title: ' Revised brief ', assigneeIds: ['sam', 'sam'], checklist });
  assert.equal(result.error, null);
  assert.equal(result.state.tasks[0].title, 'Revised brief');
  assert.deepEqual(result.state.tasks[0].assigneeIds, ['sam']);
  assert.equal(result.state.tasks[0].checklist[0].text, 'A new check');
  checklist[0].text = 'Caller changed its draft';
  assert.equal(result.state.tasks[0].checklist[0].text, 'A new check');
  assert.equal(result.state.tasks[1], initial.tasks[1]);
  assert.equal(JSON.stringify(fixtures.tasks), before);
  assert.equal(model.createDemoState().tasks[0].title, 'Prepare launch brief');
});

test('task validation rejects invalid input without dropping existing edits', () => {
  const state = freeze(model.createDemoState());
  const invalid = [
    { title: '   ' }, { dueDate: '2026-02-30' }, { dueDate: '2026-13-01' }, { dueDate: '25/09/2026' },
    { assigneeIds: ['unknown'] }, { status: 'Blocked' }, { priority: 'Urgent' }, { group: 'Unknown' },
    { boardId: 'team-operations' }, { id: 'another-task' }, { documentId: 'weekly-notes' }, { documentId: 'missing' },
    { checklist: [{ id: 'c', text: '', done: false }] },
    { subtasks: [{ id: 's', title: 'Child', status: 'Blocked' }] },
    { attachments: [{ id: 'a', name: '' }] },
  ];
  for (const patch of invalid) {
    const result = model.patchDemoTask(state, 't1', patch);
    assert.equal(typeof result.error, 'string', JSON.stringify(patch));
    assert.equal(result.state, state);
  }
  assert.equal(typeof model.patchDemoTask(state, 'missing', { title: 'New' }).error, 'string');
  assert.equal(model.patchDemoTask(state, 't1', { dueDate: '2028-02-29' }).error, null);
  assert.equal(model.patchDemoTask(state, 't1', { dueDate: null, assigneeIds: [] }).error, null);
});

test('status edits keep the chosen group and document link', () => {
  const state = model.createDemoState();
  const updated = model.patchDemoTask(state, 't1', { status: 'Done' }).state;
  assert.equal(updated.tasks[0].group, 'This week');
  assert.equal(updated.tasks[0].documentId, 'launch-brief');
  assert.equal(model.patchDemoTask(updated, 't1', { group: 'Completed' }).state.tasks[0].status, 'Done');
  assert.equal(model.patchDemoTask(updated, 't1', { documentId: 'content-outline' }).error, null);
  assert.equal(model.patchDemoTask(updated, 't1', { documentId: undefined }).state.tasks[0].documentId, undefined);
});

test('personal buckets respect user, completion, exact boundaries, and unassigned tasks', () => {
  let state = model.createDemoState();
  state = model.patchDemoTask(state, 't3', { assigneeIds: ['alex'], dueDate: '2026-09-24' }).state;
  state = model.patchDemoTask(state, 't4', { assigneeIds: ['alex'], dueDate: '2026-09-26' }).state;
  state = model.patchDemoTask(state, 't5', { assigneeIds: ['alex'] }).state;
  const before = JSON.stringify(state);
  const buckets = model.getPersonalBuckets(state.tasks, 'alex', '2026-09-25');
  assert.deepEqual(buckets.overdue.map((task) => task.id), ['t3']);
  assert.deepEqual(new Set(buckets.today.map((task) => task.id)), new Set(['t1', 't2', 't7']));
  assert.deepEqual(buckets.upcoming.map((task) => task.id), ['t4']);
  assert.deepEqual(buckets.undated.map((task) => task.id), ['t5']);
  assert.equal(Object.values(model.getPersonalBuckets(state.tasks, 'unknown')).flat().length, 0);
  assert.equal(JSON.stringify(state), before);
  assert.throws(() => model.getPersonalBuckets(state.tasks, 'alex', 'invalid'));
});

test('adding tasks validates input and creates independent defaults and unique IDs', () => {
  const state = freeze(model.createDemoState());
  const first = model.addDemoTask(state, 'website-refresh', 'Next', ' New task ');
  const second = model.addDemoTask(first.state, 'website-refresh', 'Completed', 'Another task');
  assert.equal(first.error, null);
  assert.notEqual(first.taskId, second.taskId);
  const added = first.state.tasks.at(-1);
  assert.equal(added.title, 'New task');
  assert.equal(added.group, 'Next');
  assert.equal(added.status, 'To do');
  assert.deepEqual(added.assigneeIds, []);
  assert.equal(added.dueDate, null);
  assert.equal(second.state.tasks.at(-1).status, 'To do');
  assert.equal(state.tasks.length, fixtures.tasks.length);
  for (const args of [['missing', 'Next', 'Task'], ['website-refresh', 'Missing', 'Task'], ['website-refresh', 'Next', ' ']]) {
    const result = model.addDemoTask(state, ...args);
    assert.equal(typeof result.error, 'string');
    assert.equal(result.state, state);
  }
});

test('board search and filters compose without affecting other boards or task order', () => {
  const state = freeze(model.createDemoState());
  const all = model.filterBoardTasks(state.tasks, 'website-refresh');
  assert.equal(all.length, 6);
  assert.deepEqual(model.filterBoardTasks(state.tasks, 'website-refresh', { query: ' BRIEF ', status: 'In progress', assigneeId: 'sam', priority: 'High' }).map((task) => task.id), ['t1']);
  assert.deepEqual(model.filterBoardTasks(state.tasks, 'website-refresh', { assigneeId: 'unassigned' }).map((task) => task.id), ['t5']);
  assert.equal(model.filterBoardTasks(state.tasks, 'website-refresh', { query: 'weekly' }).length, 0);
  assert.equal(model.filterBoardTasks(state.tasks, 'website-refresh', { status: 'all', priority: 'all', assigneeId: 'all' }).length, all.length);
});

test('document edits preserve identity, links, and other content; reset returns sample content', () => {
  const state = freeze(model.createDemoState());
  const updated = model.patchDemoDocument(state, 'launch-brief', { body: '# Revised\n\nSession writing.', title: ' Revised brief ', id: 'broken', boardId: 'team-operations' });
  assert.equal(updated.documents[0].id, 'launch-brief');
  assert.equal(updated.documents[0].boardId, 'website-refresh');
  assert.equal(updated.documents[0].title, 'Revised brief');
  assert.equal(updated.documents[0].body, '# Revised\n\nSession writing.');
  assert.equal(updated.documents[0].updated, 'This session');
  assert.equal(updated.documents[1], state.documents[1]);
  assert.equal(updated.tasks, state.tasks);
  assert.equal(updated.tasks[0].documentId, updated.documents[0].id);
  assert.equal(model.patchDemoDocument(updated, 'launch-brief', { title: ' ' }).documents[0].title, 'Revised brief');
  assert.notEqual(model.createDemoState().documents[0].body, updated.documents[0].body);
});

test('editing a document moves it to recent documents without changing IDs or task links', () => {
  const initial = freeze(model.createDemoState());
  const weekly = model.patchDemoDocument(initial, 'weekly-notes', { body: 'New weekly notes' });
  assert.deepEqual(weekly.documents.map((doc) => doc.id), ['weekly-notes', 'launch-brief', 'content-outline']);
  const launch = model.patchDemoDocument(weekly, 'launch-brief', { body: 'Latest launch changes' });
  assert.deepEqual(launch.documents.map((doc) => doc.id), ['launch-brief', 'weekly-notes', 'content-outline']);
  assert.equal(launch.tasks, initial.tasks);
  assert.equal(model.patchDemoDocument(launch, 'missing', { body: 'Ignored' }), launch);
});
