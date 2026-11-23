import { defineConfig, devices } from '@playwright/test';

// Browser tests run against the production build, served as static files.
// They run in CI; locally, run one file at a time when a change needs it.
// Set E2E_PORT to avoid a clash when several checkouts run at once.
const port = Number(process.env.E2E_PORT ?? 4173);

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
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `python3 -m http.server ${port} --bind 127.0.0.1 --directory dist/client`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !process.env.CI,
  },
});
