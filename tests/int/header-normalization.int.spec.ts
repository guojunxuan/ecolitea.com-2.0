import { describe, expect, it } from 'vitest'

import { normalizeHeader } from '@/Header/hooks/normalizeHeader'

const normalize = (data: unknown) => normalizeHeader({ data } as never)

describe('normalizeHeader', () => {
  it('normalizes every Header block without inventing labels on card destinations', () => {
    const input = {
      navItems: [
        {
          label: '  Products  ',
          navigationType: 'directLinkAndDropdown',
          link: { type: 'custom', url: '  /products  ' },
          content: [
            {
              blockType: 'categoryTabs',
              enableCta: true,
              cta: { type: 'custom', label: '  All products  ', url: '  /products/all  ' },
              categories: [
                {
                  label: '  Tea  ',
                  enableCta: true,
                  cta: { type: 'custom', label: '  All tea  ', url: '  /tea  ' },
                  items: [
                    {
                      image: 'media-1',
                      title: '  Green tea  ',
                      link: { type: 'custom', url: '  /tea/green  ' },
                    },
                  ],
                },
              ],
            },
            {
              blockType: 'cardGroup',
              enableHeading: true,
              heading: '  Featured  ',
              enableCta: true,
              cta: { type: 'custom', label: '  View all  ', url: '  /featured  ' },
              items: [
                {
                  image: 'media-2',
                  title: '  Ceremonial matcha  ',
                  link: { type: 'custom', url: '  /matcha  ' },
                },
              ],
            },
            {
              blockType: 'linkGroup',
              enableHeading: true,
              heading: '  Learn  ',
              links: [{ link: { type: 'custom', label: '  Brewing guide  ', url: '  /guide  ' } }],
            },
            {
              blockType: 'richCard',
              image: 'media-3',
              title: '  Our growers  ',
              description: '  Meet the farms  ',
              link: { type: 'custom', url: '  /growers  ' },
            },
          ],
        },
      ],
      enableMenuCta: true,
      menuCta: { type: 'custom', label: '  Contact Us  ', url: '  /contact  ' },
    }

    const result = normalize(input) as typeof input
    const [categoryTabs, cardGroup, linkGroup, richCard] = result.navItems[0].content

    expect(result.navItems[0].label).toBe('Products')
    expect(result.navItems[0].link).toEqual({ type: 'custom', url: '/products' })
    expect(categoryTabs).toMatchObject({
      cta: { label: 'All products', url: '/products/all' },
      categories: [
        {
          label: 'Tea',
          cta: { label: 'All tea', url: '/tea' },
          items: [{ title: 'Green tea', link: { type: 'custom', url: '/tea/green' } }],
        },
      ],
    })
    expect(categoryTabs.categories?.[0]?.items?.[0]?.link).not.toHaveProperty('label')
    expect(cardGroup).toMatchObject({
      heading: 'Featured',
      cta: { label: 'View all', url: '/featured' },
      items: [{ title: 'Ceremonial matcha', link: { type: 'custom', url: '/matcha' } }],
    })
    expect(cardGroup.items?.[0]?.link).not.toHaveProperty('label')
    expect(linkGroup).toMatchObject({
      heading: 'Learn',
      links: [{ link: { label: 'Brewing guide', url: '/guide' } }],
    })
    expect(richCard).toMatchObject({
      title: 'Our growers',
      description: 'Meet the farms',
      link: { type: 'custom', url: '/growers' },
    })
    expect(richCard.link).not.toHaveProperty('label')
    expect(result.menuCta).toMatchObject({ label: 'Contact Us', url: '/contact' })
  })

  it('preserves inactive direct links, content, headings, and CTAs', () => {
    const input = {
      navItems: [
        {
          label: '  About  ',
          navigationType: 'directLink',
          link: { type: 'custom', url: '  /about  ' },
          content: [
            {
              blockType: 'cardGroup',
              enableHeading: false,
              heading: '  Stored heading  ',
              enableCta: false,
              cta: { type: 'custom', label: '  Stored CTA  ', url: '  /stored  ' },
              items: [],
            },
          ],
        },
        {
          label: '  Menu  ',
          navigationType: 'dropdown',
          link: { type: 'custom', url: '  /stored-direct-link  ' },
          content: [],
        },
      ],
      enableMenuCta: false,
      menuCta: { type: 'custom', label: '  Stored menu CTA  ', url: '  /stored-menu-cta  ' },
    }

    const result = normalize(input) as typeof input

    expect(result.navItems[0].content[0]).toMatchObject({
      enableHeading: false,
      heading: 'Stored heading',
      enableCta: false,
      cta: { label: 'Stored CTA', url: '/stored' },
    })
    expect(result.navItems[1].link).toEqual({ type: 'custom', url: '/stored-direct-link' })
    expect(result.navItems[1].content).toEqual([])
    expect(result.menuCta).toMatchObject({ label: 'Stored menu CTA', url: '/stored-menu-cta' })
  })

  it('returns an immutable copy and safely preserves unknown or partial values', () => {
    const unknownBlock = { blockType: 'futureBlock', custom: { value: '  unchanged  ' } }
    const input = { navItems: [null, {}, { content: [null, unknownBlock] }] }
    const result = normalize(input) as typeof input

    expect(result).not.toBe(input)
    expect(result.navItems).not.toBe(input.navItems)
    expect(result.navItems[2]).not.toBe(input.navItems[2])
    expect(result.navItems[2]?.content?.[1]).toEqual(unknownBlock)
    expect(unknownBlock.custom.value).toBe('  unchanged  ')
    expect(normalize(undefined)).toBeUndefined()
    expect(normalize(null)).toBeNull()
    expect(normalize({})).toEqual({})
  })
})
