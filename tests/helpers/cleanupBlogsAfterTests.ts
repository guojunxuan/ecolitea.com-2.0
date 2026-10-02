import { reportBlogEnvironment } from './blogFixtures'

export default async function cleanupBlogFixtures() {
  // Teardown runs in its own Playwright process; load Payload only after selecting
  // the same local adapter used by prebuild seeding, including in the S3 suite.
  process.env.DISABLE_R2_STORAGE = 'true'
  const runID = process.env.PLAYWRIGHT_E2E_RUN_ID!
  reportBlogEnvironment(runID)
  const [{ getPayload }, { default: config }, { cleanupBlogs }] = await Promise.all([
    import('payload'),
    import('../../src/payload.config.js'),
    import('./blogFixtures'),
  ])
  const payload = await getPayload({ config })
  try {
    await cleanupBlogs(payload, runID)
  } finally {
    await payload.destroy()
  }
}
