import { randomUUID } from 'node:crypto';
import { test, expect, environment, work, boardFixture } from './fixtures.mjs';

const row = (page, template) => page.locator(`[data-template-id="${template.id}"]`);
async function templates(account, payload, status = 200) {
  const response =
    payload === undefined
      ? await account.context.request.get('/api/templates')
      : await account.context.request.post('/api/templates', {
          headers: { origin: environment.baseURL },
          data: payload,
        });
  expect(response.status(), await response.text()).toBe(status);
  return response.json();
}
async function saveForm(page, fixture, name, kind = 'board') {
  await page.goto('/templates');
  await page.getByRole('button', { name: 'Save a template', exact: true }).click();
  await page.getByRole('combobox', { name: 'Template type', exact: true }).selectOption(kind);
  await page.getByRole('combobox', { name: `Saved ${kind}`, exact: true }).selectOption(fixture[kind].id);
  await page.getByRole('textbox', { name: 'Template name', exact: true }).fill(name);
}
async function saveUI(account, fixture, name, kind = 'board') {
  await saveForm(account.page, fixture, name, kind);
  await account.page.getByRole('button', { name: 'Save template', exact: true }).click();
  await expect(account.page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(account.page.getByRole('button', { name: 'Save a template', exact: true })).toBeFocused();
  return (await templates(account)).templates.find((t) => t.name === name);
}
async function useBoard(account, template, name) {
  const page = account.page;
  await row(page, template).getByRole('button', { name: 'Use template', exact: true }).click();
  await page.getByRole('textbox', { name: 'New board name', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Create board from template', exact: true }).click();
  const link = page.getByRole('link', { name: 'Open new board', exact: true });
  await expect(link).toBeVisible();
  await expect(link).toBeFocused();
  const id = (await link.getAttribute('href')).split('/').at(-1);
  await link.click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  return id;
}
async function saveAPI(account, fixture, kind = 'board', name = `Template ${randomUUID()}`) {
  return (
    await templates(account, {
      action: 'save',
      creationId: randomUUID(),
      kind,
      sourceId: fixture[kind].id,
      revision: fixture[kind].revision,
      name,
    })
  ).template;
}
async function richFixture(accounts) {
  const fixture = await boardFixture(accounts, {
    status: 'Done',
    priority: 'High',
    dueDate: '2028-02-29',
    assigneeIds: [accounts.editor.id],
    notes: 'Reusable instructions with a plain link https://example.test/brief',
    checklist: [{ id: randomUUID(), label: 'Verify the delivery', done: true, position: 0 }],
  });
  const columns = [];
  for (const [kind, value, configuration] of [
    ['text', 'Keep instructions', {}],
    ['number', 42, {}],
    ['status', 'Ready', { options: ['Ready', 'Sent'] }],
    ['date', '2028-02-29', {}],
    ['link', 'https://example.test/old-project', {}],
  ]) {
    const snapshot = await work(accounts.owner, {
      action: 'createColumn',
      boardId: fixture.board.id,
      name: `Template ${kind}`,
      kind,
      configuration,
    });
    columns.push({
      ...snapshot.columns.find((c) => c.boardId === fixture.board.id && c.kind === kind),
      value,
    });
  }
  let snapshot = await work(accounts.owner, {
    action: 'updateTask',
    id: fixture.task.id,
    revision: fixture.task.revision,
    patch: { fields: columns.map((c) => ({ columnId: c.id, revision: c.revision, value: c.value })) },
  });
  fixture.task = snapshot.tasks.find((t) => t.id === fixture.task.id);
  snapshot = await work(accounts.owner, {
    action: 'createGroup',
    boardId: fixture.board.id,
    name: 'Delivery checks',
  });
  const group = snapshot.groups.find((g) => g.boardId === fixture.board.id && g.name === 'Delivery checks');
  snapshot = await work(accounts.owner, {
    action: 'createTask',
    boardId: fixture.board.id,
    groupId: group.id,
    parentId: fixture.task.id,
    title: 'Reusable delivery subtask',
    status: 'Done',
    dueDate: '2028-02-29',
  });
  fixture.child = snapshot.tasks.find((t) => t.parentId === fixture.task.id);
  fixture.columns = columns;
  return fixture;
}

test('templates board UI captures structure and independently resets progress, dates, assignees and project-specific fields', async ({
  accounts,
}) => {
  const fixture = await richFixture(accounts);
  const name = `Board process ${randomUUID().slice(0, 8)}`;
  const template = await saveUI(accounts.owner, fixture, name);
  expect(template).toMatchObject({ taskCount: 2, groupCount: 2, columnCount: 5 });
  const id = await useBoard(accounts.owner, template, `${name} first copy`);
  let snapshot = await work(accounts.owner);
  const copied = snapshot.tasks.filter((t) => t.boardId === id);
  expect(copied).toHaveLength(2);
  const parent = copied.find((t) => t.title === fixture.task.title);
  const child = copied.find((t) => t.title === fixture.child.title);
  expect(child.parentId).toBe(parent.id);
  for (const task of copied) {
    expect(task.id).not.toBe(fixture.task.id);
    expect(task.id).not.toBe(fixture.child.id);
    expect(task.status).toBe('To do');
    expect(task.dueDate).toBeNull();
    expect(task.assigneeIds).toEqual([]);
  }
  expect(parent).toMatchObject({ priority: 'High', notes: fixture.task.notes });
  expect(parent.checklist).toHaveLength(1);
  expect(parent.checklist[0]).toMatchObject({ label: 'Verify the delivery', done: false });
  expect(parent.checklist[0].id).not.toBe(fixture.task.checklist[0].id);
  expect(
    snapshot.groups
      .filter((g) => g.boardId === id)
      .map((g) => g.name)
      .sort(),
  ).toEqual(['Delivery checks', 'Tasks']);
  const columns = snapshot.columns.filter((c) => c.boardId === id);
  expect(columns).toHaveLength(5);
  expect(parent.fields.map((f) => [columns.find((c) => c.id === f.columnId).kind, f.value]).sort()).toEqual([
    ['number', 42],
    ['text', 'Keep instructions'],
  ]);
  expect(columns.find((c) => c.kind === 'status').configuration).toEqual({ options: ['Ready', 'Sent'] });
  await work(accounts.editor, {
    action: 'updateTask',
    id: parent.id,
    revision: parent.revision,
    patch: { status: 'Done', notes: 'Changed only this copy' },
  });
  await work(accounts.owner, {
    action: 'updateTask',
    id: fixture.task.id,
    revision: fixture.task.revision,
    patch: { title: 'Changed original after template capture' },
  });
  await accounts.owner.page.goto('/templates');
  const secondId = await useBoard(accounts.owner, template, `${name} second copy`);
  snapshot = await work(accounts.owner);
  expect(snapshot.tasks.find((t) => t.boardId === secondId && t.title === fixture.task.title)).toMatchObject({
    status: 'To do',
    notes: fixture.task.notes,
  });
  expect(snapshot.tasks.find((t) => t.id === parent.id)).toMatchObject({
    status: 'Done',
    notes: 'Changed only this copy',
  });
  await accounts.owner.page.reload();
  await expect(
    accounts.owner.page.locator(
      `[data-saved-task="${snapshot.tasks.find((t) => t.boardId === secondId && t.title === fixture.task.title).id}"]`,
    ),
  ).toBeVisible();
});

test('templates task UI adds its subtree to a chosen group and reuses compatible columns', async ({
  accounts,
}) => {
  const source = await richFixture(accounts);
  const destination = await boardFixture(accounts);
  let snapshot = await work(accounts.owner, {
    action: 'createColumn',
    boardId: destination.board.id,
    name: 'Template text',
    kind: 'text',
  });
  const existing = snapshot.columns.find((c) => c.boardId === destination.board.id);
  const template = await saveUI(
    accounts.editor,
    source,
    `Reusable checklist ${randomUUID().slice(0, 8)}`,
    'task',
  );
  const page = accounts.editor.page;
  await row(page, template).getByRole('button', { name: 'Use template', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Destination board', exact: true })
    .selectOption(destination.board.id);
  await page
    .getByRole('combobox', { name: 'Destination group', exact: true })
    .selectOption(destination.group.id);
  await page.getByRole('button', { name: 'Create task from template', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open new task', exact: true })).toBeFocused();
  await page.getByRole('link', { name: 'Open new task', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Task details', exact: true })).toBeVisible();
  const taskId = new URL(page.url()).searchParams.get('task');
  snapshot = await work(accounts.editor);
  const copied = snapshot.tasks.find((t) => t.id === taskId);
  expect(copied).toMatchObject({
    groupId: destination.group.id,
    status: 'To do',
    assigneeIds: [],
    dueDate: null,
  });
  expect(copied.checklist[0].done).toBe(false);
  expect(copied.fields.find((f) => f.columnId === existing.id).value).toBe('Keep instructions');
  expect(snapshot.columns.filter((c) => c.boardId === destination.board.id)).toHaveLength(5);
  expect(snapshot.tasks.find((t) => t.parentId === copied.id)).toMatchObject({
    groupId: destination.group.id,
    status: 'To do',
  });
  expect(snapshot.tasks.find((t) => t.id === source.task.id).status).toBe('Done');
});

test('templates permissions enforce viewer read-only and owner-only board-template archive and restore', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts);
  const board = await saveAPI(accounts.editor, fixture);
  const task = await saveAPI(accounts.editor, fixture, 'task');
  const editor = accounts.editor.page,
    viewer = accounts.viewer.page,
    owner = accounts.owner.page;
  await editor.goto('/templates');
  await expect(row(editor, board).getByRole('button', { name: 'Use template', exact: true })).toBeVisible();
  await expect(row(editor, board).getByRole('button', { name: 'Archive template', exact: true })).toHaveCount(
    0,
  );
  await expect(
    row(editor, task).getByRole('button', { name: 'Archive template', exact: true }),
  ).toBeVisible();
  await templates(accounts.editor, { action: 'archive', id: board.id, revision: board.revision }, 403);
  await viewer.goto('/templates');
  await expect(row(viewer, board)).toBeVisible();
  await expect(row(viewer, board).getByRole('button')).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Save a template', exact: true })).toHaveCount(0);
  await templates(
    accounts.viewer,
    {
      action: 'use',
      creationId: randomUUID(),
      templateId: board.id,
      revision: board.revision,
      name: 'Forbidden copy',
    },
    403,
  );
  await owner.goto('/templates');
  await row(owner, board).getByRole('button', { name: 'Archive template', exact: true }).click();
  await owner
    .getByRole('dialog', { name: 'Archive template', exact: true })
    .getByRole('button', { name: 'Confirm archive', exact: true })
    .click();
  await expect(row(owner, board)).toHaveCount(0);
  await expect(row(viewer, board)).toHaveCount(0);
  await owner.getByRole('button', { name: 'Show archived templates', exact: true }).click();
  await row(owner, board).getByRole('button', { name: 'Restore template', exact: true }).click();
  await owner
    .getByRole('dialog', { name: 'Restore template', exact: true })
    .getByRole('button', { name: 'Confirm restore', exact: true })
    .click();
  await expect(row(owner, board)).toHaveCount(0);
  await expect(row(viewer, board)).toBeVisible();
});

test('templates uncertain committed save retains its input and retry does not create a duplicate', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts);
  const account = accounts.owner,
    page = account.page;
  const name = `Retained uncertain template ${randomUUID().slice(0, 8)}`;
  await saveForm(page, fixture, name);
  account.expectedConsoleErrors.push(/net::ERR_FAILED/);
  let committed = false;
  await page.route('**/api/templates', async (route) => {
    if (route.request().method() === 'POST' && !committed) {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      committed = true;
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Save template', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Save could not be confirmed. Your input is kept.',
  );
  await expect(page.getByRole('textbox', { name: 'Template name', exact: true })).toHaveValue(name);
  expect((await templates(account)).templates.filter((t) => t.name === name)).toHaveLength(1);
  await page.getByRole('button', { name: 'Save template', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Template name', exact: true })).toHaveCount(0);
  expect((await templates(account)).templates.filter((t) => t.name === name)).toHaveLength(1);
  await page.unroute('**/api/templates');
});

test('templates stale version and offline failure preserve draft input until a fresh retry', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts);
  const template = await saveAPI(accounts.owner, fixture);
  const account = accounts.editor,
    page = account.page;
  await page.goto('/templates');
  await row(page, template).getByRole('button', { name: 'Use template', exact: true }).click();
  const name = `Preserved copy ${randomUUID().slice(0, 8)}`;
  await page.getByRole('textbox', { name: 'New board name', exact: true }).fill(name);
  const archived = await templates(accounts.owner, {
    action: 'archive',
    id: template.id,
    revision: template.revision,
  });
  await templates(accounts.owner, {
    action: 'restore',
    id: template.id,
    revision: archived.template.revision,
  });
  await page.getByRole('button', { name: 'Create board from template', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'This item changed. Reload it before continuing.',
  );
  await expect(page.getByRole('textbox', { name: 'New board name', exact: true })).toHaveValue(name);
  expect((await work(accounts.owner)).boards.some((b) => b.name === name)).toBe(false);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'New board name', exact: true })).toHaveValue(name);
  await page.getByRole('button', { name: 'Use latest saved version', exact: true }).click();
  await expect(page.locator('#template-form-title')).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'New board name', exact: true })).toHaveValue(name);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  try {
    await account.context.setOffline(true);
    await page.getByRole('button', { name: 'Create board from template', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Your input is kept');
    await expect(page.getByRole('textbox', { name: 'New board name', exact: true })).toHaveValue(name);
  } finally {
    await account.context.setOffline(false);
  }
  await page.getByRole('button', { name: 'Create board from template', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open new board', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open new board', exact: true })).toBeFocused();
  expect((await work(accounts.owner)).boards.filter((b) => b.name === name)).toHaveLength(1);
});

test('templates keyboard creation and archive dismissal fit desktop and narrow layouts in both themes', async ({
  accounts,
}, info) => {
  const fixture = await boardFixture(accounts);
  const name = `Reusable process ${'with readable details '.repeat(4)}`.slice(0, 120);
  const template = await saveAPI(accounts.owner, fixture, 'board', name);
  const page = accounts.owner.page;
  await page.goto('/templates');
  await page.getByRole('searchbox', { name: 'Find a template', exact: true }).fill(name);
  await expect(page.locator('.template-list > li')).toHaveCount(1);
  const use = row(page, template).getByRole('button', { name: 'Use template', exact: true });
  await use.focus();
  await page.keyboard.press('Enter');
  await page
    .getByRole('textbox', { name: 'New board name', exact: true })
    .fill('Keyboard-controlled template copy');
  for (const mode of ['light', 'dark']) {
    await page.getByRole('button', { name: `Switch to ${mode} mode`, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    for (const width of [1400, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(
        page.getByRole('button', { name: 'Create board from template', exact: true }),
      ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: info.outputPath(`templates-${mode}-${width}.png`), fullPage: true });
    }
  }
  await page.getByRole('textbox', { name: 'New board name', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'Open new board', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open new board', exact: true })).toBeFocused();
  const archive = row(page, template).getByRole('button', { name: 'Archive template', exact: true });
  await archive.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Archive template', exact: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(archive).toBeFocused();
});

test('templates explicitly reload stale sources and versions while preserving names, destinations and retry identity', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts, { notes: 'Earlier saved instructions' });
  const destination = await boardFixture(accounts);
  const page = accounts.editor.page;
  const name = `Reload source safely ${randomUUID().slice(0, 8)}`;
  const writes = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/templates') && request.method() === 'POST')
      writes.push(request.postDataJSON());
  });
  await saveForm(page, fixture, name, 'task');
  await work(accounts.owner, {
    action: 'updateTask',
    id: fixture.task.id,
    revision: fixture.task.revision,
    patch: { notes: 'Updated saved instructions for explicit reload' },
  });
  await page.getByRole('button', { name: 'Save template', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'This item changed. Reload it before continuing.',
  );
  await expect(page.getByRole('textbox', { name: 'Template name', exact: true })).toHaveValue(name);
  await page.getByRole('button', { name: 'Use latest saved version', exact: true }).click();
  await expect(page.locator('#template-form-title')).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Template name', exact: true })).toHaveValue(name);
  await expect(page.getByRole('combobox', { name: 'Saved task', exact: true })).toHaveValue(fixture.task.id);
  await page.getByRole('button', { name: 'Save template', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save a template', exact: true })).toBeFocused();
  expect(writes).toHaveLength(2);
  expect(writes[1].creationId).toBe(writes[0].creationId);
  expect(writes[1].revision).toBeGreaterThan(writes[0].revision);
  const template = (await templates(accounts.editor)).templates.find((item) => item.name === name);
  await row(page, template).getByRole('button', { name: 'Use template', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Destination board', exact: true })
    .selectOption(destination.board.id);
  await page
    .getByRole('combobox', { name: 'Destination group', exact: true })
    .selectOption(destination.group.id);
  const archived = await templates(accounts.owner, {
    action: 'archive',
    id: template.id,
    revision: template.revision,
  });
  await templates(accounts.owner, {
    action: 'restore',
    id: template.id,
    revision: archived.template.revision,
  });
  await page.getByRole('button', { name: 'Create task from template', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'This item changed. Reload it before continuing.',
  );
  await page.getByRole('button', { name: 'Use latest saved version', exact: true }).click();
  await expect(page.locator('#template-form-title')).toBeFocused();
  await expect(page.getByRole('combobox', { name: 'Destination board', exact: true })).toHaveValue(
    destination.board.id,
  );
  await expect(page.getByRole('combobox', { name: 'Destination group', exact: true })).toHaveValue(
    destination.group.id,
  );
  await page.getByRole('button', { name: 'Create task from template', exact: true }).click();
  const result = page.getByRole('link', { name: 'Open new task', exact: true });
  await expect(result).toBeFocused();
  expect(writes).toHaveLength(4);
  expect(writes[3].creationId).toBe(writes[2].creationId);
  expect(writes[3].revision).toBeGreaterThan(writes[2].revision);
  const copiedId = new URL(await result.getAttribute('href'), environment.baseURL).searchParams.get('task');
  const snapshot = await work(accounts.owner);
  expect(snapshot.tasks.find((task) => task.id === copiedId)).toMatchObject({
    boardId: destination.board.id,
    groupId: destination.group.id,
    notes: 'Updated saved instructions for explicit reload',
  });
  expect(snapshot.tasks.filter((task) => task.boardId === destination.board.id)).toHaveLength(2);
  await page.getByRole('button', { name: 'Save a template', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Template name', exact: true })
    .fill('Discard this unfinished input');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard input', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save a template', exact: true })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Template name', exact: true })).toHaveCount(0);
});
