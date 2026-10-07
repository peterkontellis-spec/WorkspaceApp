import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Called only by the fixture-owning parent. No live URL/configuration CLI exists.
export async function checkAppRestart({ directory, baseURL, people, restart }) {
  const address = new URL(baseURL);
  assert.equal(address.hostname, '127.0.0.1');
  assert.notEqual(address.port, '3100');
  assert.ok(address.port);
  let browser;
  const failures = [];
  const evidence = { checks: [], appRestarts: [] };
  const launch = async () => {
    browser = await chromium.launch();
    const context = await browser.newContext({
      baseURL,
      storageState: people.owner.storageState,
      viewport: { width: 1440, height: 900 },
      timezoneId: 'UTC',
      locale: 'en-GB',
    });
    context.on('page', (page) => {
      page.on('pageerror', (error) => failures.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') failures.push(message.text());
      });
    });
    return { context, page: await context.newPage() };
  };
  const post = async (context, path, payload) => {
    const response = await context.request.post(path, { headers: { origin: baseURL }, data: payload });
    assert.equal(response.status(), 200, await response.text());
    return response.json();
  };
  try {
    let { context, page } = await launch();
    const name = `Restart fixture ${randomUUID().slice(0, 8)}`;
    let work = await post(context, '/api/work', { action: 'createBoard', name });
    const board = work.boards.find((item) => item.name === name);
    const group = work.groups.find((item) => item.boardId === board.id);
    work = await post(context, '/api/work', {
      action: 'createTask',
      boardId: board.id,
      groupId: group.id,
      title: 'Timer across real app restart',
    });
    const task = work.tasks.find((item) => item.boardId === board.id);
    const day = new Date().toISOString().slice(0, 10);
    // Include tomorrow so a run crossing UTC midnight still totals the whole timer.
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const query = new URLSearchParams({ from: day, to: tomorrow, taskId: task.id, timeZone: 'UTC' });
    const report = async () => {
      const response = await context.request.get(`/api/time?${query}`);
      assert.equal(response.status(), 200);
      return response.json();
    };
    await page.goto(`/time?${query}`);
    await page.getByRole('button', { name: 'Start timer', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stop timer', exact: true })).toBeVisible();
    const started = (await report()).activeTimer;
    assert.equal(started.taskId, task.id);
    const second = await context.newPage();
    await second.goto(`/time?${query}`);
    await expect(second.getByRole('button', { name: 'Stop timer', exact: true })).toBeVisible();
    assert.equal((await report()).activeTimer.id, started.id);
    evidence.checks.push('Two actual tabs see the same running timer.');
    await browser.close();
    browser = null;
    evidence.appRestarts.push(await restart());
    ({ context, page } = await launch());
    await page.goto(`/time?${query}`);
    await expect(page.getByRole('button', { name: 'Stop timer', exact: true })).toBeVisible();
    const resumed = (await report()).activeTimer;
    assert.equal(resumed.id, started.id);
    assert.equal(resumed.startedAt, started.startedAt);
    await page.screenshot({ path: join(directory, 'timer-after-app-restart.png'), fullPage: true });
    evidence.checks.push(
      'After browser exit, abrupt app termination and a new app/browser process, the original session and timer survive.',
    );
    await page.getByRole('button', { name: 'Stop timer', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start timer', exact: true })).toBeVisible();
    let final = await report();
    assert.equal(final.activeTimer, null);
    assert.equal(final.entries.length, 1);
    const entry = final.entries[0];
    assert.equal(entry.id, started.id);
    assert.equal(entry.durationSeconds, (Date.parse(entry.endedAt) - Date.parse(started.startedAt)) / 1000);
    assert.ok(entry.durationSeconds >= 1, 'Elapsed time must include actual app downtime.');
    assert.equal(final.summary.totalSeconds, entry.durationSeconds);
    assert.equal(final.summary.byTask[0].seconds, entry.durationSeconds);
    assert.equal(final.summary.byBoard[0].seconds, entry.durationSeconds);
    assert.equal(
      final.summary.byDate.reduce((sum, row) => sum + row.seconds, 0),
      entry.durationSeconds,
    );
    evidence.elapsedSeconds = entry.durationSeconds;
    evidence.checks.push(
      'Stopping after recovery saves exactly one entry; timestamp duration equals task/board/date totals.',
    );
    await browser.close();
    browser = null;
    evidence.appRestarts.push(await restart());
    ({ context, page } = await launch());
    await page.goto(`/time?${query}`);
    await expect(page.locator('.time-entries .time-entry')).toHaveCount(1);
    final = await report();
    assert.equal(final.activeTimer, null);
    assert.deepEqual(final.entries, [entry]);
    assert.equal(final.summary.totalSeconds, entry.durationSeconds);
    assert.equal((await context.request.get('/api/work')).status(), 200);
    evidence.checks.push(
      'A second abrupt app restart preserves the stopped entry without restarting or duplicating it.',
    );
    assert.deepEqual(failures, [], 'Unexpected browser errors');
    evidence.result = 'passed';
    await writeFile(join(directory, 'restart-evidence.json'), JSON.stringify(evidence, null, 2), {
      mode: 0o600,
    });
    console.log(
      `PASS app restart recovery: ${evidence.checks.length} checks, two new app processes, original timer/session preserved.`,
    );
  } finally {
    await browser?.close();
  }
}
