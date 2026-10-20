// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]
  Object.assign(process.env, originalEnv)
  vi.resetModules()
})

it.each(['true', 'false'])(
  'keeps native-file workflows out of the emulated storage run: %s',
  async (disabled) => {
    process.env.DISABLE_R2_STORAGE = disabled
    process.env.PLAYWRIGHT_E2E_RUN_ID = 'storage-profile-check'
    process.env.DATABASE_URI = 'mongodb://127.0.0.1:27017/ecolitea2-storage-profile-check-e2e'
    const { default: config } = await import('../../playwright.config')
    expect(config.testIgnore).toEqual(
      disabled === 'false' ? ['**/media-documents.e2e.spec.ts'] : undefined,
    )
    expect(process.env.DISABLE_R2_STORAGE).toBe(disabled)
  },
)
