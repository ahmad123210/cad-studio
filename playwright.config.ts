import { defineConfig, devices } from '@playwright/test';

/**
 * اختبارات التفاعل في المتصفح (E2E).
 * محلياً: npm run test:e2e   (يبني التطبيق ويشغّل vite preview تلقائياً)
 * لاستخدام Chrome مثبت بدل متصفح Playwright: CHROME_PATH=/usr/bin/google-chrome npm run test:e2e
 */
const PORT = 4180;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1400, height: 900 },
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } }],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
