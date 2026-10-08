import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { test, expect, environment, work, boardFixture, taskLink, openTask } from './fixtures.mjs';
import { createDatabase } from '../../src/server/database.mjs';

function gate() {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test('combined filters survive view/history changes and year navigation; clearing a date preserves the selected month', async ({
  accounts,
}) => {
  const year = new Date().getUTCFullYear() + 2;
  const december = `${year}-12`,
    january = `${year + 1}-01`;
  const matching = {
    status: 'In progress',
    priority: 'High',
    dueDate: `${december}-31`,
    assigneeIds: [accounts.editor.id],
  };
  const fixture = await boardFixture(accounts, matching);
  for (const [suffix, different] of Object.entries({
    status: { status: 'Done' },
    priority: { priority: 'Low' },
    person: { assigneeIds: [] },
    date: { dueDate: null },
    text: {},
  })) {
    await work(accounts.owner, {
      action: 'createTask',
      boardId: fixture.board.id,
      groupId: fixture.group.id,
      title: suffix === 'text' ? 'Different search text' : `${fixture.task.title} ${suffix}`,
      ...matching,
      ...different,
    });
  }
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  const search = page.getByRole('search', { name: 'Find saved tasks' });
  await search.getByRole('searchbox', { name: 'Search tasks' }).fill(fixture.task.title);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const filters = page.getByRole('dialog', { name: 'Filters', exact: true });
  await filters.getByRole('combobox', { name: 'Status', exact: true }).selectOption('In progress');
  await filters.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('High');
  await filters.getByRole('combobox', { name: 'Assignee', exact: true }).selectOption(accounts.editor.id);
  await filters.getByRole('combobox', { name: 'Due date', exact: true }).selectOption('upcoming');
  await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(filters).not.toBeVisible();
  await expect(page.locator('[data-saved-task]')).toHaveCount(1);
  await expect(taskLink(page, fixture.task)).toBeVisible();
  const filtered = Object.fromEntries(new URL(page.url()).searchParams);
  expect(filtered).toMatchObject({
    q: fixture.task.title,
    status: 'In progress',
    priority: 'High',
    assignee: accounts.editor.id,
    due: 'upcoming',
  });
  for (const view of ['Kanban', 'Calendar']) {
    await page
      .getByRole('navigation', { name: 'Board views' })
      .getByRole('link', { name: view, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`view=${view.toLowerCase()}`));
    expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject(filtered);
  }
  const calendar = new URL(page.url());
  calendar.searchParams.set('month', december);
  await page.goto(calendar.href);
  const monthNavigation = page.getByRole('navigation', { name: 'Calendar month' });
  await monthNavigation.getByRole('link', { name: 'Next month', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`month=${january}`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`month=${december}`));
  await expect(taskLink(page, fixture.task)).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`month=${january}`));
  await monthNavigation.getByRole('link', { name: 'Previous month', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`month=${december}`));
  const editor = await openTask(page, fixture.task);
  await editor.getByRole('button', { name: /^Due date/ }).click();
  await editor.getByRole('button', { name: 'Clear date', exact: true }).click();
  await editor.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(page).toHaveURL(new RegExp(`month=${december}`));
  expect((await work(accounts.owner)).tasks.find((item) => item.id === fixture.task.id).dueDate).toBeNull();
  await expect(page.getByRole('heading', { name: 'No matching tasks', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(
    page.locator('.saved-calendar-undated').locator(`[data-saved-task="${fixture.task.id}"]`),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`month=${december}`));
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'No matching tasks', exact: true })).toBeVisible();
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject(filtered);
  await page.goForward();
  await expect(
    page.locator('.saved-calendar-undated').locator(`[data-saved-task="${fixture.task.id}"]`),
  ).toBeVisible();
});

test('empty and long-label boards fit narrow views; owner and editor create tasks from Kanban and Calendar', async ({
  accounts,
}, testInfo) => {
  const name = `Long board ${randomUUID()} ` + 'Planning and coordination '.repeat(3);
  let snapshot = await work(accounts.owner, { action: 'createBoard', name: name.slice(0, 120) });
  const board = snapshot.boards.find((item) => item.name === name.slice(0, 120));
  const group = snapshot.groups.find((item) => item.boardId === board.id);
  await work(accounts.owner, {
    action: 'updateGroup',
    id: group.id,
    revision: group.revision,
    position: group.position,
    name: 'A long group name for collaboration and scheduling '.repeat(2),
  });
  const path = `/boards/${board.id}`;
  const page = accounts.owner.page;
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of ['table', 'kanban', 'calendar']) {
    await page.goto(`${path}?view=${view}`);
    await expect(page.getByRole('heading', { name: board.name, exact: true })).toBeVisible();
    await expect(page.locator('[data-saved-task]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const search = page.getByRole('search', { name: 'Find saved tasks' });
    await search.getByRole('searchbox', { name: 'Search tasks' }).fill('nothing matches');
    await search.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'No matching tasks', exact: true })).toBeVisible();
  }
  for (const role of ['owner', 'editor']) {
    const actorPage = accounts[role].page;
    for (const view of ['kanban', 'calendar']) {
      await actorPage.goto(`${path}?view=${view}`);
      await actorPage.getByRole('button', { name: 'Add task', exact: true }).click();
      const dialog = actorPage.getByRole('dialog', { name: 'New task', exact: true });
      const title = `${role} ${view} ${'A task title with detailed context and long labels '.repeat(4)}`
        .slice(0, 235)
        .trim();
      await dialog.getByRole('textbox', { name: 'Task title', exact: true }).fill(title);
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      snapshot = await work(accounts[role]);
      const saved = snapshot.tasks.find((item) => item.boardId === board.id && item.title === title);
      expect(saved).toBeTruthy();
      await expect(taskLink(actorPage, saved)).toBeVisible();
      expect(new URL(actorPage.url()).searchParams.get('view')).toBe(view);
    }
  }
  for (const view of ['table', 'kanban', 'calendar']) {
    await page.goto(`${path}?view=${view}`);
    await expect(page.locator('[data-saved-task]')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await testInfo.attach(`long-labels-${view}-390`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  }
});

test('a delayed pre-save snapshot cannot replace a newer successful browser save', async ({
  accounts,
}, testInfo) => {
  const fixture = await boardFixture(accounts);
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  const status = page.getByRole('combobox', { name: `Status for ${fixture.task.title}`, exact: true });
  await expect(status).toHaveValue('To do');
  const held = gate(),
    started = gate();
  let captured,
    intercepted = false,
    abortedRead = false;
  await page.route('**/api/work', async (route) => {
    if (!intercepted && route.request().method() === 'GET') {
      intercepted = true;
      const response = await route.fetch();
      captured = await response.json();
      started.release();
      await held.promise;
      try {
        await route.fulfill({ response, json: captured });
      } catch {
        abortedRead = true;
      } // Saves intentionally abort/invalidate an outstanding poll.
    } else await route.continue();
  });
  try {
    await started.promise;
    expect(captured.tasks.find((item) => item.id === fixture.task.id).status).toBe('To do');
    await status.selectOption('Done');
    await expect(status).toBeEnabled();
    expect((await work(accounts.editor)).tasks.find((item) => item.id === fixture.task.id).status).toBe(
      'Done',
    );
    const nextRead = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/work') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    );
    held.release();
    await nextRead;
    await expect(status).toHaveValue('Done');
    await testInfo.attach('delayed-read-outcome', {
      body: JSON.stringify({
        browserAbortedHeldRead: abortedRead,
        staleStatus: 'To do',
        finalStatus: 'Done',
      }),
      contentType: 'application/json',
    });
  } finally {
    held.release();
  }
});

test('real background-tab visibility pauses polling and foreground focus fetches the latest task', async ({
  accounts,
}, testInfo) => {
  const fixture = await boardFixture(accounts);
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  await expect(taskLink(page, fixture.task)).toBeVisible();
  let reads = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/work') && request.method() === 'GET') reads++;
  });
  const otherTab = await accounts.owner.context.newPage();
  try {
    await otherTab.goto('about:blank');
    await otherTab.bringToFront();
    const background = await page.evaluate(() => ({
      visibility: document.visibilityState,
      focused: document.hasFocus(),
    }));
    await testInfo.attach('real-background-state', {
      body: JSON.stringify(background),
      contentType: 'application/json',
    });
    test.skip(
      background.visibility !== 'hidden',
      'This browser exposes background tabs as visible; real visibility timing needs a browser/window environment that reports hidden. No synthetic visibility override was used.',
    );
    const before = reads;
    await page.waitForTimeout(5_500); // Deliberate observation over one real 5-second polling interval.
    expect(reads).toBe(before);
    await work(accounts.editor, {
      action: 'updateTask',
      id: fixture.task.id,
      revision: fixture.task.revision,
      patch: { title: `${fixture.task.title} changed while hidden` },
    });
    await page.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible');
    await expect(taskLink(page, fixture.task)).toContainText('changed while hidden');
    expect(reads).toBeGreaterThan(before);
  } finally {
    await otherTab.close();
  }
});

test('an owner changing an editor role ends the editor open session and removes its draft controls', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts);
  const admin = createDatabase(environment.adminURL);
  const savedSessions = (
    await admin.query('SELECT to_jsonb(s) AS row FROM auth_session s WHERE "userId"=$1', [accounts.editor.id])
  ).rows.map((item) => item.row);
  const membership = (
    await admin.query('SELECT workspace_id,role FROM membership WHERE user_id=$1', [accounts.editor.id])
  ).rows[0];
  const page = accounts.editor.page;
  try {
    await page.goto(fixture.path);
    const task = await openTask(page, fixture.task);
    await task
      .getByRole('textbox', { name: /^Task notes/ })
      .fill('This draft must disappear when access is revoked');
    await accounts.owner.page.goto('/team');
    await accounts.owner.page
      .getByRole('combobox', { name: 'Role for QA Editor', exact: true })
      .selectOption('viewer');
    const confirmation = accounts.owner.page.getByRole('dialog', { name: 'Change role?', exact: true });
    await confirmation.getByRole('button', { name: 'Change role', exact: true }).click();
    await expect(confirmation).not.toBeVisible();
    await expect
      .poll(
        async () =>
          /\/sign-in$/.test(page.url()) ||
          (await page
            .getByText('Your session ended. Sign in to load your workspace again.', { exact: true })
            .isVisible()),
      )
      .toBe(true);
    await expect(page.getByRole('textbox', { name: /^Task notes/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save task', exact: true })).toHaveCount(0);
    await work(accounts.editor, undefined, 401);
  } finally {
    // Role changes intentionally revoke sessions. Restore only this isolated fixture's
    // original role/session rows, after closing the page so no late poll can delete them.
    await page.close();
    await admin.query('UPDATE membership SET role=$1 WHERE workspace_id=$2 AND user_id=$3', [
      membership.role,
      membership.workspace_id,
      accounts.editor.id,
    ]);
    await admin.query(
      'INSERT INTO auth_session SELECT * FROM jsonb_populate_recordset(NULL::auth_session,$1::jsonb) ON CONFLICT(id) DO NOTHING',
      [JSON.stringify(savedSessions)],
    );
    await admin.end();
  }
});

test('switching to another existing fictional session clears the prior account draft and uses the new role after navigation', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts);
  const page = accounts.owner.page,
    context = accounts.owner.context;
  const original = JSON.parse(await readFile(accounts.owner.storageState, 'utf8'));
  const replacement = JSON.parse(await readFile(accounts.viewer.storageState, 'utf8'));
  try {
    await page.goto(fixture.path);
    const task = await openTask(page, fixture.task);
    await task.getByRole('textbox', { name: /^Task notes/ }).fill('Owner-only unsaved text');
    // Controlled session-cookie replacement represents an account change outside
    // this mounted tab. It is not a sign-in/password-entry UI test.
    await context.clearCookies();
    await context.addCookies(replacement.cookies);
    await expect
      .poll(
        async () =>
          /\/sign-in$/.test(page.url()) ||
          (await page
            .getByText('Your session ended. Sign in to load your workspace again.', { exact: true })
            .isVisible()),
      )
      .toBe(true);
    await expect(page.getByRole('textbox', { name: /^Task notes/ })).toHaveCount(0);
    await page.goto(fixture.path);
    await expect(page.getByRole('button', { name: 'Account: QA Viewer', exact: true })).toBeVisible();
    const viewerTask = await openTask(page, fixture.task);
    await expect(viewerTask.getByRole('button', { name: 'Save task', exact: true })).toHaveCount(0);
    await expect(viewerTask.getByText('Owner-only unsaved text', { exact: true })).toHaveCount(0);
  } finally {
    await page.close();
    await context.clearCookies();
    await context.addCookies(original.cookies);
  }
});
