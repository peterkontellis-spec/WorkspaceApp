import { test, expect, environment, work, updates, boardFixture, openTask, taskLink } from './fixtures.mjs';
import { createDatabase } from '../../src/server/database.mjs';
import { runJobs } from '../../src/server/jobs-core.mjs';

const section = (dialog) => dialog.getByRole('region', { name: 'Deadline reminders', exact: true });
const before = (dialog) => section(dialog).getByRole('checkbox', { name: /^One day before/ });
const after = (dialog) => section(dialog).getByRole('checkbox', { name: /^One day overdue/ });
async function patch(account, task, values) {
  const current = (await work(account)).tasks.find((item) => item.id === task.id);
  return (
    await work(account, { action: 'updateTask', id: task.id, revision: current.revision, patch: values })
  ).tasks.find((item) => item.id === task.id);
}
async function save(dialog) {
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test('reminders default due-day policy and opt-in choices persist across save and reload with viewer read-only access', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts, { dueDate: '2028-02-29', assigneeIds: [accounts.viewer.id] });
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  let dialog = await openTask(page, fixture.task);
  await expect(section(dialog)).toContainText('On the due date at 09:00 Athens time.');
  await expect(before(dialog)).not.toBeChecked();
  await expect(after(dialog)).not.toBeChecked();
  await before(dialog).check();
  await after(dialog).check();
  expect((await work(accounts.owner)).tasks.find((item) => item.id === fixture.task.id)).toMatchObject({
    reminderBefore: false,
    reminderAfter: false,
  });
  await save(dialog);
  await page.reload();
  dialog = await openTask(page, fixture.task);
  await expect(before(dialog)).toBeChecked();
  await expect(after(dialog)).toBeChecked();
  await page.keyboard.press('Escape');
  await accounts.viewer.page.goto(fixture.path);
  const readonly = await openTask(accounts.viewer.page, fixture.task);
  await expect(section(readonly)).toContainText('one day before and one day overdue');
  await expect(section(readonly).getByRole('checkbox')).toHaveCount(0);
  const current = (await work(accounts.owner)).tasks.find((item) => item.id === fixture.task.id);
  await work(
    accounts.viewer,
    { action: 'updateTask', id: current.id, revision: current.revision, patch: { reminderBefore: false } },
    403,
  );
  expect((await work(accounts.owner)).tasks.find((item) => item.id === fixture.task.id).reminderBefore).toBe(
    true,
  );
});

test('reminders cancelling close, offline saves and revision conflicts retain options until explicit discard', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts);
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  let dialog = await openTask(page, fixture.task);
  await expect(section(dialog)).toContainText('Choose a due date to schedule reminders.');
  await before(dialog).check();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(before(dialog)).toBeChecked();
  expect((await work(accounts.owner)).tasks.find((item) => item.id === fixture.task.id).reminderBefore).toBe(
    false,
  );
  try {
    await accounts.owner.context.setOffline(true);
    await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(before(dialog)).toBeChecked();
    await patch(accounts.editor, fixture.task, { notes: 'Teammate note survives reminder conflict' });
  } finally {
    await accounts.owner.context.setOffline(false);
  }
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('changed');
  await expect(before(dialog)).toBeChecked();
  await dialog.getByRole('button', { name: 'Reload saved task', exact: true }).click();
  await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(before(dialog)).toBeChecked();
  await dialog.getByRole('button', { name: 'Reload saved task', exact: true }).click();
  await dialog.getByRole('button', { name: 'Discard edits and reload', exact: true }).click();
  await expect(before(dialog)).not.toBeChecked();
  await expect(dialog.getByRole('textbox', { name: /^Task notes/ })).toHaveValue(
    'Teammate note survives reminder conflict',
  );
  await after(dialog).check();
  await save(dialog);
  expect((await work(accounts.owner)).tasks.find((item) => item.id === fixture.task.id)).toMatchObject({
    reminderBefore: false,
    reminderAfter: true,
    notes: 'Teammate note survives reminder conflict',
  });
});

test('reminders generated notifications have personal read state, deep links, private access and no invented task activity', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts, {
    dueDate: '2020-01-02',
    assigneeIds: [accounts.viewer.id, accounts.editor.id],
  });
  const admin = createDatabase(environment.adminURL);
  try {
    await runJobs(admin, { now: new Date('2020-01-02T07:00:00Z') });
    await runJobs(admin, { now: new Date('2020-01-02T08:00:00Z') });
  } finally {
    await admin.end();
  }
  const viewerNotices = (await updates(accounts.viewer)).items.filter(
    (item) => item.taskId === fixture.task.id && item.actorName === 'Reminder',
  );
  expect(viewerNotices).toHaveLength(1);
  expect(viewerNotices[0].readAt).toBeNull();
  expect(
    (await updates(accounts.owner)).items.filter(
      (item) => item.taskId === fixture.task.id && item.actorName === 'Reminder',
    ),
  ).toHaveLength(0);
  await updates(accounts.owner, { action: 'setRead', id: viewerNotices[0].id, read: true }, 404);
  const page = accounts.viewer.page;
  await page.goto('/notifications');
  const notice = page
    .locator('.updates-list > li')
    .filter({ has: page.locator(`a[href$="?task=${fixture.task.id}"]`) })
    .filter({ hasText: 'Reminder' });
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText('This task is due on 2020-01-02.');
  await notice
    .getByRole('button', { name: `Mark ${fixture.task.title} notification read`, exact: true })
    .click();
  await expect(
    notice.getByRole('button', { name: `Mark ${fixture.task.title} notification unread`, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    notice.getByRole('button', { name: `Mark ${fixture.task.title} notification unread`, exact: true }),
  ).toBeVisible();
  expect(
    (await updates(accounts.editor)).items.find(
      (item) => item.taskId === fixture.task.id && item.actorName === 'Reminder',
    ).readAt,
  ).toBeNull();
  await notice.getByRole('link', { name: fixture.task.title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`task=${fixture.task.id}`));
  const dialog = page.getByRole('dialog', { name: 'Task details', exact: true });
  await expect(
    dialog.getByRole('region', { name: 'Task activity' }).locator('.updates-list > li'),
  ).toHaveCount(1);
  expect((await work(accounts.owner)).tasks.find((item) => item.id === fixture.task.id).revision).toBe(
    fixture.task.revision,
  );
});

test('reminders options fit desktop and narrow themes with keyboard operation and visible save boundaries', async ({
  accounts,
}, info) => {
  const fixture = await boardFixture(accounts, { dueDate: '2028-02-29', assigneeIds: [accounts.owner.id] });
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  for (const theme of ['light', 'dark']) {
    await page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true }).click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const dialog = await openTask(page, fixture.task);
      await section(dialog).scrollIntoViewIfNeeded();
      await before(dialog).focus();
      const old = await before(dialog).isChecked();
      await page.keyboard.press('Space');
      expect(await before(dialog).isChecked()).toBe(!old);
      await page.keyboard.press('Space');
      expect(await before(dialog).isChecked()).toBe(old);
      await page.keyboard.press('Tab');
      await expect(after(dialog)).toBeFocused();
      await expect(section(dialog)).toContainText('Changes apply when you save the task.');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      for (const control of [before(dialog), after(dialog)]) {
        const label = control.locator('..');
        expect((await label.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: info.outputPath(`reminders-${theme}-${width}.png`), fullPage: true });
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(taskLink(page, fixture.task)).toBeFocused();
    }
  }
});
