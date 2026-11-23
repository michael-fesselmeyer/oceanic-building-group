import { defineConfig, devices } from '@playwright/test';

// Browser tests run against the production build. Pages are served as static
// files; the intake endpoint runs in the built Worker through `astro preview`,
// which tests/e2e/intake.spec.ts posts to. They run in CI; locally, run one
// file at a time when a change needs it. Set E2E_PORT to avoid a clash when
// several checkouts run at once (the Worker uses the next port up).
const port = Number(process.env.E2E_PORT ?? 4173);
const workerPort = port + 1;

// Settings for the Worker under test: the log transport (nothing is sent) and
// Cloudflare's always-pass Turnstile test secret. None of these are secrets.
const workerEnv = {
  CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
  EMAIL_TRANSPORT: 'log',
  LEAD_NOTIFICATION_EMAIL: 'office@example.test',
  LEAD_FROM_EMAIL: 'website@example.test',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
};

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } };
const phone = devices['Pixel 7'];
const intakeSpec = /intake\.spec\.ts/;

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
      use: { ...desktop, baseURL: `http://localhost:${workerPort}` },
      testMatch: intakeSpec,
    },
  ],
  webServer: [
    {
      command: `python3 -m http.server ${port} --bind 127.0.0.1 --directory dist/client`,
      url: `http://127.0.0.1:${port}/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // --ignore-lock keeps the server in the foreground, where Playwright can
      // stop it, even when Astro would otherwise move it to the background.
      command: `npx astro preview --port ${workerPort} --ignore-lock`,
      url: `http://localhost:${workerPort}/contact/`,
      env: { ...(process.env as Record<string, string>), ...workerEnv },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
