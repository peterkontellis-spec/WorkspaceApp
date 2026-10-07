import { randomUUID } from 'node:crypto';
import { test, expect, boardFixture, environment, work } from './fixtures.mjs';

const day = '2026-10-07';
const fixed = new Date('2026-10-07T09:00:00Z');
const reportPath = (taskId, from = day, to = day) => `/time?${new URLSearchParams({ from, to, taskId })}`;
const apiPath = (taskId, from = day, to = day) =>
  `/api/time?${new URLSearchParams({ from, to, taskId, timeZone: 'Europe/Athens' })}`;
async function time(account, payload, status = 200) {
  const response = await account.context.request.post('/api/time', {
    headers: { origin: environment.baseURL },
    data: payload,
  });
  expect(response.status(), await response.text()).toBe(status);
  return response.json();
}
async function report(account, taskId, from = day, to = day) {
  const response = await account.context.request.get(apiPath(taskId, from, to));
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}
async function add(account, task, durationSeconds, notes, workDate = day) {
  return (
    await time(account, {
      action: 'add',
      creationId: randomUUID(),
      taskId: task.id,
      taskRevision: task.revision,
      workDate,
      durationSeconds,
      notes,
    })
  ).entry;
}
const entryRow = (page, note) => page.locator('.time-entry').filter({ hasText: note });
const total = (page) => page.locator('.time-total strong');
async function fillManual(page, task, { minutes = '30', notes = 'Manual browser entry' } = {}) {
  await page.getByRole('combobox', { name: 'Entry task', exact: true }).selectOption(task.id);
  await page.getByRole('spinbutton', { name: 'Minutes', exact: true }).fill(minutes);
  await page.getByRole('textbox', { name: 'Time note', exact: true }).fill(notes);
}

test('time timer survives refresh, appears throughout the workspace and stops as one durable entry', async ({
  accounts,
}) => {
  const { task } = await boardFixture(accounts);
  const owner = accounts.owner,
    page = owner.page;
  // Use actual server/browser time for elapsed duration; never advance only the browser clock.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens' }).format(new Date());
  try {
    await page.goto(reportPath(task.id, today, today));
    await page.getByRole('combobox', { name: 'Timer task', exact: true }).selectOption(task.id);
    await page.getByRole('button', { name: 'Start timer', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stop timer', exact: true })).toBeVisible();
    const started = (await report(owner, task.id, today, today)).activeTimer;
    expect(started.taskId).toBe(task.id);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Stop timer', exact: true })).toBeVisible();
    expect((await report(owner, task.id, today, today)).activeTimer.id).toBe(started.id);
    await page.goto('/home');
    const badge = page.getByRole('link', { name: new RegExp(`^Timer running · ${task.title}`) });
    await expect(badge).toBeVisible();
    await badge.click();
    await expect(page).toHaveURL(/\/time$/);
    await page.getByRole('button', { name: 'Stop timer', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start timer', exact: true })).toBeVisible();
    await expect(page.locator('.active-time-notice')).toHaveCount(0);
    const saved = await report(owner, task.id, today, today);
    expect(saved.activeTimer).toBeNull();
    expect(saved.entries).toHaveLength(1);
    expect(saved.entries[0].id).toBe(started.id);
    expect(saved.entries[0].endedAt).toBeTruthy();
    expect(saved.entries[0].durationSeconds).toBeGreaterThanOrEqual(0);
    await page.goto(reportPath(task.id, today, today));
    await page.reload();
    await expect(page.locator('.time-entry')).toHaveCount(1);
  } finally {
    const active = (await report(owner, task.id, today, today)).activeTimer;
    if (active?.taskId === task.id)
      await time(owner, { action: 'stop', id: active.id, revision: active.revision });
  }
});

test('time records are shared while owner and editor can change only their own entries and viewer remains read-only', async ({
  accounts,
}) => {
  const { task } = await boardFixture(accounts);
  const owned = await add(accounts.owner, task, 1800, 'Owner private editing rights');
  const edited = await add(accounts.editor, task, 900, 'Editor private editing rights');
  for (const [key, ownNote, otherNote] of [
    ['owner', owned.notes, edited.notes],
    ['editor', edited.notes, owned.notes],
  ]) {
    const page = accounts[key].page;
    await page.goto(reportPath(task.id));
    await expect(total(page)).toHaveText('0h 45m 0s');
    await expect(
      entryRow(page, ownNote).getByRole('button', { name: 'Edit entry', exact: true }),
    ).toBeVisible();
    await expect(entryRow(page, otherNote).getByRole('button')).toHaveCount(0);
  }
  const viewer = accounts.viewer.page;
  await viewer.goto(reportPath(task.id));
  await expect(total(viewer)).toHaveText('0h 45m 0s');
  await expect(viewer.locator('.time-entry')).toHaveCount(2);
  await expect(viewer.locator('.time-entry').getByRole('button')).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: /^(Start timer|Save time entry)$/ })).toHaveCount(0);
  // Server assertions complement the UI controls; hidden buttons alone are not authorization.
  for (const [account, foreign] of [
    [accounts.owner, edited],
    [accounts.editor, owned],
    [accounts.viewer, owned],
  ])
    await time(account, { action: 'void', id: foreign.id, revision: foreign.revision }, 403);
  await accounts.editor.page.getByRole('button', { name: 'Edit entry', exact: true }).click();
  await accounts.editor.page.getByRole('spinbutton', { name: 'Minutes', exact: true }).fill('20');
  await accounts.editor.page.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(total(accounts.owner.page)).toHaveText('0h 50m 0s');
  await expect(total(viewer)).toHaveText('0h 50m 0s');
});

test('time manual creation, correction, reversible void and date/task filters keep totals consistent', async ({
  accounts,
}) => {
  const { task, board } = await boardFixture(accounts);
  const { task: otherTask } = await boardFixture(accounts);
  await add(accounts.editor, task, 600, 'Previous day shared entry', '2026-10-06');
  await add(accounts.editor, otherTask, 7200, 'Other task must not enter filtered total');
  const page = accounts.owner.page;
  await page.clock.setFixedTime(fixed);
  await page.goto(reportPath(task.id));
  await fillManual(page, task, { notes: 'Manual corrected browser entry' });
  await page.getByRole('button', { name: 'Save time entry', exact: true }).click();
  await expect(total(page)).toHaveText('0h 30m 0s');
  const row = entryRow(page, 'Manual corrected browser entry');
  await row.getByRole('button', { name: 'Edit entry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Correct your entry', exact: true })).toBeFocused();
  await page.getByRole('spinbutton', { name: 'Minutes', exact: true }).fill('45');
  await page.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(total(page)).toHaveText('0h 45m 0s');
  await row.getByRole('button', { name: 'Void entry', exact: true }).click();
  await expect(total(page)).toHaveText('0h 45m 0s');
  await row.getByRole('button', { name: 'Confirm void', exact: true }).click();
  await expect(total(page)).toHaveText('0h 0m 0s');
  await expect(row).toContainText('Voided');
  await page.reload();
  await row.getByRole('button', { name: 'Restore entry', exact: true }).click();
  await expect(total(page)).toHaveText('0h 45m 0s');
  await page.getByRole('button', { name: /^From date / }).click();
  await page
    .getByRole('region', { name: 'Choose from date', exact: true })
    .locator('[data-date="2026-10-06"]')
    .click();
  await page.getByRole('button', { name: 'Apply dates and task', exact: true }).click();
  await expect(page).toHaveURL(/from=2026-10-06/);
  await expect(total(page)).toHaveText('0h 55m 0s');
  await expect(page.getByRole('region', { name: 'Time by board', exact: true })).toContainText(board.name);
  await expect(
    page.getByRole('region', { name: 'Time by date', exact: true }).getByRole('listitem'),
  ).toHaveCount(2);
  await page.locator('summary').filter({ hasText: 'Totals by task' }).click();
  await expect(page.locator('.time-task-totals')).toContainText(task.title);
  await expect(page.locator('.time-task-totals')).not.toContainText(otherTask.title);
  await page.getByRole('combobox', { name: 'Task filter', exact: true }).selectOption(otherTask.id);
  await page.getByRole('button', { name: 'Apply dates and task', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`taskId=${otherTask.id}`));
  await expect(total(page)).toHaveText('2h 0m 0s');
});

test('time uncertain save keeps the draft and retry does not duplicate a committed entry', async ({
  accounts,
}) => {
  const { task } = await boardFixture(accounts);
  const owner = accounts.owner,
    page = owner.page;
  await page.clock.setFixedTime(fixed);
  await page.goto(reportPath(task.id));
  await fillManual(page, task, { minutes: '17', notes: 'Retained uncertain time input' });
  owner.expectedConsoleErrors.push(/net::ERR_FAILED/);
  let committed = false;
  await page.route('**/api/time', async (route) => {
    if (route.request().method() === 'POST' && !committed) {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      committed = true;
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Save time entry', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Time note', exact: true })).toHaveValue(
    'Retained uncertain time input',
  );
  await expect(page.getByRole('spinbutton', { name: 'Minutes', exact: true })).toHaveValue('17');
  await expect(page.getByRole('button', { name: 'Save time entry', exact: true })).toBeEnabled();
  expect(committed).toBe(true);
  expect((await report(owner, task.id)).entries).toHaveLength(1);
  await expect(total(page)).toHaveText('0h 17m 0s');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Save could not be confirmed. Your input is kept.',
  );
  await page.getByRole('button', { name: 'Save time entry', exact: true }).click();
  await expect(total(page)).toHaveText('0h 17m 0s');
  await expect(page.getByRole('textbox', { name: 'Time note', exact: true })).toHaveValue('');
  expect((await report(owner, task.id)).entries).toHaveLength(1);
  await page.unroute('**/api/time');
});

test('time invalid date links recover through filters and stale corrections preserve unsaved input', async ({
  accounts,
}) => {
  const { task } = await boardFixture(accounts);
  const entry = await add(accounts.owner, task, 1800, 'Entry for competing corrections');
  const owner = accounts.owner,
    page = owner.page;
  owner.expectedConsoleErrors.push(/Failed to load resource:.*400/);
  await page.clock.setFixedTime(fixed);
  await page.goto(reportPath(task.id, 'not-a-date', day));
  await expect(page.getByRole('heading', { name: 'Time', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Choose a valid date.');
  await page.getByRole('button', { name: /^From date / }).click();
  await page
    .getByRole('region', { name: 'Choose from date', exact: true })
    .locator('[data-date="2026-10-07"]')
    .click();
  await page.getByRole('button', { name: 'Apply dates and task', exact: true }).click();
  await expect(page).toHaveURL(/from=2026-10-07/);
  await expect(total(page)).toHaveText('0h 30m 0s');
  await entryRow(page, entry.notes).getByRole('button', { name: 'Edit entry', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Minutes', exact: true }).fill('20');
  await page.getByRole('textbox', { name: 'Time note', exact: true }).fill('Keep this unsaved correction');
  // A separate HTTP request represents another device using the same account.
  await time(owner, {
    action: 'update',
    id: entry.id,
    revision: entry.revision,
    patch: { workDate: day, durationSeconds: 2700, notes: 'Already corrected by another device' },
  });
  await page.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'This time entry changed. Reload before saving.',
  );
  await expect(page.getByRole('textbox', { name: 'Time note', exact: true })).toHaveValue(
    'Keep this unsaved correction',
  );
  await expect(page.getByRole('spinbutton', { name: 'Minutes', exact: true })).toHaveValue('20');
  const saved = (await report(owner, task.id)).entries.find((item) => item.id === entry.id);
  expect(saved.durationSeconds).toBe(2700);
  expect(saved.notes).toBe('Already corrected by another device');
  await page.getByRole('button', { name: 'Discard time input', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh time', exact: true }).click();
  await entryRow(page, saved.notes).getByRole('button', { name: 'Edit entry', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Minutes', exact: true })).toHaveValue('45');
});

test('time desktop and narrow light and dark layouts expose keyboard controls without page overflow', async ({
  accounts,
}, testInfo) => {
  const fixture = await boardFixture(accounts);
  const snapshot = await work(accounts.owner, {
    action: 'updateTask',
    id: fixture.task.id,
    revision: fixture.task.revision,
    patch: {
      title: `Time entry with a longer task title to check small screen wrapping ${randomUUID().slice(0, 8)}`,
    },
  });
  const task = snapshot.tasks.find((item) => item.id === fixture.task.id);
  await add(
    accounts.owner,
    task,
    3661,
    'Long detailed time note for planning, investigation, and checking the resulting work on a narrow screen.',
  );
  const page = accounts.owner.page;
  await page.clock.setFixedTime(fixed);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const mode of ['dark', 'light']) {
      await page.goto(reportPath(task.id));
      await expect(total(page)).toHaveText('1h 1m 1s');
      // The application's default dark palette does not require a data-theme attribute.
      const currentMode =
        (await page.locator('html').getAttribute('data-theme')) === 'light' ? 'light' : 'dark';
      if (currentMode !== mode)
        await page.getByRole('button', { name: `Switch to ${mode} mode`, exact: true }).click();
      await expect(
        page.getByRole('button', {
          name: `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`,
          exact: true,
        }),
      ).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const from = page.getByRole('button', { name: /^From date / });
      await from.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('region', { name: 'Choose from date', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(from).toBeFocused();
      const edit = page.getByRole('button', { name: 'Edit entry', exact: true });
      await edit.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: 'Correct your entry', exact: true })).toBeFocused();
      await expect(page.getByRole('spinbutton', { name: 'Hours', exact: true })).toHaveValue('1');
      await testInfo.attach(`time-${width}-${mode}`, {
        body: await page.screenshot({
          fullPage: true,
          path: testInfo.outputPath(`time-${width}-${mode}.png`),
        }),
        contentType: 'image/png',
      });
      await page.getByRole('button', { name: 'Discard time input', exact: true }).click();
    }
  }
});
