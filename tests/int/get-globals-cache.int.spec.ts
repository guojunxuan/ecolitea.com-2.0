import { getPayload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const unstableCacheMock = vi.hoisted(() => vi.fn())

vi.mock('next/cache', () => ({ unstable_cache: unstableCacheMock }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))

import {
  getCachedFooter,
  getCachedGlobal,
  getCachedHeader,
  getCachedSiteSettings,
} from '@/utilities/getGlobals'

describe('getCachedGlobal', () => {
  beforeEach(() => {
    unstableCacheMock.mockReset()
    unstableCacheMock.mockImplementation(() => async () => ({}))
  })

  it('reads Settings with public access enforcement and no drafts', async () => {
    const findGlobal = vi.fn().mockResolvedValue({ product: {} })
    vi.mocked(getPayload).mockResolvedValue({ findGlobal } as never)
    unstableCacheMock.mockImplementation((fn) => fn)
    await getCachedGlobal('settings', 1)()
    expect(findGlobal).toHaveBeenCalledWith({
      slug: 'settings',
      depth: 1,
      overrideAccess: false,
      draft: false,
    })
  })

  it('separates cached global values requested at different relationship depths', () => {
    getCachedGlobal('site-settings', 1)
    getCachedGlobal('site-settings', 2)

    expect(unstableCacheMock).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      ['site-settings', '1', 'en'],
      { tags: ['global_site-settings', 'translation:global:site-settings:site-settings:en', 'translations:en'] },
    )
    expect(unstableCacheMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      ['site-settings', '2', 'en'],
      { tags: ['global_site-settings', 'translation:global:site-settings:site-settings:en', 'translations:en'] },
    )
  })

  it('provides fixed cached readers with stable keys and tags', async () => {
    await Promise.all([getCachedHeader(), getCachedFooter(), getCachedSiteSettings()])

    expect(unstableCacheMock).toHaveBeenNthCalledWith(1, expect.any(Function), ['header', '1', 'en'], {
      tags: ['global_header', 'translation:global:header:header:en', 'translations:en'],
    })
    expect(unstableCacheMock).toHaveBeenNthCalledWith(2, expect.any(Function), ['footer', '1', 'en'], {
      tags: ['global_footer', 'translation:global:footer:footer:en', 'translations:en'],
    })
    expect(unstableCacheMock).toHaveBeenNthCalledWith(
      3,
      expect.any(Function),
      ['site-settings', '2', 'en'],
      { tags: ['global_site-settings', 'translation:global:site-settings:site-settings:en', 'translations:en'] },
    )
  })
})
