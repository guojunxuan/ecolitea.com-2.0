import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { down, up } from '@/migrations/20261013_site_assets'

describe('Site Assets migration on a fresh database', () => {
  it('accepts an empty database in either direction', async () => {
    const listCollections = vi.fn(() => ({ toArray: async () => [] }))
    const payload = {
      db: { connection: { db: { databaseName: 'isolated-empty-test', listCollections }, host: '127.0.0.1', port: 27017 } },
      logger: { info: vi.fn() },
    } as unknown as Payload

    await expect(up({ payload, req: { payload } as never })).resolves.toBeUndefined()
    await expect(down({ payload, req: { payload } as never })).resolves.toBeUndefined()
    expect(listCollections).toHaveBeenCalledTimes(2)
  })
})
