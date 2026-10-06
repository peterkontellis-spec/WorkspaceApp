import { test as base, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { environment } from './environment.mjs';

export { expect, environment };
export const test = base.extend({
  accounts: async ({ browser }, use, testInfo) => {
    const accounts = {};
    const pageErrors = [],
      consoleErrors = [];
    let fixtureFailed = false;
    try {
      for (const [key, person] of Object.entries(environment.people)) {
        const context = await browser.newContext({
          baseURL: environment.baseURL,
          storageState: person.storageState,
          viewport: { width: 1440, height: 900 },
          timezoneId: 'Europe/Athens',
          locale: 'en-GB',
        });
        const page = await context.newPage();
        page.on('pageerror', (error) => pageErrors.push(`${key}: ${error.message}`));
        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(`${key}: ${message.text()}`);
        });
        accounts[key] = { context, page, ...person, expectedConsoleErrors: [] };
      }
      await use(accounts);
      expect(pageErrors, 'Unhandled client exceptions').toEqual([]);
      // Deliberate 401/403/409 and offline scenarios emit Chromium network errors;
      // retain all console output, but only exempt those known transport diagnostics.
      expect(
        consoleErrors.filter(
          (message) =>
            !/Failed to load resource:.*(401|403|409)|net::ERR_INTERNET_DISCONNECTED/.test(message) &&
            !Object.values(accounts).some((account) =>
              account.expectedConsoleErrors.some((pattern) => pattern.test(message)),
            ),
        ),
        'Unexpected browser console errors',
      ).toEqual([]);
    } catch (error) {
      fixtureFailed = true;
      throw error;
    } finally {
      await testInfo.attach('browser-console-errors', {
        body: JSON.stringify(consoleErrors, null, 2),
        contentType: 'application/json',
      });
      for (const [key, account] of Object.entries(accounts)) {
        if (fixtureFailed || testInfo.status !== testInfo.expectedStatus) {
          const dialogs = await account.page
            .locator('dialog[open]')
            .evaluateAll((elements) =>
              elements.map((element) => {
                const labelledBy = element.getAttribute('aria-labelledby');
                return {
                  labelledBy,
                  heading: element.querySelector('h2')?.outerHTML,
                  labelTarget: labelledBy ? document.getElementById(labelledBy)?.outerHTML : null,
                };
              }),
            )
            .catch(() => []);
          await testInfo.attach(`${key}-dialog-labels`, {
            body: JSON.stringify(dialogs),
            contentType: 'application/json',
          });
          await account.page
            .screenshot({ path: testInfo.outputPath(`${key}.png`), fullPage: true })
            .catch(() => {});
        }
        await account.context.close();
      }
    }
  },
});

export async function work(account, payload, status = 200) {
  const response =
    payload === undefined
      ? await account.context.request.get('/api/work')
      : await account.context.request.post('/api/work', {
          headers: { origin: environment.baseURL },
          data: payload,
        });
  expect(response.status(), await response.text()).toBe(status);
  return response.json();
}

export async function updates(account, payload, status = 200) {
  const response =
    payload === undefined
      ? await account.context.request.get('/api/updates')
      : await account.context.request.post('/api/updates', {
          headers: { origin: environment.baseURL },
          data: payload,
        });
  expect(response.status(), await response.text()).toBe(status);
  return response.json();
}

export async function boardFixture(accounts, extra = {}) {
  const { notes, checklist, fields, ...creation } = extra;
  const name = `QA board ${randomUUID().slice(0, 8)}`;
  let snapshot = await work(accounts.owner, { action: 'createBoard', name });
  const board = snapshot.boards.find((item) => item.name === name);
  const group = snapshot.groups.find((item) => item.boardId === board.id);
  const title = `QA task ${randomUUID().slice(0, 8)}`;
  snapshot = await work(accounts.owner, {
    action: 'createTask',
    boardId: board.id,
    groupId: group.id,
    title,
    ...creation,
  });
  let task = snapshot.tasks.find((item) => item.title === title);
  const patch = Object.fromEntries(
    Object.entries({ notes, checklist, fields }).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(patch).length) {
    snapshot = await work(accounts.owner, {
      action: 'updateTask',
      id: task.id,
      revision: task.revision,
      patch,
    });
    task = snapshot.tasks.find((item) => item.id === task.id);
  }
  return { board, group, task, path: `/boards/${board.id}` };
}

export const taskLink = (page, task) => page.locator(`[data-saved-task="${task.id}"]`);
export async function openTask(page, task) {
  await taskLink(page, task).click();
  await expect(page.getByRole('dialog', { name: 'Task details', exact: true })).toBeVisible();
  return page.getByRole('dialog', { name: 'Task details', exact: true });
}
