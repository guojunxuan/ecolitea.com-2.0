import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCachedSettings = vi.hoisted(() => vi.fn())
vi.mock('@/utilities/getGlobals', () => ({ getCachedSettings }))

beforeEach(() => getCachedSettings.mockReset())

const image = {
  id: 'image',
  url: '/hero.jpg',
  mimeType: 'image/jpeg',
  alt: 'Hero',
  createdAt: '2026-11-01T00:00:00.000Z',
}
describe('getProductListingHero', () => {
  it.each([null, {}, { product: {} }, { product: { heroSlides: [] } }])(
    'returns no slides without enabled content %j',
    async (settings) => {
      const { getProductListingHero } = await import('@/utilities/products/getProductListingHero')
      getCachedSettings.mockResolvedValue(settings)
      await expect(getProductListingHero()).resolves.toEqual([])
    },
  )
  it.each(['light', 'dark'])('uses saved theme %s and normalizes mobile media', async (theme) => {
    const { getProductListingHero } = await import('@/utilities/products/getProductListingHero')
    const mobile = { ...image, id: 'mobile', url: '/mobile.jpg' }
    getCachedSettings.mockResolvedValue({
      product: {
        heroSlides: [
          {
            id: 'new',
            title: ' New range ',
            media: image,
            mobileMedia: mobile,
            theme,
            enableCta: true,
            cta: { type: 'custom', url: '/products/tea', label: ' Discover ' },
          },
        ],
      },
    })
    await expect(getProductListingHero()).resolves.toEqual([
      {
        id: 'new',
        title: 'New range',
        media: image,
        mobileMedia: mobile,
        theme,
        showText: false,
        description: null,
        cta: { type: 'custom', url: '/products/tea', label: 'Discover' },
      },
    ])
  })
  it('omits invalid desktop media and falls back when mobile media is unresolved', async () => {
    const { getProductListingHero } = await import('@/utilities/products/getProductListingHero')
    getCachedSettings.mockResolvedValue({
      product: {
        heroSlides: [
          { title: 'Keep', media: image, mobileMedia: 'unresolved' },
          { title: 'Unresolved', media: 'id' },
          { title: 'Missing URL', media: { id: 'missing', mimeType: 'image/jpeg' } },
          { title: 'PDF', media: { id: 'pdf', url: '/file.pdf', mimeType: 'application/pdf' } },
          { title: ' ', media: image },
        ],
      },
    })
    expect(await getProductListingHero()).toMatchObject([
      { title: 'Keep', mobileMedia: null, theme: 'dark' },
    ])
  })
  it('preserves a text slide when desktop media is empty', async () => {
    const { getProductListingHero } = await import('@/utilities/products/getProductListingHero')
    getCachedSettings.mockResolvedValue({
      product: {
        heroSlides: [{
          id: 'text',
          showText: true,
          title: ' Saved heading ',
          description: ' Retained ',
          mobileMedia: image,
          theme: 'light',
        }],
      },
    })
    await expect(getProductListingHero()).resolves.toEqual([
      {
        id: 'text',
        showText: true,
        title: 'Saved heading',
        description: 'Retained',
        media: null,
        mobileMedia: image,
        theme: 'light',
        cta: null,
      },
    ])
  })
  it('does not show disabled or unresolved CTA links', async () => {
    const { getProductListingHero } = await import('@/utilities/products/getProductListingHero')
    getCachedSettings.mockResolvedValue({
      product: {
        heroSlides: [
          {
            title: 'One',
            media: image,
            enableCta: false,
            cta: { type: 'custom', url: '/contact', label: 'Go' },
          },
          {
            title: 'Two',
            media: image,
            enableCta: true,
            cta: {
              type: 'reference',
              reference: { relationTo: 'products', value: 'unresolved' },
              label: 'Go',
            },
          },
        ],
      },
    })
    const slides = await getProductListingHero()
    expect(slides).toHaveLength(2)
    expect(slides.every((slide) => slide.cta === null)).toBe(true)
  })
})
describe('getProductCategoryCarousel', () => {
  const categories = [
    { id: 'a', slug: 'tea bags', title: 'Tea bags', image },
    { id: 'b', slug: 'cups', title: 'Cups', image: null },
  ]
  it('uses ordered category items, image overrides and fit; skips duplicate/missing categories', async () => {
    const { getProductCategoryCarousel } =
      await import('@/utilities/products/getProductCategoryCarousel')
    const override = { ...image, id: 'cutout' }
    getCachedSettings.mockResolvedValue({
      product: {
        categoryCarousel: {
          items: [
            { category: 'b', image: override, imageFit: 'contain' },
            { category: 'missing' },
            { category: 'b' },
            { category: { id: 'a' }, imageFit: 'contain' },
          ],
        },
      },
    })
    expect(await getProductCategoryCarousel(categories)).toEqual([
      { id: 'b', title: 'Cups', href: '/products/cups', image: override, imageFit: 'contain' },
      { id: 'a', title: 'Tea bags', href: '/products/tea%20bags', image, imageFit: 'cover' },
    ])
  })
  it('defaults to all categories using cover, and ignores the removed categories selection', async () => {
    const { getProductCategoryCarousel } =
      await import('@/utilities/products/getProductCategoryCarousel')
    getCachedSettings.mockResolvedValue({ product: { categoryCarousel: { categories: ['b'] } } })
    expect(
      (await getProductCategoryCarousel(categories)).map(({ id, href, imageFit }) => ({
        id,
        href,
        imageFit,
      })),
    ).toEqual([
      { id: 'a', href: '/products/tea%20bags', imageFit: 'cover' },
      { id: 'b', href: '/products/cups', imageFit: 'cover' },
    ])
    getCachedSettings.mockResolvedValue({ product: { categoryCarousel: { enabled: false } } })
    expect(await getProductCategoryCarousel(categories)).toEqual([])
  })
})
