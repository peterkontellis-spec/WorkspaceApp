import { test, expect, environment, work, updates, boardFixture, taskLink, openTask } from './fixtures.mjs';
import { createDatabase } from '../../src/server/database.mjs';

test('one task retains its saved date, status, identity and filters across views and reload', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts, { dueDate: '2028-02-28' });
  await work(accounts.owner, {
    action: 'createTask',
    boardId: fixture.board.id,
    groupId: fixture.group.id,
    title: 'Unrelated undated task',
  });
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  const editor = await openTask(page, fixture.task);
  await editor.getByRole('button', { name: /^Due date/ }).click();
  await editor.getByRole('button', { name: '29 February 2028', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveAccessibleName('Task details');
  await editor.getByRole('combobox', { name: 'Status', exact: true }).selectOption('In progress');
  await editor.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(editor).not.toBeVisible();
  const saved = (await work(accounts.owner)).tasks.find((item) => item.id === fixture.task.id);
  expect(saved.dueDate).toBe('2028-02-29');
  expect(saved.status).toBe('In progress');
  await page
    .getByRole('search', { name: 'Find saved tasks' })
    .getByLabel('Search tasks')
    .fill(fixture.task.title);
  await page
    .getByRole('search', { name: 'Find saved tasks' })
    .getByRole('button', { name: 'Search', exact: true })
    .click();
  await expect(page.locator('[data-saved-task]')).toHaveCount(1);
  await page.getByRole('navigation', { name: 'Board views' }).getByRole('link', { name: 'Kanban' }).click();
  await expect(
    page.getByRole('region', { name: 'In progress tasks' }).locator(`[data-saved-task="${fixture.task.id}"]`),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get('q')).toBe(fixture.task.title);
  await page.getByRole('navigation', { name: 'Board views' }).getByRole('link', { name: 'Calendar' }).click();
  await expect(page).toHaveURL(/view=calendar/);
  const calendarURL = new URL(page.url());
  calendarURL.searchParams.set('month', '2028-02');
  await page.goto(calendarURL.href);
  await expect(
    page
      .locator('.saved-calendar-day')
      .filter({ has: page.locator('time[datetime="2028-02-29"]') })
      .locator(`[data-saved-task="${fixture.task.id}"]`),
  ).toBeVisible();
  await page.reload();
  await expect(taskLink(page, fixture.task)).toBeVisible();
  expect(new URL(page.url()).searchParams.get('q')).toBe(fixture.task.title);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.saved-calendar-undated')).toContainText('Unrelated undated task');
});

test('four isolated sessions receive saved changes through polling', async ({ accounts }) => {
  const fixture = await boardFixture(accounts);
  for (const account of Object.values(accounts)) {
    await account.page.goto(fixture.path);
    await expect(taskLink(account.page, fixture.task)).toContainText(fixture.task.title);
  }
  const renamed = `${fixture.task.title} live`;
  await work(accounts.owner, {
    action: 'updateTask',
    id: fixture.task.id,
    revision: fixture.task.revision,
    patch: { title: renamed },
  });
  for (const account of Object.values(accounts))
    await expect(taskLink(account.page, fixture.task)).toContainText(renamed);
});

test('stale drafts survive polling, rejected saves and reconnect without overwriting a teammate', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts);
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  const editor = await openTask(page, fixture.task);
  await editor.getByRole('textbox', { name: /^Task notes/ }).fill('A recoverable unsaved note');
  await accounts.owner.context.setOffline(true);
  await expect(page.getByText(/Updates paused/)).toBeVisible();
  await work(accounts.editor, {
    action: 'updateTask',
    id: fixture.task.id,
    revision: fixture.task.revision,
    patch: { status: 'Done' },
  });
  await accounts.owner.context.setOffline(false);
  await expect(editor.getByRole('region', { name: 'Newer task version available' })).toBeVisible();
  await expect(editor.getByRole('textbox', { name: /^Task notes/ })).toHaveValue(
    'A recoverable unsaved note',
  );
  await editor.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(editor.getByRole('textbox', { name: /^Task notes/ })).toHaveValue(
    'A recoverable unsaved note',
  );
  const stored = (await work(accounts.editor)).tasks.find((item) => item.id === fixture.task.id);
  expect(stored.status).toBe('Done');
  expect(stored.notes).toBe('');
  await editor.getByRole('button', { name: 'Reload saved task' }).click();
  await expect(editor.getByRole('region', { name: 'Discard edits before reloading' })).toBeVisible();
  await editor.getByRole('button', { name: 'Keep editing' }).click();
  await expect(editor.getByRole('textbox', { name: /^Task notes/ })).toHaveValue(
    'A recoverable unsaved note',
  );
  await editor.getByRole('button', { name: 'Reload saved task' }).click();
  await editor.getByRole('button', { name: 'Discard edits and reload' }).click();
  await expect(editor.getByRole('textbox', { name: /^Task notes/ })).toHaveValue('');
  await expect(editor.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('Done');
});

test('viewer is read-only in the interface and cannot bypass it by direct request', async ({ accounts }) => {
  const fixture = await boardFixture(accounts);
  const page = accounts.viewer.page;
  await page.goto(fixture.path);
  await expect(page.getByRole('button', { name: /^Add task/ })).toHaveCount(0);
  const editor = await openTask(page, fixture.task);
  await expect(editor.getByText('You have viewing access.', { exact: false })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Save task' })).toHaveCount(0);
  await work(
    accounts.viewer,
    {
      action: 'updateTask',
      id: fixture.task.id,
      revision: fixture.task.revision,
      patch: { title: 'Forbidden edit' },
    },
    403,
  );
  expect((await work(accounts.owner)).tasks.find((item) => item.id === fixture.task.id).title).toBe(
    fixture.task.title,
  );
});

test('assignment notifications have private read state, persist through reload and open task activity', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts, { assigneeIds: [accounts.editor.id, accounts.viewer.id] });
  const viewerNotice = (await updates(accounts.viewer)).items.find((item) => item.taskId === fixture.task.id);
  const editorNotice = (await updates(accounts.editor)).items.find((item) => item.taskId === fixture.task.id);
  expect((await updates(accounts.owner)).items.some((item) => item.taskId === fixture.task.id)).toBe(false);
  await updates(accounts.viewer, { action: 'setRead', id: editorNotice.id, read: true }, 404);
  const page = accounts.viewer.page;
  await page.goto('/notifications');
  await page
    .getByRole('button', { name: `Mark ${fixture.task.title} notification read`, exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: `Mark ${fixture.task.title} notification unread`, exact: true }),
  ).toBeVisible();
  expect(
    (await updates(accounts.viewer)).items.find((item) => item.id === viewerNotice.id).readAt,
  ).not.toBeNull();
  expect(
    (await updates(accounts.editor)).items.find((item) => item.id === editorNotice.id).readAt,
  ).toBeNull();
  await page.reload();
  await expect(
    page.getByRole('button', { name: `Mark ${fixture.task.title} notification unread`, exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: fixture.task.title, exact: true }).click();
  await expect(page.getByRole('region', { name: 'Task activity' })).toContainText('QA Owner');
});

test('desktop and narrow task controls are reachable with keyboard and no page overflow', async ({
  accounts,
}, testInfo) => {
  const fixture = await boardFixture(accounts, { notes: 'A longer task\n'.repeat(40) });
  const page = accounts.owner.page;
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(fixture.path);
    await expect(taskLink(page, fixture.task)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(
      true,
    );
    const editor = await openTask(page, fixture.task);
    const save = editor.getByRole('button', { name: 'Save task', exact: true });
    await expect(save).toBeInViewport();
    await editor.getByLabel('Title', { exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(editor.getByRole('combobox', { name: 'Status', exact: true })).toBeFocused();
    await testInfo.attach(`task-${viewport.width}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.keyboard.press('Escape');
    await expect(editor).not.toBeVisible();
    await expect(taskLink(page, fixture.task)).toBeFocused();
  }
});

// Last case deliberately expires only the fourth disposable account's session.
test('idle expiry clears protected content and disables an open editing session', async ({ accounts }) => {
  const fixture = await boardFixture(accounts);
  const page = accounts.colleague.page;
  await page.goto(fixture.path);
  const editor = await openTask(page, fixture.task);
  await editor.getByRole('textbox', { name: /^Task notes/ }).fill('Expired draft');
  const admin = createDatabase(environment.adminURL);
  try {
    await admin.query('UPDATE auth_session SET "updatedAt"=now()-interval \'31 minutes\' WHERE "userId"=$1', [
      accounts.colleague.id,
    ]);
  } finally {
    await admin.end();
  }
  await expect(
    page.getByText('Your session ended. Sign in to load your workspace again.', { exact: true }),
  ).toBeVisible();
  await expect(taskLink(page, fixture.task)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save task', exact: true })).toHaveCount(0);
});
