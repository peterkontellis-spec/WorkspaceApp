import { randomUUID } from 'node:crypto';
import { test, expect, work, boardFixture, openTask, taskLink } from './fixtures.mjs';

// All four accounts belong to the disposable harness; this never touches preview data.
test('M3 integrated four-person template project flows through assignment, live updates, notification, completion, views, dashboard and shared time', async ({
  accounts,
}) => {
  test.setTimeout(120000);
  const fixture = await boardFixture(accounts, {
    status: 'Done',
    notes: 'Reusable delivery instructions',
    checklist: [{ id: randomUUID(), label: 'Review delivery', done: true, position: 0 }],
  });
  const owner = accounts.owner.page,
    editor = accounts.editor.page,
    viewer = accounts.viewer.page,
    colleague = accounts.colleague.page;
  const templateName = `Four-person process ${randomUUID().slice(0, 8)}`;
  const boardName = `${templateName} project`;
  await owner.goto('/templates');
  await owner.getByRole('button', { name: 'Save a template', exact: true }).click();
  await owner.getByRole('combobox', { name: 'Saved board', exact: true }).selectOption(fixture.board.id);
  await owner.getByRole('textbox', { name: 'Template name', exact: true }).fill(templateName);
  await owner.getByRole('button', { name: 'Save template', exact: true }).click();
  const template = owner
    .locator('.template-list > li')
    .filter({ has: owner.getByRole('heading', { name: templateName, exact: true }) });
  await template.getByRole('button', { name: 'Use template', exact: true }).click();
  await owner.getByRole('textbox', { name: 'New board name', exact: true }).fill(boardName);
  await owner.getByRole('button', { name: 'Create board from template', exact: true }).click();
  await owner.getByRole('link', { name: 'Open new board', exact: true }).click();
  let snapshot = await work(accounts.owner);
  const board = snapshot.boards.find((b) => b.name === boardName);
  let task = snapshot.tasks.find((t) => t.boardId === board.id);
  expect(task).toMatchObject({ status: 'To do', dueDate: null, assigneeIds: [] });
  const boardPath = `/boards/${board.id}`;
  await Promise.all([editor.goto(boardPath), viewer.goto(boardPath), colleague.goto('/overview')]);
  await expect(taskLink(viewer, task)).toBeVisible();
  await expect(
    colleague.getByRole('progressbar', { name: `${boardName} completion`, exact: true }),
  ).toHaveAttribute('value', '0');
  const dialog = await openTask(owner, task);
  await dialog.getByRole('button', { name: new RegExp(`^Assign people to `) }).click();
  await owner.getByRole('checkbox', { name: 'QA Editor', exact: true }).check();
  await owner.getByRole('checkbox', { name: 'QA Colleague', exact: true }).check();
  await owner.keyboard.press('Escape');
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('In progress');
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(editor.getByRole('combobox', { name: `Status for ${task.title}`, exact: true })).toHaveValue(
    'In progress',
  );
  await expect(viewer.locator('.saved-task').filter({ has: taskLink(viewer, task) })).toContainText(
    'In progress',
  );
  await expect(viewer.getByRole('combobox', { name: `Status for ${task.title}`, exact: true })).toHaveCount(
    0,
  );
  await colleague.goto('/notifications');
  const notices = colleague
    .locator('.updates-list > li')
    .filter({ has: colleague.locator(`a[href$="?task=${task.id}"]`) });
  await expect(notices).not.toHaveCount(0);
  await expect(notices.first()).toContainText(/assigned/i);
  // The assigned editor records work through the actual form, then completes the same task.
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens' }).format(new Date());
  const timePath = `/time?${new URLSearchParams({ from: day, to: day, taskId: task.id })}`;
  await editor.goto(timePath);
  await editor.getByRole('combobox', { name: 'Entry task', exact: true }).selectOption(task.id);
  await editor.getByRole('spinbutton', { name: 'Minutes', exact: true }).fill('25');
  await editor.getByRole('textbox', { name: 'Time note', exact: true }).fill('Four-person delivery work');
  await editor.getByRole('button', { name: 'Save time entry', exact: true }).click();
  await expect(editor.locator('.time-total strong')).toHaveText('0h 25m 0s');
  await editor.goto(boardPath);
  const edit = await openTask(editor, task);
  await edit.getByRole('checkbox', { name: 'Mark Review delivery complete', exact: true }).check();
  await edit.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Done');
  await edit.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(edit).not.toBeVisible();
  await expect(owner.getByRole('combobox', { name: `Status for ${task.title}`, exact: true })).toHaveValue(
    'Done',
  );
  await expect(viewer.locator('.saved-task').filter({ has: taskLink(viewer, task) })).toContainText('Done');
  await colleague.locator('.update-feed').getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(notices.first()).toContainText('In progress to Done');
  await colleague.goto('/overview');
  await expect(
    colleague.getByRole('progressbar', { name: `${boardName} completion`, exact: true }),
  ).toHaveAttribute('value', '1');
  await expect(colleague.getByRole('link', { name: new RegExp(`^${boardName}`) })).toContainText(
    '1 of 1 done · 100%',
  );
  for (const view of ['Table', 'Kanban', 'Calendar']) {
    await viewer
      .getByRole('navigation', { name: 'Board views' })
      .getByRole('link', { name: view, exact: true })
      .click();
    await expect(taskLink(viewer, task)).toBeVisible();
    if (view === 'Kanban')
      await expect(
        viewer
          .getByRole('region', { name: 'Done tasks', exact: true })
          .locator(`[data-saved-task="${task.id}"]`),
      ).toBeVisible();
    if (view === 'Calendar')
      await expect(
        viewer.locator('.saved-calendar-undated').locator(`[data-saved-task="${task.id}"]`),
      ).toBeVisible();
  }
  for (const page of [owner, viewer, colleague]) {
    await page.goto(timePath);
    await expect(page.locator('.time-total strong')).toHaveText('0h 25m 0s');
    await expect(page.locator('.time-entry')).toHaveCount(1);
    await expect(
      page.locator('.time-entry').getByRole('button', { name: 'Edit entry', exact: true }),
    ).toHaveCount(0);
  }
  snapshot = await work(accounts.owner);
  task = snapshot.tasks.find((t) => t.id === task.id);
  expect(task).toMatchObject({ status: 'Done', notes: 'Reusable delivery instructions' });
  expect(task.assigneeIds.sort()).toEqual([accounts.editor.id, accounts.colleague.id].sort());
  expect(task.checklist[0].done).toBe(true);
  expect(snapshot.tasks.find((t) => t.id === fixture.task.id).assigneeIds).toEqual([]);
  await viewer.reload();
  await expect(viewer.locator('.time-total strong')).toHaveText('0h 25m 0s');
});
