import { defineConfig, devices } from '@playwright/test';

import { failingWorker, passingWorker } from './tests/e2e/worker-under-test';

// Browser tests run against the production build. Pages are served as static
// files; the intake endpoint runs in the built Worker through `astro preview`,
// which the intake specs post to (see tests/e2e/worker-under-test.ts). They
// run in CI; locally, run one file at a time when a change needs it. Set
// E2E_PORT to avoid a clash when several checkouts run at once (the two
// Workers use the next two ports up).
const port = Number(process.env.E2E_PORT ?? 4173);

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } };
const phone = devices['Pixel 7'];
const intakeSpec = /intake[\w-]*\.spec\.ts/;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: desktop, testIgnore: intakeSpec },
    { name: 'phone', use: phone, testIgnore: intakeSpec },
    {
      name: 'worker',
      use: { ...desktop, baseURL: passingWorker.baseURL },
      testMatch: intakeSpec,
    },
  ],
  webServer: [
    {
      command: `python3 -m http.server ${port} --bind 127.0.0.1 --directory dist/client`,
      url: `http://127.0.0.1:${port}/`,
      reuseExistingServer: !process.env.CI,
    },
    ...[passingWorker, failingWorker].map((worker) => ({
      // --ignore-lock keeps the server in the foreground, where Playwright can
      // stop it, even when Astro would otherwise move it to the background.
      // tee copies the Worker's log to a file the tests read.
      command: `npx astro preview --port ${worker.port} --ignore-lock 2>&1 | tee ${worker.logFile}`,
      url: `${worker.baseURL}/contact/`,
      env: { ...(process.env as Record<string, string>), ...worker.env },
      reuseExistingServer: !process.env.CI,
    })),
  ],
});
