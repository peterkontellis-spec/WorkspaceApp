import { test, expect, work, boardFixture, taskLink, openTask } from './fixtures.mjs';

function gate() {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test('quick date can reopen after each save and Close calendar dismisses the complete popup', async ({
  accounts,
}) => {
  const { task, path } = await boardFixture(accounts, { dueDate: '2028-02-28' });
  const page = accounts.owner.page;
  await page.goto(path);
  const trigger = page.getByRole('button', { name: `Due date for ${task.title}`, exact: true });
  for (const [label, date] of [
    ['29 February 2028', '2028-02-29'],
    ['28 February 2028', '2028-02-28'],
  ]) {
    await trigger.click();
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(trigger).toBeEnabled();
    expect((await work(accounts.owner)).tasks.find((item) => item.id === task.id).dueDate).toBe(date);
  }
  await trigger.click();
  await page.getByRole('button', { name: 'Close calendar', exact: true }).click();
  await expect(page.locator('.quick-date-popover:popover-open')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect((await work(accounts.owner)).tasks.find((item) => item.id === task.id).dueDate).toBe('2028-02-28');
});

test('quick assignee dropdown retains two successive assignments without opening the task editor', async ({
  accounts,
}) => {
  const { task, path } = await boardFixture(accounts);
  const page = accounts.owner.page;
  await page.goto(path);
  await page.getByRole('button', { name: `Assign people to ${task.title}. Unassigned`, exact: true }).click();
  const menu = page.locator('.assignee-menu:popover-open');
  const editor = menu.getByRole('checkbox', { name: 'QA Editor', exact: true });
  const viewer = menu.getByRole('checkbox', { name: 'QA Viewer', exact: true });
  await editor.check();
  await expect(editor).toBeEnabled();
  expect((await work(accounts.owner)).tasks.find((item) => item.id === task.id).assigneeIds).toEqual([
    accounts.editor.id,
  ]);
  await viewer.check();
  await expect(viewer).toBeEnabled();
  await expect(editor).toBeChecked();
  await expect(viewer).toBeChecked();
  await menu.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await work(accounts.owner)).tasks.find((item) => item.id === task.id).assigneeIds.sort()).toEqual(
    [accounts.editor.id, accounts.viewer.id].sort(),
  );
  await page.reload();
  await page
    .getByRole('button', { name: `Assign people to ${task.title}. QA Editor, QA Viewer`, exact: true })
    .click();
  await expect(editor).toBeChecked();
  await expect(viewer).toBeChecked();
});

test('quick status locks competing controls while saving and preserves successive distinct edits', async ({
  accounts,
}) => {
  const { task, path } = await boardFixture(accounts);
  const page = accounts.owner.page;
  await page.goto(path);
  const status = page.getByLabel(`Status for ${task.title}`, { exact: true });
  const priority = page.getByLabel(`Priority for ${task.title}`, { exact: true });
  const pending = gate();
  let intercepted = false;
  await page.route('**/api/work', async (route) => {
    if (!intercepted && route.request().method() === 'POST') {
      intercepted = true;
      await pending.promise;
    }
    await route.continue();
  });
  try {
    await status.selectOption('In progress');
    await expect(status).toBeDisabled();
    await expect(priority).toBeDisabled();
  } finally {
    pending.release();
  }
  await expect(status).toBeEnabled();
  await priority.selectOption('High');
  await expect(priority).toBeEnabled();
  await status.selectOption('Done');
  await expect(status).toBeEnabled();
  const saved = (await work(accounts.owner)).tasks.find((item) => item.id === task.id);
  expect(saved.status).toBe('Done');
  expect(saved.priority).toBe('High');
  expect(saved.revision).toBe(task.revision + 3);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(status).toHaveValue('Done');
  await expect(priority).toHaveValue('High');
  await page.getByRole('navigation', { name: 'Board views' }).getByRole('link', { name: 'Kanban' }).click();
  await page.getByLabel(`Status for ${task.title}`, { exact: true }).selectOption('To do');
  await expect(
    page.getByRole('region', { name: 'To do tasks' }).locator(`[data-saved-task="${task.id}"]`),
  ).toBeVisible();
});

test('failed quick selection remains recoverable and a stale retry cannot overwrite another editor', async ({
  accounts,
}) => {
  const { task, path } = await boardFixture(accounts);
  const page = accounts.owner.page;
  accounts.owner.expectedConsoleErrors.push(/Failed to load resource:.*503/);
  await page.goto(path);
  const status = page.getByLabel(`Status for ${task.title}`, { exact: true });
  let rejectNext = true;
  await page.route('**/api/work', async (route) => {
    if (rejectNext && route.request().method() === 'POST') {
      rejectNext = false;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Temporary test interruption.' }),
      });
    } else await route.continue();
  });
  await status.selectOption('In progress');
  await expect(page.getByText('Could not confirm this change.', { exact: false })).toBeVisible();
  await expect(status).toHaveValue('In progress');
  expect((await work(accounts.editor)).tasks.find((item) => item.id === task.id).status).toBe('To do');
  await page.getByRole('button', { name: 'Retry selection', exact: true }).click();
  await expect(status).toBeEnabled();
  expect((await work(accounts.editor)).tasks.find((item) => item.id === task.id).status).toBe('In progress');
  await page.unroute('**/api/work');

  // Hold the actual stale browser mutation while a second authenticated user saves.
  // Polling cannot advance this already-created request's original revision.
  const held = gate(),
    started = gate();
  let intercepted = false;
  await page.route('**/api/work', async (route) => {
    if (!intercepted && route.request().method() === 'POST') {
      intercepted = true;
      started.release();
      await held.promise;
    }
    await route.continue();
  });
  await status.selectOption('To do');
  await started.promise;
  try {
    const latest = (await work(accounts.editor)).tasks.find((item) => item.id === task.id);
    await work(accounts.editor, {
      action: 'updateTask',
      id: task.id,
      revision: latest.revision,
      patch: { status: 'Done' },
    });
  } finally {
    held.release();
  }
  await expect(page.getByRole('button', { name: 'Retry selection', exact: true })).toBeVisible();
  await expect(status).toHaveValue('To do');
  const conflict = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/work') &&
      response.request().method() === 'POST' &&
      response.status() === 409,
  );
  await page.getByRole('button', { name: 'Retry selection', exact: true }).click();
  await conflict;
  expect((await work(accounts.editor)).tasks.find((item) => item.id === task.id).status).toBe('Done');
  await page.getByRole('button', { name: 'Discard selection', exact: true }).click();
  await expect(status).toHaveValue('Done');
});

test('editor archives a task subtree, uses Undo, and restores later without reviving an earlier archive', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts);
  async function child(title) {
    const snapshot = await work(accounts.owner, {
      action: 'createTask',
      boardId: fixture.board.id,
      groupId: fixture.group.id,
      title,
      parentId: fixture.task.id,
    });
    return snapshot.tasks.find((item) => item.title === title);
  }
  const activeChild = await child(`Active child ${fixture.task.id}`);
  const oldArchive = await child(`Earlier archive ${fixture.task.id}`);
  await work(accounts.owner, { action: 'archiveTask', id: oldArchive.id, revision: oldArchive.revision });
  const page = accounts.editor.page;
  await page.goto(fixture.path);
  let editor = await openTask(page, fixture.task);
  await editor.getByRole('button', { name: 'Archive task', exact: true }).click();
  await expect(editor.getByText(/and 1 active subtasks/)).toBeVisible();
  await editor.getByRole('button', { name: 'Confirm archive', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Save task', exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Undo archive', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Save task', exact: true })).toBeVisible();
  await editor.getByRole('textbox', { name: /^Task notes/ }).fill('Restored task remains editable');
  await editor.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(editor).not.toBeVisible();
  editor = await openTask(page, fixture.task);
  let snapshot = await work(accounts.owner);
  expect(snapshot.tasks.find((item) => item.id === fixture.task.id).notes).toBe(
    'Restored task remains editable',
  );
  expect(snapshot.tasks.some((item) => item.id === activeChild.id)).toBe(true);
  expect(snapshot.archivedTasks.some((item) => item.id === oldArchive.id)).toBe(true);

  await editor.getByRole('button', { name: 'Archive task', exact: true }).click();
  await editor.getByRole('button', { name: 'Confirm archive', exact: true }).click();
  await editor.getByRole('button', { name: 'Close task', exact: true }).click();
  await expect(taskLink(page, fixture.task)).toHaveCount(0);
  await expect(taskLink(page, activeChild)).toHaveCount(0);
  await page.getByRole('button', { name: 'Archived tasks', exact: true }).click();
  await expect(page).toHaveURL(/archived=1/);
  await page.reload(); // Restoration must work independently of in-memory Undo state.
  editor = await openTask(page, fixture.task);
  await expect(editor.getByRole('button', { name: 'Save task', exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Restore task', exact: true }).click();
  await editor.getByRole('button', { name: 'Confirm restore', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Save task', exact: true })).toBeVisible();
  snapshot = await work(accounts.owner);
  expect(snapshot.tasks.some((item) => item.id === fixture.task.id)).toBe(true);
  expect(snapshot.tasks.some((item) => item.id === activeChild.id)).toBe(true);
  expect(snapshot.archivedTasks.some((item) => item.id === oldArchive.id)).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Active tasks', exact: true }).click();
  await expect(taskLink(page, fixture.task)).toBeVisible();
  await expect(taskLink(page, activeChild)).toBeVisible();
  await expect(taskLink(page, oldArchive)).toHaveCount(0);
});

test('whole-board archive is owner-only and permanent navigation restores its active work', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts);
  const owner = accounts.owner.page,
    editor = accounts.editor.page,
    viewer = accounts.viewer.page;
  await editor.goto(fixture.path);
  await editor.getByRole('button', { name: 'Edit board', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Archive board', exact: true })).toHaveCount(0);
  await editor.keyboard.press('Escape');
  await work(
    accounts.editor,
    { action: 'archiveBoard', id: fixture.board.id, revision: fixture.board.revision },
    403,
  );
  await viewer.goto(fixture.path);
  await expect(viewer.getByLabel(`Status for ${fixture.task.title}`, { exact: true })).toHaveCount(0);
  const viewerTask = await openTask(viewer, fixture.task);
  await expect(viewerTask.getByRole('button', { name: 'Archive task', exact: true })).toHaveCount(0);
  await work(
    accounts.viewer,
    { action: 'archiveTask', id: fixture.task.id, revision: fixture.task.revision },
    403,
  );

  await owner.goto(fixture.path);
  await owner.getByRole('button', { name: 'Edit board', exact: true }).click();
  await owner.getByRole('button', { name: 'Archive board', exact: true }).click();
  await owner.getByRole('button', { name: 'Confirm archive', exact: true }).click();
  await expect(owner.getByText('This board is archived.', { exact: false })).toBeVisible();
  const snapshot = await work(accounts.owner);
  expect(snapshot.boards.some((item) => item.id === fixture.board.id)).toBe(false);
  expect(snapshot.tasks.some((item) => item.id === fixture.task.id)).toBe(false);
  await owner.goto('/boards');
  await expect(owner.getByRole('link', { name: fixture.board.name, exact: false })).toHaveCount(0);
  await owner.getByRole('link', { name: 'Archived boards', exact: true }).click();
  await owner.getByRole('link', { name: fixture.board.name, exact: false }).click();
  await expect(owner).toHaveURL(new RegExp(`${fixture.path}$`));
  await owner.reload();
  await owner.getByRole('button', { name: 'Restore board', exact: true }).click();
  await owner.getByRole('button', { name: 'Confirm restore', exact: true }).click();
  await expect(taskLink(owner, fixture.task)).toBeVisible();
  expect((await work(accounts.owner)).boards.some((item) => item.id === fixture.board.id)).toBe(true);
});

test('remote archive preserves an open draft read-only and restoration cannot silently save its stale fields', async ({
  accounts,
}) => {
  const { task, path } = await boardFixture(accounts);
  const page = accounts.owner.page;
  await page.goto(path);
  const editor = await openTask(page, task);
  await editor.getByRole('textbox', { name: /^Task notes/ }).fill('Keep this uncommitted draft');
  await work(accounts.editor, { action: 'archiveTask', id: task.id, revision: task.revision });
  await expect(editor.getByText('Retained unsaved draft', { exact: true })).toBeVisible();
  await expect(editor.getByText('Keep this uncommitted draft', { exact: true })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Save task', exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Restore task', exact: true }).click();
  await editor.getByRole('button', { name: 'Confirm restore', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: /^Task notes/ })).toHaveValue(
    'Keep this uncommitted draft',
  );
  await expect(editor.getByRole('region', { name: 'Newer task version available' })).toBeVisible();
  await editor.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(editor.getByRole('textbox', { name: /^Task notes/ })).toHaveValue(
    'Keep this uncommitted draft',
  );
  expect((await work(accounts.editor)).tasks.find((item) => item.id === task.id).notes).toBe('');
});

test('restoring a child before its archived parent shows the server error in the read-only dialog', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts);
  let snapshot = await work(accounts.owner, {
    action: 'createTask',
    boardId: fixture.board.id,
    groupId: fixture.group.id,
    parentId: fixture.task.id,
    title: `Dependent child ${fixture.task.id}`,
  });
  const child = snapshot.tasks.find((item) => item.parentId === fixture.task.id);
  await work(accounts.editor, {
    action: 'archiveTask',
    id: fixture.task.id,
    revision: fixture.task.revision,
  });
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  await page.getByRole('button', { name: 'Archived tasks', exact: true }).click();
  const editor = await openTask(page, child);
  await editor.getByRole('button', { name: 'Restore task', exact: true }).click();
  await editor.getByRole('button', { name: 'Confirm restore', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Restore the parent task first.');
  snapshot = await work(accounts.owner);
  expect(snapshot.archivedTasks.some((item) => item.id === child.id)).toBe(true);
});

test('a newly assigned task updates the recipient bell without reloading Home', async ({ accounts }) => {
  const fixture = await boardFixture(accounts);
  const before = (await work(accounts.viewer)).unreadNotifications;
  const page = accounts.viewer.page;
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'My Day', exact: true })).toBeVisible();
  await work(accounts.owner, {
    action: 'updateTask',
    id: fixture.task.id,
    revision: fixture.task.revision,
    patch: { assigneeIds: [accounts.viewer.id] },
  });
  const bell = page.getByRole('link', { name: `Notifications, ${before + 1} unread`, exact: true });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.getByRole('link', { name: fixture.task.title, exact: true })).toBeVisible();
});
