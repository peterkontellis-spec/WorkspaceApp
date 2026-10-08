import { randomUUID } from 'node:crypto';
import { test, expect, environment, work, boardFixture, taskLink, openTask } from './fixtures.mjs';

const section = (dialog) => dialog.getByRole('region', { name: 'Prerequisites', exact: true });
async function patch(account, task, values) {
  const current = (await work(account)).tasks.find((item) => item.id === task.id);
  return (
    await work(account, {
      action: 'updateTask',
      id: task.id,
      revision: current.revision,
      patch: values,
    })
  ).tasks.find((item) => item.id === task.id);
}
async function choose(dialog, task) {
  const prerequisites = section(dialog);
  await prerequisites.getByRole('searchbox', { name: 'Find a prerequisite', exact: true }).fill(task.title);
  await prerequisites.getByRole('combobox', { name: 'Prerequisite task', exact: true }).selectOption(task.id);
  await prerequisites.getByRole('button', { name: 'Add prerequisite', exact: true }).click();
  await expect(prerequisites.getByRole('link', { name: task.title, exact: true })).toBeVisible();
}
async function save(dialog) {
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test('dependencies owner and editor share cross-board prerequisites with reverse links, removal undo and archive recovery', async ({
  accounts,
}) => {
  const dependent = await boardFixture(accounts);
  const prerequisite = await boardFixture(accounts);
  const page = accounts.owner.page;
  await page.goto(dependent.path);
  let dialog = await openTask(page, dependent.task);
  await choose(dialog, prerequisite.task);
  await section(dialog).getByRole('link', { name: prerequisite.task.title, exact: true }).click();
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(prerequisite.task.title);
  await page.goBack();
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(dependent.task.title);
  await expect(
    section(dialog).getByRole('link', { name: prerequisite.task.title, exact: true }),
  ).toBeVisible();
  expect(
    (await work(accounts.owner)).tasks.find((item) => item.id === dependent.task.id).dependencyIds,
  ).toEqual([]);
  await save(dialog);
  expect(
    (await work(accounts.owner)).tasks.find((item) => item.id === dependent.task.id).dependencyIds,
  ).toEqual([prerequisite.task.id]);
  await page.reload();
  dialog = await openTask(page, dependent.task);
  await section(dialog).getByRole('link', { name: prerequisite.task.title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`task=${prerequisite.task.id}`));
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(prerequisite.task.title);
  await section(dialog).getByText('Needed by 1 task', { exact: true }).click();
  await section(dialog).getByRole('link', { name: dependent.task.title, exact: true }).click();
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(dependent.task.title);
  await work(accounts.editor, {
    action: 'archiveTask',
    id: prerequisite.task.id,
    revision: prerequisite.task.revision,
  });
  await expect(section(dialog)).toContainText('Archived — restore or remove this prerequisite');
  await expect(section(dialog)).toContainText('1 prerequisite is unresolved.');
  await section(dialog).getByRole('link', { name: prerequisite.task.title, exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Restore task', exact: true })).toBeVisible();
  await accounts.editor.page.goto(dependent.path);
  dialog = await openTask(accounts.editor.page, dependent.task);
  const remove = section(dialog).getByRole('button', {
    name: `Remove prerequisite ${prerequisite.task.title}`,
    exact: true,
  });
  await remove.click();
  await expect(
    section(dialog).getByRole('combobox', { name: 'Prerequisite task', exact: true }),
  ).toBeFocused();
  await section(dialog).getByRole('button', { name: 'Undo removal', exact: true }).click();
  await expect(remove).toBeVisible();
  await remove.click();
  await save(dialog);
  expect(
    (await work(accounts.owner)).tasks.find((item) => item.id === dependent.task.id).dependencyIds,
  ).toEqual([]);
});

test('dependencies live prerequisite completion and reopening update all views without changing dependent status', async ({
  accounts,
}) => {
  const dependent = await boardFixture(accounts, { dueDate: '2028-02-29' });
  const prerequisite = await boardFixture(accounts);
  await patch(accounts.owner, dependent.task, { dependencyIds: [prerequisite.task.id] });
  const views = [
    [accounts.owner, 'table'],
    [accounts.editor, 'kanban'],
    [accounts.viewer, 'calendar'],
  ];
  for (const [account, view] of views) {
    await account.page.goto(`${dependent.path}?view=${view}&month=2028-02`);
    await expect(taskLink(account.page, dependent.task)).toContainText('1 prerequisite unresolved');
  }
  await patch(accounts.colleague, prerequisite.task, { status: 'Done' });
  for (const [account] of views)
    await expect(taskLink(account.page, dependent.task)).toContainText('Prerequisites complete');
  await patch(accounts.colleague, prerequisite.task, { status: 'In progress' });
  for (const [account] of views)
    await expect(taskLink(account.page, dependent.task)).toContainText('1 prerequisite unresolved');
  const dialog = await openTask(accounts.owner.page, dependent.task);
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Done');
  await expect(section(dialog)).toContainText('completion is still allowed');
  await save(dialog);
  expect((await work(accounts.owner)).tasks.find((item) => item.id === dependent.task.id).status).toBe(
    'Done',
  );
  await patch(accounts.colleague, prerequisite.task, { status: 'Done' });
  for (const [account] of views)
    await expect(taskLink(account.page, dependent.task)).toContainText('Prerequisites complete');
  await patch(accounts.colleague, prerequisite.task, { status: 'To do' });
  for (const [account] of views)
    await expect(taskLink(account.page, dependent.task)).toContainText('1 prerequisite unresolved');
  expect((await work(accounts.owner)).tasks.find((item) => item.id === dependent.task.id).status).toBe(
    'Done',
  );
});

test('dependencies viewer sees advisory and reverse links but cannot modify edges through the UI or API', async ({
  accounts,
}) => {
  const dependent = await boardFixture(accounts);
  const prerequisite = await boardFixture(accounts);
  const current = await patch(accounts.owner, dependent.task, { dependencyIds: [prerequisite.task.id] });
  const page = accounts.viewer.page;
  await page.goto(dependent.path);
  const dialog = await openTask(page, dependent.task);
  await expect(section(dialog)).toContainText('1 prerequisite is unresolved.');
  await expect(section(dialog).getByRole('button')).toHaveCount(0);
  await expect(section(dialog).getByRole('combobox')).toHaveCount(0);
  await work(
    accounts.viewer,
    { action: 'updateTask', id: current.id, revision: current.revision, patch: { dependencyIds: [] } },
    403,
  );
  expect((await work(accounts.owner)).tasks.find((item) => item.id === current.id).dependencyIds).toEqual([
    prerequisite.task.id,
  ]);
  await section(dialog).getByRole('link', { name: prerequisite.task.title, exact: true }).click();
  await section(dialog).getByText('Needed by 1 task', { exact: true }).click();
  await expect(section(dialog).getByRole('link', { name: dependent.task.title, exact: true })).toBeVisible();
});

test('dependencies cycle errors retain the chosen draft for correction without changing saved edges', async ({
  accounts,
}) => {
  const first = await boardFixture(accounts);
  const second = await boardFixture(accounts);
  await patch(accounts.owner, first.task, { dependencyIds: [second.task.id] });
  const page = accounts.editor.page;
  accounts.editor.expectedConsoleErrors.push(/Failed to load resource:.*400/);
  await page.goto(second.path);
  const dialog = await openTask(page, second.task);
  await choose(dialog, first.task);
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('dependency cycle');
  await expect(section(dialog).getByRole('link', { name: first.task.title, exact: true })).toBeVisible();
  expect((await work(accounts.owner)).tasks.find((item) => item.id === second.task.id).dependencyIds).toEqual(
    [],
  );
  await section(dialog)
    .getByRole('button', { name: `Remove prerequisite ${first.task.title}`, exact: true })
    .click();
  await dialog
    .getByRole('textbox', { name: /^Task notes/ })
    .fill('Correction after rejected dependency cycle');
  await save(dialog);
  expect((await work(accounts.owner)).tasks.find((item) => item.id === second.task.id).notes).toBe(
    'Correction after rejected dependency cycle',
  );
});

test('dependencies offline and stale saves preserve selected prerequisites and protect a teammate update', async ({
  accounts,
}) => {
  const dependent = await boardFixture(accounts);
  const prerequisite = await boardFixture(accounts);
  const page = accounts.owner.page;
  await page.goto(dependent.path);
  const dialog = await openTask(page, dependent.task);
  await choose(dialog, prerequisite.task);
  try {
    await accounts.owner.context.setOffline(true);
    await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(
      section(dialog).getByRole('link', { name: prerequisite.task.title, exact: true }),
    ).toBeVisible();
    await patch(accounts.editor, dependent.task, { notes: 'Teammate changed this while offline' });
  } finally {
    await accounts.owner.context.setOffline(false);
  }
  // The uncertainty warning deliberately remains visible instead of the newer-version banner.
  await expect(dialog.getByRole('alert')).toContainText('Could not confirm the save.');
  const rejectedSave = page.waitForResponse(
    (response) => response.url().endsWith('/api/work') && response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  expect((await rejectedSave).status()).toBe(409);
  await expect(dialog.getByRole('alert')).toContainText('changed');
  await expect(
    section(dialog).getByRole('link', { name: prerequisite.task.title, exact: true }),
  ).toBeVisible();
  expect((await work(accounts.editor)).tasks.find((item) => item.id === dependent.task.id)).toMatchObject({
    dependencyIds: [],
    notes: 'Teammate changed this while offline',
  });
  await dialog.getByRole('button', { name: 'Reload saved task', exact: true }).click();
  await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(
    section(dialog).getByRole('link', { name: prerequisite.task.title, exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Reload saved task', exact: true }).click();
  await dialog.getByRole('button', { name: 'Discard edits and reload', exact: true }).click();
  await expect(section(dialog)).toContainText('No prerequisites.');
  await choose(dialog, prerequisite.task);
  await save(dialog);
  expect((await work(accounts.owner)).tasks.find((item) => item.id === dependent.task.id)).toMatchObject({
    dependencyIds: [prerequisite.task.id],
    notes: 'Teammate changed this while offline',
  });
});

test('dependencies board template copies internal edges independently and omits external prerequisites', async ({
  accounts,
}) => {
  const source = await boardFixture(accounts);
  const external = await boardFixture(accounts);
  const title = `Internal prerequisite ${randomUUID().slice(0, 8)}`;
  let snapshot = await work(accounts.owner, {
    action: 'createTask',
    boardId: source.board.id,
    groupId: source.group.id,
    title,
  });
  const internal = snapshot.tasks.find((item) => item.title === title);
  await patch(accounts.owner, source.task, { dependencyIds: [internal.id, external.task.id] });
  const response = await accounts.owner.context.request.post('/api/templates', {
    headers: { origin: environment.baseURL },
    data: {
      action: 'save',
      creationId: randomUUID(),
      kind: 'board',
      sourceId: source.board.id,
      revision: source.board.revision,
      name: `Dependency process ${randomUUID().slice(0, 8)}`,
    },
  });
  expect(response.status(), await response.text()).toBe(200);
  const { template } = await response.json();
  const page = accounts.editor.page;
  await page.goto('/templates');
  await page
    .locator(`[data-template-id="${template.id}"]`)
    .getByRole('button', { name: 'Use template', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'New board name', exact: true })
    .fill(`Independent dependency copy ${randomUUID().slice(0, 8)}`);
  await page.getByRole('button', { name: 'Create board from template', exact: true }).click();
  const link = page.getByRole('link', { name: 'Open new board', exact: true });
  await expect(link).toBeVisible();
  const boardId = (await link.getAttribute('href')).split('/').at(-1);
  await link.click();
  snapshot = await work(accounts.editor);
  const copied = snapshot.tasks.find((item) => item.boardId === boardId && item.title === source.task.title);
  const copiedPrerequisite = snapshot.tasks.find(
    (item) => item.boardId === boardId && item.title === internal.title,
  );
  expect(copied.dependencyIds).toEqual([copiedPrerequisite.id]);
  expect(copiedPrerequisite.id).not.toBe(internal.id);
  const dialog = await openTask(page, copied);
  await expect(section(dialog).getByRole('link', { name: internal.title, exact: true })).toHaveAttribute(
    'href',
    new RegExp(copiedPrerequisite.id),
  );
  await expect(section(dialog).getByRole('link', { name: external.task.title, exact: true })).toHaveCount(0);
  await patch(accounts.owner, internal, { status: 'Done' });
  await expect(section(dialog)).toContainText('1 prerequisite is unresolved.');
  expect((await work(accounts.owner)).tasks.find((item) => item.id === copiedPrerequisite.id).status).toBe(
    'To do',
  );
});

test('dependencies controls fit desktop and narrow layouts in both themes with keyboard focus and usable touch targets', async ({
  accounts,
}, info) => {
  const dependent = await boardFixture(accounts);
  const prerequisite = await boardFixture(accounts);
  prerequisite.task = await patch(accounts.owner, prerequisite.task, {
    title: `Long prerequisite ${'readable delivery detail '.repeat(8)}`.slice(0, 220),
  });
  await patch(accounts.owner, dependent.task, { dependencyIds: [prerequisite.task.id] });
  const page = accounts.owner.page;
  await page.goto(dependent.path);
  for (const mode of ['light', 'dark']) {
    await page.getByRole('button', { name: `Switch to ${mode} mode`, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const dialog = await openTask(page, dependent.task);
      const prerequisites = section(dialog);
      await prerequisites.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      const remove = prerequisites.getByRole('button', {
        name: `Remove prerequisite ${prerequisite.task.title}`,
        exact: true,
      });
      const box = await remove.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      await prerequisites.getByRole('searchbox', { name: 'Find a prerequisite', exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(
        prerequisites.getByRole('combobox', { name: 'Prerequisite task', exact: true }),
      ).toBeFocused();
      await page.screenshot({ path: info.outputPath(`dependencies-${mode}-${width}.png`), fullPage: true });
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(taskLink(page, dependent.task)).toBeFocused();
    }
  }
});
