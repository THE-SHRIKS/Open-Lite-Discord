import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:3001/health',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
    env: {
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: '3001',
      DATA_DIR: path.resolve('.local-data', 'e2e'),
    },
  },
});
