import { randomUUID } from 'node:crypto';
import { test, expect, environment, work, boardFixture, openTask, taskLink } from './fixtures.mjs';
import { createDatabase } from '../../src/server/database.mjs';
import { runJobs } from '../../src/server/jobs-core.mjs';

const section = (dialog) => dialog.getByRole('region', { name: 'Repeat task', exact: true });
const enabled = (dialog) => section(dialog).getByRole('checkbox', { name: 'Repeat this task', exact: true });
const copies = (snapshot, source) =>
  snapshot.tasks.filter((task) => task.recurrence?.sourceTaskId === source.id && !task.recurrence.isSource);
const configuration = (mode = 'calendar', extra = {}) => ({
  mode,
  unit: 'day',
  interval: 1,
  timeZone: 'Europe/Athens',
  enabled: true,
  ...extra,
});
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
async function configure(
  dialog,
  { mode = 'Fixed calendar dates', every = '1', period = 'Days', zone = 'Europe/Athens' } = {},
) {
  await enabled(dialog).check();
  await section(dialog).getByRole('combobox', { name: 'Mode', exact: true }).selectOption({ label: mode });
  await section(dialog).getByRole('spinbutton', { name: 'Every', exact: true }).fill(every);
  await section(dialog)
    .getByRole('combobox', { name: 'Period', exact: true })
    .selectOption({ label: period });
  await section(dialog).getByRole('textbox', { name: 'Time zone', exact: true }).fill(zone);
}
async function tick(now) {
  const admin = createDatabase(environment.adminURL);
  try {
    return await runJobs(admin, { now: new Date(now), maxJobs: 1000 });
  } finally {
    await admin.end();
  }
}

test('recurrence configuration persists through reload and pause/resume while viewers remain read-only', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts, { dueDate: '2030-01-31' });
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  let dialog = await openTask(page, fixture.task);
  await expect(enabled(dialog)).not.toBeChecked();
  await configure(dialog, { every: '2', period: 'Weeks', zone: 'America/New_York' });
  expect(
    (await work(accounts.owner)).tasks.find((item) => item.id === fixture.task.id).recurrence,
  ).toBeNull();
  await save(dialog);
  await page.reload();
  dialog = await openTask(page, fixture.task);
  await expect(enabled(dialog)).toBeChecked();
  await expect(section(dialog).getByRole('spinbutton', { name: 'Every', exact: true })).toHaveValue('2');
  await expect(section(dialog).getByRole('textbox', { name: 'Time zone', exact: true })).toHaveValue(
    'America/New_York',
  );
  await enabled(dialog).uncheck();
  await save(dialog);
  let source = (await work(accounts.owner)).tasks.find((item) => item.id === fixture.task.id);
  expect(source.recurrence).toMatchObject({ enabled: false, mode: 'calendar', interval: 2, unit: 'week' });
  await page.reload();
  dialog = await openTask(page, fixture.task);
  await enabled(dialog).check();
  await save(dialog);
  source = (await work(accounts.owner)).tasks.find((item) => item.id === fixture.task.id);
  expect(source.recurrence.enabled).toBe(true);
  await accounts.viewer.page.goto(fixture.path);
  const readonly = await openTask(accounts.viewer.page, source);
  await expect(section(readonly)).toBeVisible();
  await expect(section(readonly).getByRole('checkbox')).toHaveCount(0);
  await expect(section(readonly).getByRole('combobox')).toHaveCount(0);
  await work(
    accounts.viewer,
    {
      action: 'updateTask',
      id: source.id,
      revision: source.revision,
      patch: { recurrence: { enabled: false } },
    },
    403,
  );
  expect((await work(accounts.owner)).tasks.find((item) => item.id === source.id).recurrence.enabled).toBe(
    true,
  );
});

test('recurrence cancel, offline and conflicting saves preserve schedule choices until explicit discard', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts, { dueDate: '2030-01-31' });
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  const dialog = await openTask(page, fixture.task);
  await configure(dialog, { mode: 'After completion', every: '3', period: 'Months' });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(enabled(dialog)).toBeChecked();
  try {
    await accounts.owner.context.setOffline(true);
    await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await patch(accounts.editor, fixture.task, {
      notes: 'A teammate edit must survive the recurrence conflict.',
    });
  } finally {
    await accounts.owner.context.setOffline(false);
  }
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('changed');
  await expect(section(dialog).getByRole('spinbutton', { name: 'Every', exact: true })).toHaveValue('3');
  await dialog.getByRole('button', { name: 'Reload saved task', exact: true }).click();
  await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(enabled(dialog)).toBeChecked();
  await dialog.getByRole('button', { name: 'Reload saved task', exact: true }).click();
  await dialog.getByRole('button', { name: 'Discard edits and reload', exact: true }).click();
  await expect(enabled(dialog)).not.toBeChecked();
  await expect(dialog.getByRole('textbox', { name: /^Task notes/ })).toHaveValue(
    'A teammate edit must survive the recurrence conflict.',
  );
  await configure(dialog, { mode: 'After completion', every: '3', period: 'Months' });
  await save(dialog);
  expect((await work(accounts.owner)).tasks.find((item) => item.id === fixture.task.id)).toMatchObject({
    notes: 'A teammate edit must survive the recurrence conflict.',
    recurrence: { mode: 'completion', interval: 3, unit: 'month', enabled: true },
  });
});

test('recurrence calendar month-end catch-up preserves independent frozen copies until explicit template refresh', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts, {
    dueDate: '2030-01-31',
    notes: 'Frozen original notes',
    assigneeIds: [accounts.editor.id],
    checklist: [{ id: randomUUID(), label: 'Repeatable preparation', done: true, position: 0 }],
  });
  const prerequisite = await boardFixture(accounts);
  await patch(accounts.owner, fixture.task, {
    dependencyIds: [prerequisite.task.id],
    reminderBefore: true,
    reminderAfter: true,
    priority: 'High',
  });
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  let dialog = await openTask(page, fixture.task);
  await configure(dialog, { period: 'Months' });
  await expect(section(dialog)).toContainText(/files|attachments/i);
  await expect(section(dialog)).toContainText(/history/i);
  await save(dialog);
  await tick('2030-03-15T12:00:00Z');
  let snapshot = await work(accounts.owner);
  let generated = copies(snapshot, fixture.task).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  expect(generated.map((task) => task.dueDate)).toEqual(['2030-02-28', '2030-03-31']);
  for (const task of generated) {
    expect(task).toMatchObject({
      notes: 'Frozen original notes',
      priority: 'High',
      status: 'To do',
      parentId: null,
      dependencyIds: [],
      assigneeIds: [accounts.editor.id],
      reminderBefore: true,
      reminderAfter: true,
    });
    expect(task.checklist).toHaveLength(1);
    expect(task.checklist[0]).toMatchObject({ label: 'Repeatable preparation', done: false });
    expect(task.checklist[0].id).not.toBe(fixture.task.checklist[0].id);
  }
  await page.reload();
  dialog = await openTask(page, generated[0]);
  await expect(section(dialog).getByRole('checkbox')).toHaveCount(0);
  await patch(accounts.owner, fixture.task, { recurrence: { enabled: false } });
  await expect(section(dialog)).toContainText('Paused.');
  await patch(accounts.owner, fixture.task, { recurrence: { enabled: true } });
  await expect(section(dialog)).not.toContainText('Paused.');
  await section(dialog).getByRole('link', { name: 'Manage original task', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`task=${fixture.task.id}`));
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(fixture.task.title);
  await dialog
    .getByRole('textbox', { name: /^Task notes/ })
    .fill('New notes for future copies only after opt-in');
  await save(dialog);
  await tick('2030-04-15T12:00:00Z');
  snapshot = await work(accounts.owner);
  expect(copies(snapshot, fixture.task).find((task) => task.dueDate === '2030-04-30').notes).toBe(
    'Frozen original notes',
  );
  await page.reload();
  dialog = await openTask(page, fixture.task);
  await section(dialog)
    .getByRole('checkbox', { name: 'Use current task details for future copies', exact: true })
    .check();
  await save(dialog);
  await tick('2030-05-15T12:00:00Z');
  snapshot = await work(accounts.owner);
  expect(copies(snapshot, fixture.task).find((task) => task.dueDate === '2030-05-31').notes).toBe(
    'New notes for future copies only after opt-in',
  );
  expect(copies(snapshot, fixture.task).find((task) => task.dueDate === '2030-02-28').notes).toBe(
    'Frozen original notes',
  );
  const changed = copies(snapshot, fixture.task).find((task) => task.dueDate === '2030-03-31');
  await patch(accounts.editor, changed, { notes: 'Independent copy edit' });
  expect((await work(accounts.owner)).tasks.find((task) => task.id === fixture.task.id).notes).toBe(
    'New notes for future copies only after opt-in',
  );
});

test('recurrence completion successors follow first Done transitions and generated copies cannot reconfigure the series', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts);
  await patch(accounts.owner, fixture.task, { recurrence: configuration('completion') });
  const page = accounts.editor.page;
  await page.goto(fixture.path);
  let dialog = await openTask(page, fixture.task);
  await section(dialog).scrollIntoViewIfNeeded();
  await expect(section(dialog)).toContainText(/completion/i);
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Done');
  await save(dialog);
  await tick(new Date().toISOString());
  let snapshot = await work(accounts.owner);
  let generated = copies(snapshot, fixture.task);
  expect(generated).toHaveLength(1);
  const first = generated[0];
  await work(
    accounts.editor,
    {
      action: 'updateTask',
      id: first.id,
      revision: first.revision,
      patch: { recurrence: { enabled: false } },
    },
    400,
  );
  await page.reload();
  dialog = await openTask(page, first);
  await expect(section(dialog).getByRole('checkbox')).toHaveCount(0);
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Done');
  await save(dialog);
  await tick(new Date().toISOString());
  snapshot = await work(accounts.owner);
  generated = copies(snapshot, fixture.task);
  expect(generated).toHaveLength(2);
  expect(generated[0].dueDate).toBe(generated[1].dueDate);
  const ids = generated.map((task) => task.id).sort();
  await patch(accounts.editor, fixture.task, { status: 'To do' });
  await patch(accounts.editor, fixture.task, { status: 'Done' });
  await tick(new Date().toISOString());
  expect(
    copies(await work(accounts.owner), fixture.task)
      .map((task) => task.id)
      .sort(),
  ).toEqual(ids);
});

test('recurrence source archive stays paused after restoration until explicitly resumed while copy archive remains independent', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts, { dueDate: '2030-01-01' });
  let source = await patch(accounts.owner, fixture.task, {
    recurrence: configuration('calendar', { anchorDate: '2030-01-01' }),
  });
  let snapshot = await work(accounts.editor, {
    action: 'archiveTask',
    id: source.id,
    revision: source.revision,
  });
  source = snapshot.archivedTasks.find((task) => task.id === source.id);
  await tick('2030-01-05T12:00:00Z');
  expect(copies(await work(accounts.owner), fixture.task)).toHaveLength(0);
  await work(accounts.editor, { action: 'restoreTask', id: source.id, revision: source.revision });
  await tick('2030-01-05T12:00:00Z');
  expect(copies(await work(accounts.owner), fixture.task)).toHaveLength(0);
  const page = accounts.editor.page;
  await page.goto(fixture.path);
  const dialog = await openTask(page, fixture.task);
  await expect(enabled(dialog)).not.toBeChecked();
  await enabled(dialog).check();
  await save(dialog);
  await tick('2030-01-05T12:00:00Z');
  snapshot = await work(accounts.owner);
  const generated = copies(snapshot, fixture.task);
  expect(generated).toHaveLength(2);
  const future = generated.find((task) => task.dueDate === '2030-01-06');
  await work(accounts.editor, { action: 'archiveTask', id: future.id, revision: future.revision });
  await tick('2030-01-07T12:00:00Z');
  snapshot = await work(accounts.owner);
  expect(snapshot.tasks.find((task) => task.id === fixture.task.id).recurrence.enabled).toBe(true);
  expect(copies(snapshot, fixture.task).some((task) => task.dueDate === '2030-01-08')).toBe(true);
});

test('recurrence schedule controls fit desktop and narrow themes with keyboard focus and clear copy rules', async ({
  accounts,
}, info) => {
  const fixture = await boardFixture(accounts, { dueDate: '2030-01-31' });
  await patch(accounts.owner, fixture.task, {
    recurrence: configuration('calendar', { unit: 'month', anchorDate: '2030-01-31' }),
  });
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  for (const theme of ['light', 'dark']) {
    await page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true }).click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const dialog = await openTask(page, fixture.task);
      await section(dialog).scrollIntoViewIfNeeded();
      await enabled(dialog).focus();
      await page.keyboard.press('Space');
      await expect(enabled(dialog)).not.toBeChecked();
      await page.keyboard.press('Space');
      await expect(enabled(dialog)).toBeChecked();
      await page.keyboard.press('Tab');
      await expect(section(dialog).getByRole('combobox', { name: 'Mode', exact: true })).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect((await enabled(dialog).locator('..').boundingBox()).height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: info.outputPath(`recurrence-${theme}-${width}.png`), fullPage: true });
      await section(dialog)
        .getByRole('checkbox', { name: 'Use current task details for future copies', exact: true })
        .focus();
      await section(dialog).getByRole('status').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: info.outputPath(`recurrence-copy-rules-${theme}-${width}.png`),
        fullPage: true,
      });
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(taskLink(page, fixture.task)).toBeFocused();
    }
  }
});
