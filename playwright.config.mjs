import { defineConfig } from '@playwright/test';
import { join } from 'node:path';
import { environment } from './tests/e2e/environment.mjs';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: [['list'], ['html', { outputFolder: join(environment.directory, 'report'), open: 'never' }]],
  outputDir: join(environment.directory, 'results'),
  use: {
    baseURL: environment.baseURL,
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    timezoneId: 'Europe/Athens',
    locale: 'en-GB',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
});
