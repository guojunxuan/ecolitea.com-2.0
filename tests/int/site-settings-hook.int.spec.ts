import { beforeEach, describe, expect, it, vi } from 'vitest'

const { revalidateTag } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidateTag, revalidatePath: vi.fn() }))

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

it('invalidates sitemap caches and the internal locale layout for language and region changes', async () => {
  const { revalidatePath } = await import('next/cache')
  await revalidateSiteSettings({
    doc: { languages: [{ code: 'de', status: 'live' }], regions: [] },
    req: { context: {}, payload: { logger: { info: vi.fn() } } },
  } as never)
  expect(revalidateTag).toHaveBeenCalledWith('translations-sitemap', { expire: 0 })
  expect(revalidateTag).toHaveBeenCalledWith('global_site-settings', { expire: 0 })
  expect(revalidatePath).toHaveBeenCalledWith('/(frontend)/[lang]', 'layout')
  for (const path of [
    '/pages-sitemap.xml',
    '/posts-sitemap.xml',
    '/blogs-sitemap.xml',
    '/products-sitemap.xml',
  ])
    expect(revalidatePath).toHaveBeenCalledWith(path)
})
