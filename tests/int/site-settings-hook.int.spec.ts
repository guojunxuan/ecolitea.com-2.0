import { beforeEach, describe, expect, it, vi } from 'vitest'

const { revalidateTag } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidateTag }))

import { revalidateSiteSettings } from '@/SiteSettings/hooks/revalidateSiteSettings'

describe('revalidateSiteSettings', () => {
  beforeEach(() => {
    revalidateTag.mockClear()
  })

  it('invalidates the cached Site Settings Global after a normal save', async () => {
    const doc = { id: 'site-settings' }
    const info = vi.fn()

    const result = await revalidateSiteSettings({
      doc,
      req: { context: {}, payload: { logger: { info } } },
    } as never)

    expect(result).toBe(doc)
    expect(info).toHaveBeenCalledWith('Revalidating site settings')
    expect(revalidateTag).toHaveBeenCalledWith('global_site-settings', 'max')
  })

  it('does not invalidate when the request disables revalidation', async () => {
    const doc = { id: 'site-settings' }
    const info = vi.fn()

    await revalidateSiteSettings({
      doc,
      req: { context: { disableRevalidate: true }, payload: { logger: { info } } },
    } as never)

    expect(info).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
