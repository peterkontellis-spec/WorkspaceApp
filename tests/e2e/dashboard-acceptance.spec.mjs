import { randomUUID } from 'node:crypto';
import { test, expect, work, environment } from './fixtures.mjs';
import { createDatabase } from '../../src/server/database.mjs';

const noon = new Date('2026-10-07T09:00:00Z'); // 12:00 in the fixture's Europe/Athens timezone.

async function exactCounts(page, label, values) {
  const summary = page.locator(`dl[aria-label="${label}"]`);
  await expect(summary).toBeVisible();
  for (const [name, value] of Object.entries(values)) {
    const term = summary.locator('dt').filter({ hasText: new RegExp(`^${name}$`) });
    await expect(term.locator('..').locator('dd')).toHaveText(String(value));
  }
}

const zero = { Open: 0, 'In progress': 0, Overdue: 0, 'Due today': 0, Done: 0 };

async function createBoard(accounts, label) {
  const name = `${label} ${randomUUID().slice(0, 8)}`;
  const snapshot = await work(accounts.owner, { action: 'createBoard', name });
  const board = snapshot.boards.find((item) => item.name === name);
  return { ...board, groupId: snapshot.groups.find((item) => item.boardId === board.id).id };
}

async function createTask(accounts, board, title, extra = {}, actor = accounts.owner) {
  const snapshot = await work(actor, {
    action: 'createTask',
    boardId: board.id,
    groupId: board.groupId,
    title,
    ...extra,
  });
  return snapshot.tasks.find((item) => item.boardId === board.id && item.title === title);
}

/** Isolate exact totals from earlier disposable scenarios, without deleting their fixtures. */
async function isolatedActiveBoards(accounts, use) {
  const original = (await work(accounts.owner)).boards;
  const originalIds = new Set(original.map((board) => board.id));
  try {
    for (const board of original)
      await work(accounts.owner, { action: 'archiveBoard', id: board.id, revision: board.revision });
    await use();
  } finally {
    let snapshot = await work(accounts.owner);
    // Keep this case's fixtures/history, but do not leave them in subsequent dashboard totals.
    for (const board of snapshot.boards.filter((board) => !originalIds.has(board.id))) {
      await work(accounts.owner, { action: 'archiveBoard', id: board.id, revision: board.revision });
    }
    snapshot = await work(accounts.owner);
    for (const board of snapshot.archivedBoards.filter((board) => originalIds.has(board.id))) {
      await work(accounts.owner, { action: 'restoreBoard', id: board.id, revision: board.revision });
    }
  }
}

test('dashboard counts reflect shared assignments, subtasks, completion and archives, and drill-down links preserve their scope', async ({
  accounts,
}) => {
  await isolatedActiveBoards(accounts, async () => {
    const board = await createBoard(accounts, 'Dashboard counts');
    const shared = await createTask(accounts, board, 'Shared overdue work', {
      status: 'In progress',
      dueDate: '2026-10-06',
      assigneeIds: [accounts.owner.id, accounts.editor.id],
    });
    await createTask(accounts, board, 'Completed past-date work', {
      status: 'Done',
      dueDate: '2026-10-05',
      assigneeIds: [accounts.owner.id],
    });
    await createTask(accounts, board, 'Due-today subtask', {
      parentId: shared.id,
      dueDate: '2026-10-07',
      assigneeIds: [accounts.owner.id],
    });
    await createTask(accounts, board, 'Future editor work', {
      dueDate: '2026-10-08',
      assigneeIds: [accounts.editor.id],
    });
    await createTask(accounts, board, 'Unassigned work');
    await createTask(accounts, board, 'Viewer assignment today', {
      dueDate: '2026-10-07',
      assigneeIds: [accounts.viewer.id],
    });
    const archived = await createTask(accounts, board, 'Archived overdue task', {
      dueDate: '2026-10-01',
      assigneeIds: [accounts.owner.id],
    });
    await work(accounts.owner, { action: 'archiveTask', id: archived.id, revision: archived.revision });
    const archivedBoard = await createBoard(accounts, 'Archived dashboard board');
    await createTask(accounts, archivedBoard, 'Hidden with board', {
      dueDate: '2026-10-01',
      assigneeIds: [accounts.owner.id],
    });
    await work(accounts.owner, {
      action: 'archiveBoard',
      id: archivedBoard.id,
      revision: archivedBoard.revision,
    });

    const page = accounts.owner.page;
    await page.clock.setFixedTime(noon);
    await page.goto('/home');
    await exactCounts(page, 'Your task counts', {
      Open: 2,
      'In progress': 1,
      Overdue: 1,
      'Due today': 1,
      Done: 1,
    });
    await page.getByRole('link', { name: 'Team overview', exact: true }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await exactCounts(page, 'Team task counts', {
      Open: 5,
      'In progress': 1,
      Overdue: 1,
      'Due today': 2,
      Done: 1,
    });
    const progress = page.getByRole('region', { name: 'Board progress', exact: true });
    await expect(progress).toContainText('1 of 6 done · 17%');
    await expect(progress.getByText(archivedBoard.name, { exact: true })).toHaveCount(0);
    await expect(
      progress.getByRole('progressbar', { name: `${board.name} completion`, exact: true }),
    ).toHaveAttribute('value', '1');
    const overdue = page.getByRole('region', { name: /^Overdue work/ });
    await expect(overdue.getByRole('link')).toHaveCount(1);
    await expect(overdue).toContainText(shared.title);
    const workload = page.getByRole('table', { name: 'Team workload', exact: true });
    for (const [name, counts] of [
      ['QA Owner', ['2', '1', '1']],
      ['QA Editor', ['2', '0', '1']],
      ['QA Viewer', ['1', '1', '0']],
      ['Unassigned', ['1', '0', '0']],
    ]) {
      const row = workload
        .getByRole('row')
        .filter({ has: page.getByRole('cell', { name: new RegExp(`^${name}`) }) });
      await expect(row.getByRole('cell').nth(1)).toHaveText(counts[0]);
      await expect(row.getByRole('cell').nth(2)).toHaveText(counts[1]);
      await expect(row.getByRole('cell').nth(3)).toHaveText(counts[2]);
    }
    await progress.getByRole('link', { name: new RegExp(`^${board.name}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/boards/${board.id}$`));
    await page.goto('/overview');
    const ownerCell = page
      .getByRole('table', { name: 'Team workload' })
      .getByRole('cell', { name: /^QA Owner/ });
    await ownerCell.getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`assignee=${accounts.owner.id}`));
    await expect(page.locator('[data-saved-task]')).toHaveCount(3);
    await page.goto('/overview');
    await page
      .getByRole('region', { name: /^Overdue work/ })
      .getByRole('link', { name: new RegExp(`^${shared.title}`) })
      .click();
    await expect(page).toHaveURL(new RegExp(`task=${shared.id}`));
    await expect(
      page
        .getByRole('dialog', { name: 'Task details', exact: true })
        .getByRole('textbox', { name: 'Title', exact: true }),
    ).toHaveValue(shared.title);
  });
});

test('Home recent work and unread notifications follow another account save while the viewer Overview updates without write controls', async ({
  accounts,
}) => {
  await isolatedActiveBoards(accounts, async () => {
    const board = await createBoard(accounts, 'Dashboard live update');
    const changed = await createTask(accounts, board, 'Recently finished assignment', {
      assigneeIds: [accounts.owner.id],
    });
    await createTask(accounts, board, 'Other open assignment', { assigneeIds: [accounts.owner.id] });
    const unread = (await work(accounts.owner)).unreadNotifications;
    const owner = accounts.owner.page,
      viewer = accounts.viewer.page;
    await owner.clock.setFixedTime(noon);
    await viewer.clock.setFixedTime(noon);
    await owner.goto('/home');
    await viewer.goto('/overview');
    await exactCounts(owner, 'Your task counts', { ...zero, Open: 2 });
    await exactCounts(viewer, 'Team task counts', { ...zero, Open: 2 });
    await expect(
      viewer.getByText('Viewer access · shared work is read-only.', { exact: true }),
    ).toBeVisible();
    await work(accounts.editor, {
      action: 'updateTask',
      id: changed.id,
      revision: changed.revision,
      patch: { status: 'Done', notes: 'Updated by another teammate' },
    });
    await exactCounts(owner, 'Your task counts', { ...zero, Open: 1, Done: 1 });
    await exactCounts(viewer, 'Team task counts', { ...zero, Open: 1, Done: 1 });
    const personal = owner.getByRole('region', { name: 'Your work summary', exact: true });
    await expect(
      personal.getByRole('link', { name: `Notifications · ${unread + 1} unread`, exact: true }),
    ).toBeVisible();
    await personal.locator('summary').filter({ hasText: 'Recently updated assigned tasks' }).click();
    await expect(personal.locator('.dashboard-task-list > li').first()).toContainText(changed.title);
    await expect(personal.locator('.dashboard-task-list > li').first()).toContainText('Updated');
    await expect(owner.locator(`[data-saved-task="${changed.id}"]`)).toHaveCount(0); // Done remains in recency, not My Day.
    await personal.getByRole('link', { name: `Notifications · ${unread + 1} unread`, exact: true }).click();
    await expect(owner).toHaveURL(/\/notifications$/);
    await expect(owner.getByRole('link', { name: changed.title, exact: true })).toBeVisible();
    await viewer
      .getByRole('region', { name: 'Board progress' })
      .getByRole('link', { name: new RegExp(`^${board.name}`) })
      .click();
    await expect(viewer).toHaveURL(new RegExp(`/boards/${board.id}$`));
    await viewer.locator(`[data-saved-task="${changed.id}"]`).click();
    const readOnly = viewer.getByRole('dialog', { name: 'Task details', exact: true });
    await expect(readOnly.getByText('You have viewing access.', { exact: false })).toBeVisible();
    await expect(readOnly.getByRole('button', { name: 'Save task', exact: true })).toHaveCount(0);
  });
});

test('empty and populated dashboards fit both themes and the mobile Overview link is keyboard reachable', async ({
  accounts,
}, testInfo) => {
  test.setTimeout(120_000);
  await isolatedActiveBoards(accounts, async () => {
    const page = accounts.owner.page;
    await page.clock.setFixedTime(noon);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const mode of ['light', 'dark']) {
        await page.goto('/home');
        await exactCounts(page, 'Your task counts', zero);
        if ((await page.locator('html').getAttribute('data-theme')) !== mode) {
          await page.getByRole('button', { name: `Switch to ${mode} mode`, exact: true }).click();
        }
        await exactCounts(page, 'Your task counts', zero);
        await expect(page.getByText('No open tasks are assigned to you.', { exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        if (width === 390) {
          const openMenu = page.getByRole('button', { name: 'Open navigation', exact: true });
          await openMenu.focus();
          await page.keyboard.press('Enter');
          const navigation = page.getByRole('navigation', {
            name: 'Mobile workspace navigation',
            exact: true,
          });
          const overview = navigation.getByRole('link', { name: 'Overview', exact: true });
          await overview.focus();
          await expect(overview).toBeFocused();
          await page.keyboard.press('Enter');
          await expect(
            page.getByRole('dialog', { name: 'Workspace navigation', exact: true }),
          ).not.toBeVisible();
        } else {
          const overview = page
            .getByRole('navigation', { name: 'Workspace navigation', exact: true })
            .getByRole('link', { name: 'Overview', exact: true });
          await overview.focus();
          await expect(overview).toBeFocused();
          await page.keyboard.press('Enter');
        }
        await expect(page).toHaveURL(/\/overview$/);
        await exactCounts(page, 'Team task counts', zero);
        await expect(page.getByRole('region', { name: 'Board progress' })).toContainText(
          'No shared boards yet.',
        );
        await expect(page.getByText('No unfinished tasks are overdue.', { exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
        await testInfo.attach(`empty-overview-${mode}-${width}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      }
    }
    const board = await createBoard(
      accounts,
      'Long dashboard board name for shared planning and delivery across several stages',
    );
    await createTask(
      accounts,
      board,
      'A long assigned task title that wraps across lines while keeping the board context and due status readable on a narrow screen',
      { dueDate: '2026-10-07', assigneeIds: [accounts.owner.id, accounts.editor.id] },
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const mode of ['light', 'dark']) {
        for (const path of ['/home', '/overview']) {
          await page.goto(path);
          if ((await page.locator('html').getAttribute('data-theme')) !== mode) {
            await page.getByRole('button', { name: `Switch to ${mode} mode`, exact: true }).click();
          }
          await exactCounts(page, path === '/home' ? 'Your task counts' : 'Team task counts', {
            ...zero,
            Open: 1,
            'Due today': 1,
          });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
            true,
          );
        }
        await testInfo.attach(`populated-overview-${mode}-${width}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      }
    }
  });
});

test('Athens midnight moves unfinished due-today work into overdue without reloading the dashboard', async ({
  accounts,
}) => {
  await isolatedActiveBoards(accounts, async () => {
    const board = await createBoard(accounts, 'Dashboard midnight');
    await createTask(accounts, board, 'Cross-midnight assignment', {
      dueDate: '2026-10-07',
      assigneeIds: [accounts.owner.id],
    });
    const page = accounts.owner.page;
    // Install before navigation, allow normal load, then advance the real hook's
    // midnight timer. This is browser-clock emulation, not an OS timezone change.
    await page.clock.install({ time: new Date('2026-10-07T20:58:00Z') });
    await page.goto('/home');
    await exactCounts(page, 'Your task counts', { ...zero, Open: 1, 'Due today': 1 });
    await page.clock.pauseAt(new Date('2026-10-07T20:59:50Z'));
    await page.clock.runFor(10_200);
    await exactCounts(page, 'Your task counts', { ...zero, Open: 1, Overdue: 1 });
    await expect(page).toHaveURL(/\/home$/);
    expect(await page.evaluate(() => new Date().getHours())).toBe(0);
    await page.clock.resume();
  });
});

test('Overview retains inactive assignments, reports offline data honestly, and lets an owner recover the assignment', async ({
  accounts,
}) => {
  await isolatedActiveBoards(accounts, async () => {
    const database = createDatabase(environment.adminURL);
    const original = await database.query('SELECT disabled_at FROM app_user WHERE id = $1', [
      accounts.colleague.id,
    ]);
    const page = accounts.owner.page;
    try {
      const board = await createBoard(accounts, 'Dashboard inactive assignment');
      const inactive = await createTask(accounts, board, 'Recover inactive-only assignment', {
        dueDate: '2026-10-07',
        assigneeIds: [accounts.colleague.id],
      });
      const shared = await createTask(accounts, board, 'Assignment with an active teammate', {
        assigneeIds: [accounts.colleague.id, accounts.owner.id],
      });
      const unassigned = await createTask(accounts, board, 'Unassigned concurrent update');
      await page.clock.setFixedTime(noon);
      await page.goto('/overview');
      await exactCounts(page, 'Team task counts', { ...zero, Open: 3, 'Due today': 1 });

      // Toggle only the isolated fixture row. Do not authenticate this account
      // while disabled: that would revoke its reusable fixture session.
      await database.query('UPDATE app_user SET disabled_at = now() WHERE id = $1', [accounts.colleague.id]);
      const workload = page.getByRole('table', { name: 'Team workload', exact: true });
      const inactiveRow = workload
        .getByRole('row')
        .filter({ has: page.getByRole('cell', { name: 'No active assignee', exact: true }) });
      await expect(inactiveRow).toBeVisible();
      await expect(inactiveRow.getByRole('cell')).toHaveText(['No active assignee', '1', '1', '0']);
      await expect(workload.getByRole('cell', { name: /^QA Colleague/ })).toHaveCount(0);
      await exactCounts(page, 'Team task counts', { ...zero, Open: 3, 'Due today': 1 });
      const unassignedRow = workload
        .getByRole('row')
        .filter({ has: page.getByRole('cell', { name: /^Unassigned/ }) });
      await expect(unassignedRow.getByRole('cell').nth(1)).toHaveText('1');
      const recovery = page
        .locator('details')
        .filter({ has: page.locator('summary').filter({ hasText: 'Review tasks with no active assignee' }) });
      await recovery.locator('summary').click();
      await expect(recovery.getByRole('link')).toHaveCount(1);
      await expect(recovery.getByRole('link')).toContainText(inactive.title);
      await expect(recovery).not.toContainText(shared.title);

      await accounts.owner.context.setOffline(true);
      await expect(
        page.getByText('Offline or unable to connect · showing the last received work.', { exact: true }),
      ).toBeVisible();
      await work(accounts.editor, {
        action: 'updateTask',
        id: unassigned.id,
        revision: unassigned.revision,
        patch: { status: 'Done' },
      });
      await exactCounts(page, 'Team task counts', { ...zero, Open: 3, 'Due today': 1 });
      await accounts.owner.context.setOffline(false);
      await exactCounts(page, 'Team task counts', { ...zero, Open: 2, 'Due today': 1, Done: 1 });
      await expect(
        page.getByText('Offline or unable to connect · showing the last received work.', { exact: true }),
      ).toHaveCount(0);

      await recovery.getByRole('link').click();
      const dialog = page.getByRole('dialog', { name: 'Task details', exact: true });
      const assign = dialog.getByRole('button', { name: /^Assign people to/ });
      await expect(assign).toHaveAccessibleName(/1 inactive assignee/);
      await assign.click();
      await dialog.getByRole('button', { name: 'Remove inactive assignees', exact: true }).click();
      await dialog.getByRole('checkbox', { name: 'QA Owner', exact: true }).check();
      await dialog.getByRole('button', { name: 'Done', exact: true }).click();
      await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
      await expect
        .poll(
          async () => (await work(accounts.owner)).tasks.find((task) => task.id === inactive.id)?.assigneeIds,
        )
        .toEqual([accounts.owner.id]);
      await page.goto('/overview');
      await exactCounts(page, 'Team task counts', { ...zero, Open: 2, 'Due today': 1, Done: 1 });
      await expect(page.getByRole('cell', { name: 'No active assignee', exact: true })).toHaveCount(0);
      await expect(
        page.locator('summary').filter({ hasText: 'Review tasks with no active assignee' }),
      ).toHaveCount(0);
    } finally {
      await accounts.owner.context.setOffline(false);
      await database.query('UPDATE app_user SET disabled_at = $1 WHERE id = $2', [
        original.rows[0].disabled_at,
        accounts.colleague.id,
      ]);
      await database.end();
    }
  });
});
