import { defineConfig, devices } from '@playwright/test'

// Read-only verification against the developer's existing server. No database fixtures,
// storage server, build, server launch, or database teardown runs in this configuration.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'blogs.e2e.spec.ts',
  grep: /Template A existing server/,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '/tmp/ecolitea-blog-detail-playwright',
  use: {
    baseURL: 'http://localhost:3001',
    ...devices['Desktop Chrome'],
    channel: process.env.PLAYWRIGHT_CHANNEL === 'chrome' ? 'chrome' : 'chromium',
    trace: 'retain-on-failure',
  },
})
