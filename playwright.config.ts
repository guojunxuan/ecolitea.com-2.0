import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config'

const developerDatabaseURI = process.env.DATABASE_URI
const e2eDatabaseURI = process.env.E2E_DATABASE_URI ?? 'mongodb://127.0.0.1:27017/ecolitea2-e2e'
const e2eDatabaseName = new URL(e2eDatabaseURI).pathname.replace(/^\//, '').split('/').at(-1)

if (!e2eDatabaseName?.endsWith('-e2e')) {
  throw new Error('E2E_DATABASE_URI must name a dedicated database ending in "-e2e".')
}

const developerDatabaseName = developerDatabaseURI
  ? new URL(developerDatabaseURI).pathname.replace(/^\//, '').split('/').at(-1)
  : null

if (
  developerDatabaseURI &&
  e2eDatabaseURI === developerDatabaseURI &&
  !developerDatabaseName?.endsWith('-e2e')
) {
  throw new Error('E2E_DATABASE_URI must not match the developer DATABASE_URI.')
}

// The config is evaluated before test modules, so both Payload fixtures in the
// runner and the Next web server inherit the same dedicated database.
process.env.DATABASE_URI = e2eDatabaseURI
process.env.DISABLE_R2_STORAGE = 'true'
process.env.PLAYWRIGHT_TEST = 'true'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PLAYWRIGHT_CHANNEL === 'chrome' ? 'chrome' : 'chromium',
      },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm start',
    env: {
      ...process.env,
      DATABASE_URI: e2eDatabaseURI,
      DISABLE_R2_STORAGE: 'true',
      PLAYWRIGHT_TEST: 'true',
    },
    reuseExistingServer: true,
    timeout: 5 * 60 * 1000,
    // The template homepage was intentionally removed and now returns 404.
    // Probe Payload Admin so Playwright can reuse an already-running server.
    url: 'http://localhost:3000/admin',
  },
})
