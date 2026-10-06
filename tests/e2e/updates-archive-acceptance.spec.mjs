import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect, environment, work, updates, boardFixture, openTask } from './fixtures.mjs';
import { createDatabase } from '../../src/server/database.mjs';

async function change(account, task, patch) {
  const snapshot = await work(account, { action: 'updateTask', id: task.id, revision: task.revision, patch });
  return snapshot.tasks.find((item) => item.id === task.id);
}
const taskNotices = (page, task) =>
  page.locator('.updates-list > li').filter({ has: page.locator(`a[href$="?task=${task.id}"]`) });
const activityRows = (region) => region.locator('.updates-list > li');
async function refresh(region) {
  await region.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(region.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
}

test('activity renders every saved field summary while no-op saves and rejected retries add no duplicates', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts, { assigneeIds: [accounts.viewer.id] });
  let task = fixture.task;
  let snapshot = await work(accounts.owner, {
    action: 'createGroup',
    boardId: fixture.board.id,
    name: `Activity group ${task.id}`,
  });
  const group = snapshot.groups.find((item) => item.name === `Activity group ${task.id}`);
  snapshot = await work(accounts.owner, {
    action: 'createColumn',
    boardId: fixture.board.id,
    name: 'Activity text',
    kind: 'text',
  });
  const column = snapshot.columns.find((item) => item.boardId === fixture.board.id);
  snapshot = await work(accounts.owner, {
    action: 'createTask',
    boardId: fixture.board.id,
    groupId: group.id,
    title: `Activity parent ${task.id}`,
  });
  const parent = snapshot.tasks.find((item) => item.title === `Activity parent ${task.id}`);
  const oldRevision = task.revision;
  task = await change(accounts.owner, task, {
    title: `Activity matrix ${task.id}`,
    status: 'In progress',
    priority: 'High',
    dueDate: '2028-02-29',
    groupId: group.id,
    parentId: parent.id,
    position: 17,
    notes: 'Fictional notes must not leak into activity summaries.',
    assigneeIds: [accounts.viewer.id, accounts.editor.id],
    checklist: [{ id: randomUUID(), label: 'Fictional checklist', done: true, position: 0 }],
    fields: [{ columnId: column.id, revision: column.revision, value: 'Fictional field' }],
  });
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  let dialog = await openTask(page, task);
  let activity = dialog.getByRole('region', { name: 'Task activity' });
  await expect(activityRows(activity)).toHaveCount(2);
  await expect(activityRows(activity).first()).toContainText(
    'Changed title, status from To do to In progress, priority from Medium to High, due date from none to 2028-02-29, group, parent task, task order, notes, assignees, checklist, custom fields.',
  );
  await expect(activity).not.toContainText('Fictional notes must not leak');
  await expect(activityRows(activity).last()).toContainText('Created this task.');
  // Actual editor no-op submission: saves a revision, but must not invent an event.
  await dialog.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  dialog = await openTask(page, task);
  activity = dialog.getByRole('region', { name: 'Task activity' });
  await expect(activityRows(activity)).toHaveCount(2);
  await work(
    accounts.owner,
    { action: 'updateTask', id: task.id, revision: oldRevision, patch: { notes: 'Rejected duplicate' } },
    409,
  );
  await refresh(activity);
  await expect(activityRows(activity)).toHaveCount(2);
  task = (await work(accounts.owner)).tasks.find((item) => item.id === task.id);
  task = await change(accounts.owner, task, { assigneeIds: [accounts.editor.id] });
  const viewer = accounts.viewer.page;
  await viewer.goto('/notifications');
  await expect(taskNotices(viewer, task)).toHaveCount(3);
  await expect(taskNotices(viewer, task).first()).toContainText('You were unassigned from this task.');
  task = await change(accounts.owner, task, { assigneeIds: [accounts.editor.id] });
  await refresh(viewer.locator('.update-feed'));
  await expect(taskNotices(viewer, task)).toHaveCount(3);
  await refresh(activity);
  await expect(activityRows(activity)).toHaveCount(3);
  expect(
    (await updates(accounts.viewer)).items.filter(
      (item) => item.taskId === task.id && /unassigned/.test(item.summary),
    ),
  ).toHaveLength(1);
});

test('notification and activity Older Latest and Refresh pages remain distinct as new changes arrive', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts, { assigneeIds: [accounts.viewer.id] });
  let task = fixture.task;
  for (let day = 1; day <= 27; day++)
    task = await change(accounts.owner, task, { dueDate: `2028-03-${String(day).padStart(2, '0')}` });
  const page = accounts.viewer.page;
  await page.goto('/notifications');
  const feed = page.locator('.update-feed');
  await expect(taskNotices(page, task)).toHaveCount(25);
  const latestText = await taskNotices(page, task).allTextContents();
  await feed.getByRole('button', { name: 'Older', exact: true }).click();
  await expect(feed.getByText('Earlier changes', { exact: true })).toBeFocused();
  await expect(taskNotices(page, task)).toHaveCount(3);
  const olderText = await taskNotices(page, task).allTextContents();
  expect(olderText.every((text) => !latestText.includes(text))).toBe(true);
  task = await change(accounts.owner, task, { dueDate: '2028-03-28' });
  await feed.getByRole('button', { name: 'Latest', exact: true }).click();
  await expect(taskNotices(page, task).first()).toContainText('due date from 2028-03-27 to 2028-03-28');
  await expect(feed.getByRole('button', { name: 'Latest', exact: true })).toBeDisabled();
  await feed.getByRole('button', { name: 'Older', exact: true }).click();
  await expect(feed.getByText('Earlier changes', { exact: true })).toBeVisible();
  await refresh(feed);
  await expect(feed.getByText('Latest changes', { exact: true })).toBeFocused();
  await expect(taskNotices(page, task).first()).toContainText('due date from 2028-03-27 to 2028-03-28');
  await taskNotices(page, task).first().getByRole('link', { name: task.title, exact: true }).click();
  const activity = page.getByRole('region', { name: 'Task activity' });
  await expect(activityRows(activity)).toHaveCount(25);
  await activity.getByRole('button', { name: 'Older', exact: true }).click();
  await expect(activityRows(activity)).toHaveCount(4);
  await expect(activityRows(activity).last()).toContainText('Created this task.');
  await activity.getByRole('button', { name: 'Latest', exact: true }).click();
  await expect(activityRows(activity)).toHaveCount(25);
  await expect(activityRows(activity).first()).toContainText('due date from 2028-03-27 to 2028-03-28');
});

test('list-specific network failures retain the last list and recover through Refresh for notifications and activity', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts, { assigneeIds: [accounts.viewer.id] });
  const page = accounts.viewer.page;
  accounts.viewer.expectedConsoleErrors.push(/Failed to load resource:.*503/);
  await page.goto('/notifications');
  await expect(taskNotices(page, fixture.task)).toHaveCount(1);
  let failing = true;
  await page.route('**/api/updates?*', (route) =>
    failing
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Disposable updates interruption.' }),
        })
      : route.continue(),
  );
  const feed = page.locator('.update-feed');
  await refresh(feed);
  await expect(feed.getByRole('alert')).toContainText('The list below may be out of date.');
  await expect(taskNotices(page, fixture.task)).toHaveCount(1);
  await change(accounts.owner, fixture.task, { status: 'Done' });
  failing = false;
  await refresh(feed);
  await expect(feed.getByRole('alert')).toHaveCount(0);
  await expect(taskNotices(page, fixture.task)).toHaveCount(2);
  await taskNotices(page, fixture.task).first().getByRole('link').click();
  const activity = page.getByRole('region', { name: 'Task activity' });
  await expect(activityRows(activity)).toHaveCount(2);
  failing = true;
  await refresh(activity);
  await expect(activity.getByRole('alert')).toContainText('Disposable updates interruption.');
  await expect(activityRows(activity)).toHaveCount(2);
  failing = false;
  await refresh(activity);
  await expect(activity.getByRole('alert')).toHaveCount(0);
  await expect(activityRows(activity)).toHaveCount(2);
});

for (const list of ['notification', 'activity'])
  for (const mode of ['revoked', 'idle-expired'])
    test(`${list} list clears protected entries after its ${mode} session response`, async ({ accounts }) => {
      const fixture = await boardFixture(accounts, { assigneeIds: [accounts.viewer.id] });
      const page = accounts.viewer.page;
      await page.goto('/notifications');
      await expect(taskNotices(page, fixture.task)).toHaveCount(1);
      if (list === 'activity') {
        await taskNotices(page, fixture.task).first().getByRole('link').click();
        await expect(activityRows(page.getByRole('region', { name: 'Task activity' }))).toHaveCount(1);
      }
      const snapshot = await work(accounts.viewer);
      // Isolate the list's own authorization handling from the independent workspace poll.
      await page.route('**/api/work', (route) =>
        route.request().method() === 'GET'
          ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshot) })
          : route.continue(),
      );
      const admin = createDatabase(environment.adminURL);
      const sessions = (
        await admin.query('SELECT * FROM auth_session WHERE "userId"=$1', [accounts.viewer.id])
      ).rows;
      expect(sessions.length).toBeGreaterThan(0);
      try {
        if (mode === 'revoked')
          await admin.query('DELETE FROM auth_session WHERE "userId"=$1', [accounts.viewer.id]);
        else
          await admin.query(
            'UPDATE auth_session SET "updatedAt"=now()-interval \'31 minutes\' WHERE "userId"=$1',
            [accounts.viewer.id],
          );
        await page.locator('.update-feed').getByRole('button', { name: 'Refresh', exact: true }).click();
        const protectedList =
          list === 'activity'
            ? page.getByRole('region', { name: 'Task activity' })
            : page.locator('.updates-page');
        await expect(protectedList.getByRole('alert')).toContainText('Your access changed.');
        await expect(protectedList.locator('.updates-list')).toHaveCount(0);
        await expect(protectedList.getByRole('link', { name: 'Sign in again', exact: true })).toBeVisible();
      } finally {
        // Restore the disposable shared fixture exactly; later tests load its original cookies.
        await admin.query('DELETE FROM auth_session WHERE "userId"=$1', [accounts.viewer.id]);
        for (const session of sessions)
          await admin.query(
            'INSERT INTO auth_session SELECT * FROM json_populate_record(NULL::auth_session,$1::json)',
            [JSON.stringify(session)],
          );
        await admin.end();
        await page.unroute('**/api/work');
      }
    });

test('long task and actor names remain readable with usable notification controls on a narrow viewport', async ({
  accounts,
}, testInfo) => {
  const admin = createDatabase(environment.adminURL);
  const original = (await admin.query('SELECT display_name FROM app_user WHERE id=$1', [accounts.owner.id]))
    .rows[0].display_name;
  const longName = 'QA Fictional Collaborator ' + 'LongName'.repeat(10);
  let fixture;
  try {
    await admin.query('UPDATE app_user SET display_name=$2 WHERE id=$1', [accounts.owner.id, longName]);
    fixture = await boardFixture(accounts, { assigneeIds: [accounts.viewer.id] });
  } finally {
    await admin.query('UPDATE app_user SET display_name=$2 WHERE id=$1', [accounts.owner.id, original]);
    await admin.end();
  }
  const task = await change(accounts.owner, fixture.task, {
    title: 'A lengthy fictional acceptance task ' + 'UnbrokenTaskName'.repeat(12),
  });
  const page = accounts.viewer.page;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notifications');
  const row = taskNotices(page, task).filter({ hasText: longName });
  await expect(row).toHaveCount(1);
  await expect(row.getByText(longName, { exact: true })).toBeVisible();
  await expect(row.getByRole('link', { name: task.title, exact: true })).toBeVisible();
  const button = row.getByRole('button', { name: `Mark ${task.title} notification read`, exact: true });
  await button.click();
  await expect(
    row.getByRole('button', { name: `Mark ${task.title} notification unread`, exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await row.getByRole('link', { name: task.title, exact: true }).click();
  const activity = page.getByRole('region', { name: 'Task activity' });
  await expect(activity.getByText(longName, { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.querySelector('dialog[open]').scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await testInfo.attach('narrow-long-notification-and-activity', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('uploaded bytes and original notification links survive task and board archive restore while active Files excludes them', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts, { assigneeIds: [accounts.viewer.id] });
  const owner = accounts.owner.page,
    viewer = accounts.viewer.page;
  const fileName = `archive-${randomUUID()}.txt`,
    bytes = `Fictional archive acceptance bytes.\n${fixture.task.id}\n`;
  const uploadPath = join(environment.directory, fileName);
  await writeFile(uploadPath, bytes, { mode: 0o600, flag: 'wx' });
  await viewer.goto('/notifications');
  const originalNotice = taskNotices(viewer, fixture.task).first();
  const originalHref = await originalNotice.getByRole('link').getAttribute('href');
  await owner.goto(fixture.path);
  const editor = await openTask(owner, fixture.task);
  await editor.getByLabel('Choose an attachment', { exact: true }).setInputFiles(uploadPath);
  await editor.getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(editor.getByText(`${fileName} uploaded.`, { exact: true })).toBeVisible();
  async function downloadAndCheck() {
    const dialog = viewer.getByRole('dialog', { name: 'Task details', exact: true });
    await expect(dialog.getByLabel('Choose an attachment', { exact: true })).toHaveCount(0);
    const downloading = viewer.waitForEvent('download');
    await dialog.getByRole('link', { name: `Download ${fileName}`, exact: true }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(fileName);
    const savedPath = join(environment.directory, `download-${randomUUID()}.txt`);
    await download.saveAs(savedPath);
    expect(await readFile(savedPath, 'utf8')).toBe(bytes);
  }
  await originalNotice.getByRole('link').click();
  await downloadAndCheck();
  await owner.keyboard.press('Escape');
  await owner.goto('/files');
  await expect(owner.getByRole('link', { name: `Download ${fileName}`, exact: true })).toBeVisible();
  let snapshot = await work(accounts.owner, {
    action: 'archiveTask',
    id: fixture.task.id,
    revision: fixture.task.revision,
  });
  await owner.getByRole('button', { name: 'Refresh files', exact: true }).click();
  await expect(owner.getByRole('button', { name: 'Refresh files', exact: true })).toBeEnabled();
  await expect(owner.getByRole('link', { name: `Download ${fileName}`, exact: true })).toHaveCount(0);
  // Reuse the actual original notification URL, not an archive-specific substitute.
  await viewer.goto(originalHref);
  await expect(
    viewer.getByText('Archived task · history and files are retained.', { exact: true }),
  ).toBeVisible();
  await downloadAndCheck();
  let archived = snapshot.archivedTasks.find((item) => item.id === fixture.task.id);
  snapshot = await work(accounts.owner, {
    action: 'restoreTask',
    id: archived.id,
    revision: archived.revision,
  });
  await viewer.goto(originalHref);
  await downloadAndCheck();
  snapshot = await work(accounts.owner, {
    action: 'archiveBoard',
    id: fixture.board.id,
    revision: fixture.board.revision,
  });
  await viewer.goto('/notifications');
  // The oldest assignment notice is still present alongside archive/restore notices.
  const assignment = taskNotices(viewer, fixture.task).filter({ hasText: 'You were assigned to this task.' });
  await assignment.getByRole('link').click();
  await expect(viewer.getByText('This board is archived.', { exact: false })).toBeVisible();
  await downloadAndCheck();
  await owner.goto('/files');
  await expect(owner.getByRole('button', { name: 'Refresh files', exact: true })).toBeEnabled();
  await expect(owner.getByRole('link', { name: `Download ${fileName}`, exact: true })).toHaveCount(0);
  const board = snapshot.archivedBoards.find((item) => item.id === fixture.board.id);
  await work(accounts.owner, { action: 'restoreBoard', id: board.id, revision: board.revision });
  await viewer.goto(originalHref);
  await downloadAndCheck();
  await owner.getByRole('button', { name: 'Refresh files', exact: true }).click();
  await expect(owner.getByRole('link', { name: `Download ${fileName}`, exact: true })).toBeVisible();
});
