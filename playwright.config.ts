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

const parseTestPort = (value: string | undefined, name: string, fallback: number): number => {
  const port = Number.parseInt(value ?? String(fallback), 10)
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 3000) {
    throw new Error(`${name} must be an unprivileged TCP port other than 3000.`)
  }
  return port
}

const developerDatabaseURI = process.env.DATABASE_URI
const e2eDatabaseBaseURI = process.env.E2E_DATABASE_URI ?? 'mongodb://127.0.0.1:27017/ecolitea2-e2e'
const e2ePort = parseTestPort(process.env.PLAYWRIGHT_PORT, 'PLAYWRIGHT_PORT', 3001)
const e2eStoragePort = parseTestPort(
  process.env.PLAYWRIGHT_STORAGE_PORT,
  'PLAYWRIGHT_STORAGE_PORT',
  9001,
)
if (e2ePort === e2eStoragePort) {
  throw new Error('PLAYWRIGHT_PORT and PLAYWRIGHT_STORAGE_PORT must differ.')
}
const e2eBaseURL = `http://127.0.0.1:${e2ePort}`
const e2eStorageEndpoint = `http://127.0.0.1:${e2eStoragePort}`
const e2eMediaOrigin = 'https://media.example.invalid'
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
process.env.DISABLE_R2_STORAGE = 'false'
process.env.PLAYWRIGHT_TEST = 'true'
process.env.PLAYWRIGHT_E2E_RUN_ID = e2eRunID
process.env.PLAYWRIGHT_BASE_URL = e2eBaseURL
process.env.R2_ACCESS_KEY_ID = 'e2e-local-access-key'
process.env.R2_ENDPOINT = e2eStorageEndpoint
process.env.R2_PUBLIC_URL = e2eMediaOrigin
process.env.R2_SECRET_ACCESS_KEY = 'e2e-local-secret-key'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* The suites share one test-owned Payload database and mutate singleton Globals. */
  workers: 1,
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
  webServer: [
    {
      command: 'node tests/helpers/localS3Server.mjs',
      env: {
        ...process.env,
        E2E_STORAGE_PORT: String(e2eStoragePort),
      },
      reuseExistingServer: false,
      timeout: 30_000,
      url: `${e2eStorageEndpoint}/health`,
    },
    {
      command: 'pnpm build --webpack && pnpm start',
      env: {
        ...process.env,
        DATABASE_URI: e2eDatabaseURI,
        DISABLE_R2_STORAGE: 'false',
        E2E_STORAGE_PORT: String(e2eStoragePort),
        HOSTNAME: '127.0.0.1',
        PLAYWRIGHT_BASE_URL: e2eBaseURL,
        PLAYWRIGHT_E2E_RUN_ID: e2eRunID,
        PLAYWRIGHT_TEST: 'true',
        PORT: String(e2ePort),
        R2_ACCESS_KEY_ID: 'e2e-local-access-key',
        R2_ENDPOINT: e2eStorageEndpoint,
        R2_PUBLIC_URL: e2eMediaOrigin,
        R2_SECRET_ACCESS_KEY: 'e2e-local-secret-key',
      },
      reuseExistingServer: false,
      timeout: 10 * 60 * 1000,
      // The template homepage was intentionally removed and now returns 404.
      // Probe Payload Admin while refusing to reuse a server with unknown environment variables.
      url: `${e2eBaseURL}/admin`,
    },
  ],
})
