import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests against a production build served under a sub-path,
 * the way GitHub Pages serves it (`/<repo>/`).
 * Locally you can reuse an installed browser: PW_CHANNEL=msedge npx playwright test
 */
// An uncommon port; a busy port fails the run instead of silently testing another app.
const PORT = 47173;
const BASE_PATH = 'image-annotation';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/${BASE_PATH}/`,
    channel: process.env.PW_CHANNEL || undefined,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/${BASE_PATH}/`,
    env: { BASE_PATH },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
