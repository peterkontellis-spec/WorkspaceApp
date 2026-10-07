import { test, expect, boardFixture, openTask, environment, work } from './fixtures.mjs';

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test('search placeholder meets normal text contrast in both themes', async ({ accounts }, info) => {
  const fixture = await boardFixture(accounts);
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  const samples = [];
  for (const mode of ['light', 'dark']) {
    await page.getByRole('button', { name: `Switch to ${mode} mode`, exact: true }).click();
    const sample = await page.getByRole('searchbox', { name: 'Search tasks' }).evaluate((el) => {
      const placeholder = getComputedStyle(el, '::placeholder');
      const background = getComputedStyle(el).backgroundColor;
      const luminance = (color) =>
        color
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      const a = luminance(placeholder.color),
        b = luminance(background);
      return {
        foreground: placeholder.color,
        background,
        opacity: placeholder.opacity,
        contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    });
    samples.push({ mode, ...sample });
    expect(sample.opacity).toBe('1');
    expect(sample.contrast).toBeGreaterThanOrEqual(4.5);
  }
  await info.attach('placeholder-contrast', {
    body: JSON.stringify(samples),
    contentType: 'application/json',
  });
});

// Inspect rendered text against solid ancestor backgrounds. Gradients, disabled
// controls and non-visible text are reported separately, not certified by this scan.
async function textContrast(page) {
  return page.evaluate(() => {
    const rgb = (s) => {
      const m = s.match(/^rgba?\(([^)]+)\)/);
      return m ? m[1].split(/[, /]+/).map(Number) : null;
    };
    const over = (a, b) => {
      const alpha = a[3] ?? 1;
      return a.slice(0, 3).map((v, i) => v * alpha + b[i] * (1 - alpha));
    };
    const luminance = (c) =>
      c
        .map((v) => {
          v /= 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const failures = [],
      skipped = [];
    let checked = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent.trim();
      const el = node.parentElement;
      if (!text || !el || el.closest('script,style,option,[hidden],.sr-only')) continue;
      const rect = el.getBoundingClientRect(),
        style = getComputedStyle(el);
      if (
        !rect.width ||
        !rect.height ||
        rect.bottom < 0 ||
        rect.top > innerHeight ||
        style.visibility !== 'visible'
      )
        continue;
      const chain = [];
      let excluded = false;
      for (let item = el; item; item = item.parentElement) {
        const css = getComputedStyle(item);
        if (
          css.display === 'none' ||
          Number(css.opacity) < 1 ||
          item.matches(':disabled,[aria-disabled="true"]')
        )
          excluded = true;
        if (css.backgroundImage !== 'none') excluded = true;
        chain.unshift(css.backgroundColor);
      }
      if (excluded) {
        skipped.push(text.slice(0, 60));
        continue;
      }
      let background = [255, 255, 255];
      for (const color of chain) {
        const c = rgb(color);
        if (c) background = over(c, background);
      }
      const foreground = rgb(style.color);
      if (!foreground) continue;
      const l1 = luminance(over(foreground, background)),
        l2 = luminance(background);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const large =
        parseFloat(style.fontSize) >= 24 ||
        (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      checked++;
      if (ratio + 0.01 < (large ? 3 : 4.5))
        failures.push({
          text: text.slice(0, 80),
          ratio,
          color: style.color,
          background,
          class: el.className,
        });
    }
    return { checked, skipped, failures };
  });
}

test('both themes persist across routes and account controls, with narrow layout and rendered text contrast', async ({
  accounts,
}, info) => {
  test.setTimeout(150_000);
  const fixture = await boardFixture(accounts, { dueDate: '2020-01-01', status: 'In progress' });
  const page = accounts.owner.page;
  const routes = [
    '/home',
    '/overview',
    '/time',
    '/templates',
    '/boards',
    fixture.path,
    `${fixture.path}?view=kanban`,
    `${fixture.path}?view=calendar`,
    '/docs',
    '/files',
    '/notifications',
    '/team',
  ];
  const results = [];
  await page.goto('/home');
  for (const mode of ['light', 'dark']) {
    await page.getByRole('button', { name: `Switch to ${mode} mode`, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await noOverflow(page);
        const contrast = await textContrast(page);
        results.push({ mode, width, route, ...contrast });
        expect(
          contrast.failures,
          JSON.stringify({ mode, width, route, failures: contrast.failures }),
        ).toEqual([]);
      }
      await page.goto(fixture.path);
      const panel = await openTask(page, fixture.task);
      await expect(panel.getByRole('button', { name: 'Save task', exact: true })).toBeInViewport();
      const contrast = await textContrast(page);
      results.push({ mode, width, route: 'task panel', ...contrast });
      expect(contrast.failures).toEqual([]);
      await info.attach(`${mode}-${width}-task`, { body: await page.screenshot(), contentType: 'image/png' });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /^Account:/ }).click();
      const account = page.getByRole('dialog', { name: 'Your account' });
      await expect(
        account.getByRole('button', { name: mode === 'light' ? 'Light' : 'Dark', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(account.getByRole('button', { name: 'Close your account', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: /^Account:/ })).toBeFocused();
    }
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
  }
  await info.attach('rendered-contrast-samples', {
    body: JSON.stringify(results),
    contentType: 'application/json',
  });
});

test('appearance remains usable when browser storage throws', async ({ accounts }) => {
  const page = accounts.owner.page;
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Test blocked storage', 'SecurityError');
    };
    Storage.prototype.setItem = () => {
      throw new DOMException('Test blocked storage', 'SecurityError');
    };
  });
  await page.goto('/home');
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: /^Account:/ }).click();
  const account = page.getByRole('dialog', { name: 'Your account' });
  await account.getByRole('checkbox', { name: 'Tint the sidebar and header with my star' }).uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-star-tint', 'off');
  await account.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('saved appearance also applies to signed-out account forms at desktop and phone widths', async ({
  accounts,
}, info) => {
  const page = accounts.owner.page;
  const cookies = await accounts.owner.context.cookies();
  try {
    for (const mode of ['light', 'dark']) {
      await accounts.owner.context.addCookies(cookies);
      await page.goto('/home');
      await page.getByRole('button', { name: `Switch to ${mode} mode`, exact: true }).click();
      await accounts.owner.context.clearCookies();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 844 });
        for (const route of ['/sign-in', '/recover', '/reset-password']) {
          await page.goto(route);
          await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await noOverflow(page);
          const contrast = await textContrast(page);
          expect(contrast.failures).toEqual([]);
        }
        await info.attach(`account-${mode}-${width}`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      }
    }
  } finally {
    await accounts.owner.context.addCookies(cookies);
  }
});

test('star phases and neutral/tint controls affect shell tint without changing task status colours', async ({
  accounts,
}) => {
  const fixture = await boardFixture(accounts);
  const page = accounts.owner.page;
  await page.goto(fixture.path);
  const status = page.getByLabel(`Status for ${fixture.task.title}`, { exact: true });
  const color = await status.evaluate((el) => getComputedStyle(el).color);
  await page.locator('.sidebar .stellar-control > summary').click();
  const range = page.getByRole('slider', { name: 'Preview progress' });
  await range.fill('0');
  await expect(page.locator('.sidebar').getByText('100% red · 0% orange', { exact: true })).toBeVisible();
  await range.fill('75');
  await expect(page.locator('.sidebar').getByText('25% orange · 75% green', { exact: true })).toBeVisible();
  await range.fill('100');
  await expect(page.locator('.sidebar').getByText('Green · full radiance', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'No planned work' }).check();
  await expect(range).toBeDisabled();
  await expect(page.locator('.sidebar').getByText('A quiet, neutral star.', { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.locator('html').evaluate((el) => getComputedStyle(el).getPropertyValue('--star-tint-a').trim()),
    )
    .toBe('rgba(210, 161, 99, 0)');
  expect(await status.evaluate((el) => getComputedStyle(el).color)).toBe(color);
});

test('rendered star animates, pauses and respects emulated reduced motion; actual context loss reveals fallback', async ({
  accounts,
}, info) => {
  test.setTimeout(90_000);
  const page = accounts.owner.page;
  await page.addInitScript(() => {
    window.__qaDraws = 0;
    const original = WebGLRenderingContext.prototype.drawArrays;
    WebGLRenderingContext.prototype.drawArrays = function (...args) {
      window.__qaDraws++;
      return original.apply(this, args);
    };
  });
  await page.goto('/home');
  const canvas = page.locator('.sidebar .stellar-orb canvas');
  await expect(canvas).toHaveClass(/stellar-canvas--ready/);
  const start = await page.evaluate(() => window.__qaDraws);
  await expect.poll(() => page.evaluate(() => window.__qaDraws)).toBeGreaterThan(start + 5);
  // Real elapsed animation samples cover several flare lifetimes. These captures
  // support visual review; a draw count alone does not certify flare appearance.
  for (let sample = 0; sample < 6; sample++) {
    await info.attach(`star-birth-${sample}`, { body: await canvas.screenshot(), contentType: 'image/png' });
    if (sample < 5) await page.waitForTimeout(9000);
  }
  await page.locator('.sidebar .stellar-control > summary').click();
  await page.getByRole('checkbox', { name: 'Animate star' }).uncheck();
  await page.waitForTimeout(300);
  const paused = await page.evaluate(() => window.__qaDraws);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__qaDraws)).toBe(paused);
  await page.getByRole('checkbox', { name: 'Animate star' }).check();
  await expect.poll(() => page.evaluate(() => window.__qaDraws)).toBeGreaterThan(paused + 2);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(300);
  const reduced = await page.evaluate(() => window.__qaDraws);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__qaDraws)).toBe(reduced);
  await canvas.evaluate((element) => {
    const gl = element.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context-loss capability unavailable');
    extension.loseContext();
  });
  await expect(canvas).not.toHaveClass(/stellar-canvas--ready/);
  await expect(page.locator('.sidebar .stellar-fallback')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('a browser without WebGL keeps a visible static star and usable navigation', async ({ accounts }) => {
  const page = accounts.owner.page;
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return ['webgl', 'webgl2', 'experimental-webgl'].includes(type) ? null : get.call(this, type, ...args);
    };
  });
  await page.goto('/home');
  await expect(page.locator('.sidebar .stellar-fallback')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Workspace navigation' })
    .getByRole('link', { name: 'Boards', exact: true })
    .click();
  await expect(page).toHaveURL(/\/boards$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('200-percent-equivalent reflow keeps task actions reachable at half-sized CSS viewport', async ({
  accounts,
}, info) => {
  const fixture = await boardFixture(accounts);
  const page = accounts.owner.page;
  // 1440x900 display at 200% corresponds to 720x450 CSS pixels. This is
  // responsive reflow evidence, not a claim of native browser chrome zoom.
  await page.setViewportSize({ width: 720, height: 450 });
  for (const route of [
    '/home',
    fixture.path,
    `${fixture.path}?view=kanban`,
    `${fixture.path}?view=calendar`,
    '/docs',
    '/notifications',
  ]) {
    await page.goto(route);
    await noOverflow(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await page.goto(fixture.path);
  const panel = await openTask(page, fixture.task);
  await expect(panel.getByRole('button', { name: 'Save task', exact: true })).toBeInViewport();
  await panel.getByRole('textbox', { name: /^Task notes/ }).fill('Disposable reflow draft');
  await expect(panel.getByRole('button', { name: 'Save task', exact: true })).toBeInViewport();
  await info.attach('200-percent-equivalent-task', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('emulated touch can open, edit and dismiss a task and its date popup', async ({ accounts }, info) => {
  const fixture = await boardFixture(accounts);
  const context = await accounts.owner.context.browser().newContext({
    baseURL: environment.baseURL,
    storageState: environment.people.owner.storageState,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(fixture.path);
    await page.locator(`[data-saved-task="${fixture.task.id}"]`).tap();
    const panel = page.getByRole('dialog', { name: 'Task details' });
    await panel.getByRole('textbox', { name: /^Task notes/ }).fill('Saved with an emulated touch session');
    await panel.getByRole('button', { name: 'Save task', exact: true }).tap();
    await expect(panel).not.toBeVisible();
    expect((await work(accounts.owner)).tasks.find((item) => item.id === fixture.task.id).notes).toBe(
      'Saved with an emulated touch session',
    );
    await page.getByRole('button', { name: `Due date for ${fixture.task.title}`, exact: true }).tap();
    await page.getByRole('button', { name: 'Close calendar', exact: true }).tap();
    await expect(page.locator('.quick-date-popover:popover-open')).toHaveCount(0);
    await noOverflow(page);
    await info.attach('emulated-touch-board', { body: await page.screenshot(), contentType: 'image/png' });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
