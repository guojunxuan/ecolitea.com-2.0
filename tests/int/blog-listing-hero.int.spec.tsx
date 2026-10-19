import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mediaMock = vi.hoisted(() => vi.fn())
const headerThemeSyncMock = vi.hoisted(() => vi.fn())

vi.mock('@/components/Media', () => ({ Media: mediaMock }))
vi.mock('@/heros/HeaderThemeSync', () => ({ HeaderThemeSync: headerThemeSyncMock }))

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
    getCachedSettingsMock.mockResolvedValue({ id: 'settings', blog: {} })

    await expect(getBlogListingHero()).resolves.toBeNull()
  })

  it('returns null when disabled or the heading is blank', async () => {
    getCachedSettingsMock.mockResolvedValueOnce({
      blog: { hero: { enabled: false, heading: 'Heading' } },
    })
    await expect(getBlogListingHero()).resolves.toBeNull()

    getCachedSettingsMock.mockResolvedValueOnce({
      blog: { hero: { enabled: true, heading: '  \n ' } },
    })
    await expect(getBlogListingHero()).resolves.toBeNull()
  })

  it('trims heading and optional description and normalizes empty description', async () => {
    getCachedSettingsMock.mockResolvedValue({
      blog: {
        hero: { enabled: true, heading: '  Stories  ', description: '  From the journal  ' },
      },
    })

    await expect(getBlogListingHero()).resolves.toEqual({
      heading: 'Stories',
      description: 'From the journal',
      headerTheme: 'light',
    })

    getCachedSettingsMock.mockResolvedValue({
      blog: { hero: { enabled: true, heading: 'Stories', description: '  ' } },
    })

    await expect(getBlogListingHero()).resolves.toEqual({
      heading: 'Stories',
      description: null,
      headerTheme: 'light',
    })
  })

  it.each(['light', 'dark'] as const)('preserves %s theme', async (headerTheme) => {
    getCachedSettingsMock.mockResolvedValue({
      blog: { hero: { enabled: true, heading: 'Stories', headerTheme } },
    })

    await expect(getBlogListingHero()).resolves.toMatchObject({ heading: 'Stories', headerTheme })
  })

  it('passes through populated media and an unpopulated media ID', async () => {
    const media = { id: 'media-1', url: '/media/hero.jpg', filename: 'hero.jpg' }
    getCachedSettingsMock.mockResolvedValue({
      blog: {
        hero: { enabled: true, heading: 'Stories', image: media, headerTheme: 'dark' },
      },
    })
    await expect(getBlogListingHero()).resolves.toMatchObject({ image: media })

    getCachedSettingsMock.mockResolvedValue({
      blog: { hero: { enabled: true, heading: 'Stories', image: 'media-1' } },
    })
    await expect(getBlogListingHero()).resolves.toMatchObject({ image: 'media-1' })
  })

  it('normalizes an unknown theme to light', async () => {
    getCachedSettingsMock.mockResolvedValue({
      blog: { hero: { enabled: true, heading: 'Stories', headerTheme: 'sepia' } },
    })

    await expect(getBlogListingHero()).resolves.toMatchObject({ headerTheme: 'light' })
  })
})

describe('BlogListingHero', () => {
  beforeEach(() => {
    mediaMock.mockReset().mockReturnValue(<div data-testid="shared-media" />)
    headerThemeSyncMock.mockReset().mockReturnValue(null)
  })
  afterEach(cleanup)

  it.each(['light', 'dark'] as const)(
    'renders one configured heading and description with %s theme',
    async (headerTheme) => {
      const { BlogListingHero } = await import('@/heros/BlogListingHero')
      const { container } = render(
        <BlogListingHero
          heading="Our journal"
          description="Stories from the field"
          headerTheme={headerTheme}
        />,
      )

      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Our journal')
      expect(screen.getByText('Stories from the field').tagName).toBe('P')
      const hero = container.querySelector('section[data-hero="blog-listing"]')
      expect(hero).not.toBeNull()
      expect(hero?.getAttribute('data-website-theme')).toBe(
        headerTheme === 'dark' ? 'inverse' : null,
      )
      expect(headerThemeSyncMock.mock.calls[0][0]).toEqual({ theme: headerTheme })
    },
  )

  it('renders populated media through the shared renderer with a frame and scrim', async () => {
    const { BlogListingHero } = await import('@/heros/BlogListingHero')
    const image = {
      id: 'hero-image',
      alt: 'Journal hero image',
      url: '/media/hero.jpg',
      mimeType: 'image/jpeg',
      createdAt: '',
      updatedAt: '',
    }
    const { container } = render(
      <BlogListingHero heading="Journal" image={image} headerTheme="dark" />,
    )

    expect(screen.getByTestId('shared-media')).toBeTruthy()
    expect(mediaMock.mock.calls[0][0]).toMatchObject({
      resource: image,
      fill: true,
      priority: true,
      size: '100vw',
      presentation: { image: { fit: 'cover', quality: 85 } },
    })
    expect(mediaMock.mock.calls[0][0].imgClassName).toBeTruthy()
    expect(
      container
        .querySelector('[data-hero-media-frame]')
        ?.contains(screen.getByTestId('shared-media')),
    ).toBe(true)
    expect(container.querySelector('[data-hero-scrim]')).not.toBeNull()
  })

  it.each(['media-id', null, undefined])(
    'renders the text surface without broken media for %s',
    async (image) => {
      const { BlogListingHero } = await import('@/heros/BlogListingHero')
      const { container } = render(
        <BlogListingHero heading="Journal" image={image} headerTheme="light" />,
      )

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Journal')
      expect(container.querySelector('section')?.className).toBeTruthy()
      expect(container.querySelector('p')).toBeNull()
      expect(mediaMock).not.toHaveBeenCalled()
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('[data-hero-media-frame]')).toBeNull()
      expect(container.querySelector('[data-hero-scrim]')).toBeNull()
    },
  )
})
