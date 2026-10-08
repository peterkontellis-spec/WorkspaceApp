import { test, expect, work, boardFixture, taskLink } from './fixtures.mjs';

const popup = (page) => page.getByRole('dialog', { name: 'Filters', exact: true });
const filterButton = (page) => page.getByRole('button', { name: /^Filters(?: \(\d+\))?$/ });

test('popup filters commit only on apply and inline search retains applied filters and calendar context', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts, { status: 'In progress', dueDate: '2028-02-29' });
  await work(accounts.owner, {
    action: 'createTask',
    boardId: fixture.board.id,
    groupId: fixture.group.id,
    title: `${fixture.task.title} completed sibling`,
    status: 'Done',
    dueDate: '2028-02-29',
  });
  const page = accounts.owner.page;
  await page.goto(`${fixture.path}?view=calendar&month=2028-02`);
  const query = page.getByRole('searchbox', { name: 'Search tasks', exact: true });
  await query.fill(fixture.task.title);
  await filterButton(page).click();
  await popup(page).getByRole('combobox', { name: 'Status', exact: true }).selectOption('In progress');
  expect(new URL(page.url()).searchParams.has('status')).toBe(false);
  await popup(page).getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(popup(page)).not.toBeVisible();
  await expect(taskLink(page, fixture.task)).toBeVisible();
  await expect(page.locator('[data-saved-task]')).toHaveCount(1);
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject({
    view: 'calendar',
    month: '2028-02',
    q: fixture.task.title,
    status: 'In progress',
  });
  await filterButton(page).click();
  await popup(page).getByRole('combobox', { name: 'Status', exact: true }).selectOption('Done');
  await popup(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(filterButton(page)).toBeFocused();
  await query.fill('Nothing matches this query');
  await page
    .getByRole('search', { name: 'Find saved tasks' })
    .getByRole('button', { name: 'Search', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'No matching tasks', exact: true })).toBeVisible();
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject({
    view: 'calendar',
    month: '2028-02',
    q: 'Nothing matches this query',
    status: 'In progress',
  });
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('[data-saved-task]')).toHaveCount(2);
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({
    view: 'calendar',
    month: '2028-02',
  });
});

test('popup filters dismiss by cancel, Escape, outside click and close without applying drafts in both themes and sizes', async ({
  accounts,
}, info) => {
  const fixture = await boardFixture(accounts);
  const page = accounts.owner.page;
  await page.goto(`${fixture.path}?priority=High`);
  const query = page.getByRole('searchbox', { name: 'Search tasks', exact: true });
  await query.fill('Keep this unsent search');
  let index = 0;
  for (const mode of ['light', 'dark']) {
    await page.getByRole('button', { name: `Switch to ${mode} mode`, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const trigger = filterButton(page);
      await trigger.focus();
      await page.keyboard.press('Enter');
      const dialog = popup(page);
      await expect(dialog).toBeVisible();
      const status = dialog.getByRole('combobox', { name: 'Status', exact: true });
      await expect(status).toHaveValue('');
      await expect(dialog.getByRole('combobox', { name: 'Priority', exact: true })).toHaveValue('High');
      await status.selectOption('Done');
      await status.focus();
      await page.keyboard.press('Tab');
      await expect(dialog.getByRole('combobox', { name: 'Assignee', exact: true })).toBeFocused();
      for (const control of [
        status,
        dialog.getByRole('button', { name: 'Apply filters', exact: true }),
        dialog.getByRole('button', { name: 'Cancel', exact: true }),
      ]) {
        const bounds = await control.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
      }
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: info.outputPath(`filters-${mode}-${width}.png`), fullPage: true });
      if (index === 0) await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      else if (index === 1) await page.keyboard.press('Escape');
      else if (index === 2) await page.mouse.click(4, 4);
      else await dialog.getByRole('button', { name: 'Close filters', exact: true }).click();
      index++;
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await expect(query).toHaveValue('Keep this unsent search');
      expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ priority: 'High' });
    }
  }
  await filterButton(page).click();
  await expect(popup(page).getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('');
  await page.keyboard.press('Escape');
});

test('breadcrumb navigation links Workspace and every current section to their real routes on desktop and narrow screens', async ({
  accounts,
}, info) => {
  const fixture = await boardFixture(accounts);
  const page = accounts.owner.page;
  const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(fixture.path);
    const root = breadcrumb.getByRole('link', { name: 'Workspace', exact: true });
    const boards = breadcrumb.getByRole('link', { name: 'Boards', exact: true });
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute('href', '/home');
    await expect(boards).toBeVisible();
    await expect(boards).toHaveAttribute('href', '/boards');
    if (width < 500) {
      for (const link of [root, boards]) {
        const bounds = await link.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.width).toBeGreaterThanOrEqual(44);
      }
    }
    await boards.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/boards$/);
    await expect(boards).toHaveAttribute('aria-current', 'page');
    await root.click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(breadcrumb.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`breadcrumbs-${width}.png`), fullPage: true });
  }
  for (const [path, label] of [
    ['/overview', 'Overview'],
    ['/docs', 'Docs'],
    ['/files', 'Files'],
    ['/templates', 'Templates'],
    ['/time', 'Time'],
    ['/notifications', 'Notifications'],
    ['/team', 'Team access'],
  ]) {
    await page.goto(path);
    const current = breadcrumb.getByRole('link', { name: label, exact: true });
    await expect(current).toBeVisible();
    await expect(current).toHaveAttribute('href', path);
    await expect(current).toHaveAttribute('aria-current', 'page');
    await current.click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test('popup filters ignore an older native close event after the dialog has already reopened', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts);
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  await filterButton(page).click();
  const dialog = popup(page);
  await expect(dialog).toBeVisible();
  // Native close events are queued. Reproduce that browser lifecycle deterministically:
  // by the time the older close event arrives, this same dialog is already open again.
  await dialog.evaluate(
    (element) =>
      new Promise((resolve) => {
        element.addEventListener('close', () => requestAnimationFrame(() => resolve(null)), { once: true });
        element.close();
        element.showModal();
      }),
  );
  await expect(dialog).toBeVisible();
  await expect(filterButton(page)).toHaveAttribute('aria-expanded', 'true');
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Done');
  await expect(dialog.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('Done');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(filterButton(page)).toBeFocused();
  expect(new URL(page.url()).searchParams.has('status')).toBe(false);
});
