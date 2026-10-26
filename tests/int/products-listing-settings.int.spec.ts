import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCachedSettings = vi.hoisted(() => vi.fn())
vi.mock('@/utilities/getGlobals', () => ({ getCachedSettings }))

beforeEach(() => getCachedSettings.mockReset())

describe('getProductListingHero', () => {
  it.each([
    null,
    {},
    { product: {} },
    { product: { hero: { enabled: false, heading: 'Products' } } },
    { product: { hero: { enabled: true, heading: ' \n ' } } },
  ])('returns null for absent, disabled or blank hero %j', async (settings) => {
    const { getProductListingHero } = await import('@/utilities/products/getProductListingHero')
    getCachedSettings.mockResolvedValue(settings)
    await expect(getProductListingHero()).resolves.toBeNull()
  })

  it.each(['light', 'dark', 'unknown', undefined])(
    'normalizes text and theme %s',
    async (theme) => {
      const { getProductListingHero } = await import('@/utilities/products/getProductListingHero')
      const image = { id: 'hero', url: '/hero.jpg' }
      getCachedSettings.mockResolvedValue({
        product: {
          hero: {
            enabled: true,
            heading: ' Products ',
            description: ' Our range ',
            image,
            headerTheme: theme,
          },
        },
      })
      await expect(getProductListingHero()).resolves.toEqual({
        heading: 'Products',
        description: 'Our range',
        image,
        headerTheme: theme === 'dark' ? 'dark' : 'light',
      })
    },
  )

  it('preserves unpopulated images and normalizes empty descriptions', async () => {
    const { getProductListingHero } = await import('@/utilities/products/getProductListingHero')
    getCachedSettings.mockResolvedValue({
      product: {
        hero: {
          enabled: true,
          heading: 'Products',
          description: '  ',
          image: 'unpopulated',
        },
      },
    })
    await expect(getProductListingHero()).resolves.toMatchObject({
      description: null,
      image: 'unpopulated',
    })
  })
})

describe('getDefaultInquiryButtons', () => {
  it.each([null, {}, { product: {} }, { product: { inquiry: { buttons: [] } } }])(
    'returns no buttons without configuration %j',
    async (settings) => {
      const { getDefaultInquiryButtons } =
        await import('@/utilities/products/getDefaultInquiryButtons')
      getCachedSettings.mockResolvedValue(settings)
      await expect(getDefaultInquiryButtons()).resolves.toEqual([])
    },
  )

  it('returns global buttons in configured order using the shared inquiry defaults', async () => {
    const { getDefaultInquiryButtons } =
      await import('@/utilities/products/getDefaultInquiryButtons')
    const reference = { relationTo: 'pages', value: { id: 'contact', slug: 'contact' } }
    getCachedSettings.mockResolvedValue({
      product: {
        inquiry: {
          buttons: [
            { id: 'first', link: { type: 'custom', url: '/contact', label: 'Contact' } },
            {
              id: 'second',
              link: {
                type: 'reference',
                reference,
                label: 'Enquire',
                appearance: 'outline',
                newTab: true,
              },
            },
          ],
        },
      },
    })
    const result = await getDefaultInquiryButtons()
    expect(result).toEqual([
      { type: 'custom', url: '/contact', label: 'Contact', appearance: 'default' },
      { type: 'reference', reference, label: 'Enquire', appearance: 'outline', newTab: true },
    ])
    expect(getCachedSettings).toHaveBeenCalledTimes(1)
  })
})
