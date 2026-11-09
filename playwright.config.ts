import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  timeout: 90000,
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      testIgnore: /offline\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile',
      testIgnore: /offline\.spec\.ts/,
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
    {
      name: 'webkit',
      testIgnore: /offline\.spec\.ts/,
      timeout: 240000,
      use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' },
    },
    {
      name: 'offline-chromium',
      testMatch: /offline\.spec\.ts/,
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        baseURL: 'http://127.0.0.1:4173',
      },
    },
    {
      name: 'offline-webkit',
      testMatch: /offline\.spec\.ts/,
      timeout: 180000,
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'webkit',
        baseURL: 'http://127.0.0.1:4173',
      },
    },
  ],
  webServer: [
    {
      command: 'npm run preview:api',
      url: 'http://127.0.0.1:3002/v1/ready',
      reuseExistingServer: !process.env.CI,
      timeout: 90000,
    },
    {
      command: 'npm run preview',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 90000,
    },
    {
      command: 'npm run dev:api',
      url: 'http://127.0.0.1:3001/v1/ready',
      reuseExistingServer: !process.env.CI,
      timeout: 90000,
    },
    {
      command: 'npm run dev:web',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 90000,
    },
  ],
});
