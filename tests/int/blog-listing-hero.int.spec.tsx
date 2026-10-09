import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCachedSettingsMock = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/getGlobals', () => ({ getCachedSettings: getCachedSettingsMock }))

import { getBlogListingHero } from '@/utilities/blogs/getBlogListingHero'

describe('getBlogListingHero', () => {
  beforeEach(() => getCachedSettingsMock.mockReset())

  it('returns null when Settings is missing', async () => {
    getCachedSettingsMock.mockResolvedValue(null)

    await expect(getBlogListingHero()).resolves.toBeNull()
  })

  it('returns null when the blog listing hero is missing', async () => {
    getCachedSettingsMock.mockResolvedValue({ id: 'settings', blog: { listing: {} } })

    await expect(getBlogListingHero()).resolves.toBeNull()
  })

  it('returns null when disabled or the heading is blank', async () => {
    getCachedSettingsMock.mockResolvedValueOnce({ blog: { listing: { hero: { enabled: false, heading: 'Heading' } } } })
    await expect(getBlogListingHero()).resolves.toBeNull()

    getCachedSettingsMock.mockResolvedValueOnce({ blog: { listing: { hero: { enabled: true, heading: '  \n ' } } } })
    await expect(getBlogListingHero()).resolves.toBeNull()
  })

  it('trims heading and optional description and normalizes empty description', async () => {
    getCachedSettingsMock.mockResolvedValue({
      blog: { listing: { hero: { enabled: true, heading: '  Stories  ', description: '  From the journal  ' } } },
    })

    await expect(getBlogListingHero()).resolves.toEqual({
      heading: 'Stories',
      description: 'From the journal',
      headerTheme: 'light',
    })

    getCachedSettingsMock.mockResolvedValue({
      blog: { listing: { hero: { enabled: true, heading: 'Stories', description: '  ' } } },
    })

    await expect(getBlogListingHero()).resolves.toEqual({
      heading: 'Stories',
      description: null,
      headerTheme: 'light',
    })
  })

  it.each(['light', 'dark'] as const)('preserves %s theme', async (headerTheme) => {
    getCachedSettingsMock.mockResolvedValue({
      blog: { listing: { hero: { enabled: true, heading: 'Stories', headerTheme } } },
    })

    await expect(getBlogListingHero()).resolves.toMatchObject({ heading: 'Stories', headerTheme })
  })

  it('passes through populated media and an unpopulated media ID', async () => {
    const media = { id: 'media-1', url: '/media/hero.jpg', filename: 'hero.jpg' }
    getCachedSettingsMock.mockResolvedValue({
      blog: { listing: { hero: { enabled: true, heading: 'Stories', image: media, headerTheme: 'dark' } } },
    })
    await expect(getBlogListingHero()).resolves.toMatchObject({ image: media })

    getCachedSettingsMock.mockResolvedValue({
      blog: { listing: { hero: { enabled: true, heading: 'Stories', image: 'media-1' } } },
    })
    await expect(getBlogListingHero()).resolves.toMatchObject({ image: 'media-1' })
  })

  it('normalizes an unknown theme to light', async () => {
    getCachedSettingsMock.mockResolvedValue({
      blog: { listing: { hero: { enabled: true, heading: 'Stories', headerTheme: 'sepia' } } },
    })

    await expect(getBlogListingHero()).resolves.toMatchObject({ headerTheme: 'light' })
  })
})
