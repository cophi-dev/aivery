import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // Browser options
    headless: true,
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  },
  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  // Folder for test artifacts such as screenshots, videos, traces, etc.
  outputDir: 'test-results',
  // Maximum time one test can run for
  timeout: 30000,
  // Run tests in files in parallel
  fullyParallel: true,
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
}); 