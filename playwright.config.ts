import { defineConfig, devices } from '@playwright/test'
import { randomUUID } from 'node:crypto'

import {
  assertDedicatedE2EDatabaseURI,
  assertRunScopedE2EDatabaseURI,
  createRunScopedE2EDatabaseURI,
} from './tests/helpers/e2eDatabase'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config'

const developerDatabaseURI = process.env.DATABASE_URI
const e2eDatabaseBaseURI = process.env.E2E_DATABASE_URI ?? 'mongodb://127.0.0.1:27017/ecolitea2-e2e'
const inheritedRunID = process.env.PLAYWRIGHT_E2E_RUN_ID
const e2eRunID = inheritedRunID ?? randomUUID()
const e2eDatabaseURI = inheritedRunID
  ? process.env.DATABASE_URI!
  : createRunScopedE2EDatabaseURI(e2eDatabaseBaseURI, e2eRunID)

if (inheritedRunID) {
  assertRunScopedE2EDatabaseURI(e2eDatabaseURI, inheritedRunID)
} else {
  assertDedicatedE2EDatabaseURI(e2eDatabaseBaseURI, developerDatabaseURI)
}

// The config is evaluated before test modules, so both Payload fixtures in the
// runner and the Next web server inherit the same dedicated database.
process.env.DATABASE_URI = e2eDatabaseURI
process.env.DISABLE_R2_STORAGE = 'true'
process.env.PLAYWRIGHT_TEST = 'true'
process.env.PLAYWRIGHT_E2E_RUN_ID = e2eRunID

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
      PLAYWRIGHT_E2E_RUN_ID: e2eRunID,
    },
    reuseExistingServer: false,
    timeout: 10 * 60 * 1000,
    // The template homepage was intentionally removed and now returns 404.
    // Probe Payload Admin while refusing to reuse a server with unknown environment variables.
    url: 'http://localhost:3000/admin',
  },
})
