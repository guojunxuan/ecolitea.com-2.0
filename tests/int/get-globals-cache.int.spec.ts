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

  it('separates cached global values requested at different relationship depths', () => {
    getCachedGlobal('site-settings', 1)
    getCachedGlobal('site-settings', 2)

    expect(unstableCacheMock).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      ['site-settings', '1'],
      { tags: ['global_site-settings'] },
    )
    expect(unstableCacheMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      ['site-settings', '2'],
      { tags: ['global_site-settings'] },
    )
  })

  it('provides fixed cached readers with stable keys and tags', async () => {
    await Promise.all([getCachedHeader(), getCachedFooter(), getCachedSiteSettings()])

    expect(unstableCacheMock).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      ['header', '1'],
      { tags: ['global_header'] },
    )
    expect(unstableCacheMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      ['footer', '1'],
      { tags: ['global_footer'] },
    )
    expect(unstableCacheMock).toHaveBeenNthCalledWith(
      3,
      expect.any(Function),
      ['site-settings', '2'],
      { tags: ['global_site-settings'] },
    )
  })
})
