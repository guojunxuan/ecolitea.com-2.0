import { describe, expect, it } from 'vitest'

import { adaptHeaderNavigation } from '@/Header/Nav/adaptNavigation'

const pageReference = (slug: string) => ({
  type: 'reference' as const,
  reference: {
    relationTo: 'pages' as const,
    value: { id: slug, slug, title: slug },
  },
})

const image = {
  id: 'media-1',
  alt: 'Tea system',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  url: '/media/tea.jpg',
}

describe('adaptHeaderNavigation', () => {
  it('normalizes all four block types in source order and exposes only active fields', () => {
    const result = adaptHeaderNavigation({
      id: 'header',
      enableMenuCta: true,
      menuCta: { label: ' Talk to sales ', type: 'custom', url: '/contact' },
      navItems: [
        {
          id: 'solutions',
          label: ' Solutions ',
          navigationType: 'dropdown',
          link: { type: 'custom', url: '/inactive-direct' },
          content: [
            {
              id: 'tabs',
              blockType: 'categoryTabs',
              enableCta: true,
              cta: { label: ' All products ', ...pageReference('products') },
              categories: [
                {
                  id: 'brewing',
                  label: ' Brewing ',
                  enableCta: true,
                  cta: { label: ' Browse brewing ', type: 'custom', url: '/brewing' },
                  items: [
                    {
                      id: 'brewer',
                      image,
                      title: ' Brewer ',
                      link: {
                        label: 'stale card label',
                        type: 'custom',
                        url: '/brewer',
                      },
                    },
                  ],
                },
              ],
            },
            {
              id: 'cards',
              blockType: 'cardGroup',
              enableHeading: true,
              heading: ' Featured ',
              enableCta: false,
              cta: { label: 'Inactive CTA', type: 'custom', url: '/inactive' },
              items: [
                {
                  id: 'visual',
                  image: 'unresolved-media-id',
                  title: ' Visual card ',
                  link: { ...pageReference('visual'), label: 'stale' },
                },
              ],
            },
            {
              id: 'links',
              blockType: 'linkGroup',
              enableHeading: false,
              heading: 'Inactive heading',
              links: [
                {
                  id: 'docs',
                  link: { label: ' Docs ', type: 'custom', url: '/docs', newTab: true },
                },
              ],
            },
            {
              id: 'rich',
              blockType: 'richCard',
              image,
              title: ' Rich card ',
              description: ' A focused story. ',
              link: { type: 'custom', url: '/rich', label: 'stale' },
            },
          ],
        },
      ],
    } as never)

    expect(result).toEqual({
      menuCta: {
        href: '/contact',
        label: 'Talk to sales',
        newTab: false,
        type: 'custom',
      },
      navItems: [
        {
          id: 'solutions',
          label: 'Solutions',
          navigationType: 'dropdown',
          link: null,
          content: [
            {
              id: 'tabs',
              type: 'categoryTabs',
              cta: {
                href: '/products',
                label: 'All products',
                newTab: false,
                type: 'reference',
              },
              categories: [
                {
                  id: 'brewing',
                  label: 'Brewing',
                  cta: {
                    href: '/brewing',
                    label: 'Browse brewing',
                    newTab: false,
                    type: 'custom',
                  },
                  cards: [
                    {
                      id: 'brewer',
                      image,
                      title: 'Brewer',
                      link: {
                        href: '/brewer',
                        label: 'Brewer',
                        newTab: false,
                        type: 'custom',
                      },
                    },
                  ],
                },
              ],
            },
            {
              id: 'cards',
              type: 'cardGroup',
              heading: 'Featured',
              cta: null,
              cards: [
                {
                  id: 'visual',
                  image: null,
                  title: 'Visual card',
                  link: {
                    href: '/visual',
                    label: 'Visual card',
                    newTab: false,
                    type: 'reference',
                  },
                },
              ],
            },
            {
              id: 'links',
              type: 'linkGroup',
              heading: null,
              links: [
                {
                  id: 'docs',
                  link: { href: '/docs', label: 'Docs', newTab: true, type: 'custom' },
                },
              ],
            },
            {
              id: 'rich',
              type: 'richCard',
              description: 'A focused story.',
              card: {
                id: 'rich',
                image,
                title: 'Rich card',
                link: {
                  href: '/rich',
                  label: 'Rich card',
                  newTab: false,
                  type: 'custom',
                },
              },
            },
          ],
        },
      ],
    })
    expect(result.navItems[0]?.content?.[0]?.type).toBe('categoryTabs')
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('filters invalid rows, categories, and blocks while preserving valid siblings', () => {
    const result = adaptHeaderNavigation({
      id: 'header',
      enableMenuCta: true,
      menuCta: { label: 'Broken', type: 'custom', url: '' },
      navItems: [
        {
          id: 'resources',
          label: 'Resources',
          navigationType: 'dropdown',
          content: [
            {
              id: 'tabs',
              blockType: 'categoryTabs',
              enableCta: true,
              cta: { label: 'Broken CTA', type: 'custom', url: '' },
              categories: [
                {
                  id: 'empty-category',
                  label: 'Empty',
                  items: [{ id: 'bad-card', title: 'Broken', link: { type: 'custom', url: '' } }],
                },
                {
                  id: 'valid-category',
                  label: 'Valid',
                  items: [
                    { id: 'blank-title', title: ' ', link: pageReference('blank') },
                    { id: 'valid-card', title: 'Guide', link: pageReference('guide') },
                  ],
                },
              ],
            },
            {
              id: 'empty-card-group',
              blockType: 'cardGroup',
              items: [{ id: 'bad', title: 'Bad', link: { type: 'reference' } }],
            },
            {
              id: 'empty-link-group',
              blockType: 'linkGroup',
              links: [{ id: 'bad', link: { label: 'Bad', type: 'custom', url: '' } }],
            },
            {
              id: 'bad-rich',
              blockType: 'richCard',
              title: 'Bad rich card',
              link: { type: 'custom', url: '' },
            },
            { id: 'unknown', blockType: 'futureBlock', title: 'Ignore me' },
          ],
        },
      ],
    } as never)

    expect(result).toEqual({
      menuCta: null,
      navItems: [
        {
          id: 'resources',
          label: 'Resources',
          navigationType: 'dropdown',
          link: null,
          content: [
            {
              id: 'tabs',
              type: 'categoryTabs',
              cta: null,
              categories: [
                {
                  id: 'valid-category',
                  label: 'Valid',
                  cta: null,
                  cards: [
                    {
                      id: 'valid-card',
                      image: null,
                      title: 'Guide',
                      link: {
                        href: '/guide',
                        label: 'Guide',
                        newTab: false,
                        type: 'reference',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
  })

  it('omits empty dropdown-only items and degrades hybrids with no usable blocks to direct links', () => {
    const result = adaptHeaderNavigation({
      id: 'header',
      navItems: [
        {
          id: 'dropdown',
          label: 'Empty dropdown',
          navigationType: 'dropdown',
          content: [{ blockType: 'linkGroup', links: [] }],
        },
        {
          id: 'hybrid',
          label: 'Company',
          navigationType: 'directLinkAndDropdown',
          link: pageReference('company'),
          content: [{ blockType: 'cardGroup', items: [] }],
        },
        {
          id: 'broken-hybrid',
          label: 'Broken',
          navigationType: 'directLinkAndDropdown',
          link: { type: 'custom', url: '' },
          content: [{ blockType: 'linkGroup', links: [] }],
        },
      ],
    } as never)

    expect(result.navItems).toEqual([
      {
        id: 'hybrid',
        label: 'Company',
        navigationType: 'directLink',
        link: {
          href: '/company',
          label: 'Company',
          newTab: false,
          type: 'reference',
        },
        content: null,
      },
    ])
  })

  it('uses deterministic fallback IDs only when native IDs are malformed', () => {
    const result = adaptHeaderNavigation({
      id: 'header',
      navItems: [
        {
          label: 'Fallbacks',
          navigationType: 'dropdown',
          content: [
            {
              blockType: 'categoryTabs',
              categories: [
                {
                  label: 'Category',
                  items: [{ title: 'Card', link: { type: 'custom', url: '/card' } }],
                },
              ],
            },
            {
              blockType: 'linkGroup',
              links: [{ link: { label: 'Link', type: 'custom', url: '/link' } }],
            },
            {
              blockType: 'richCard',
              title: 'Rich',
              link: { type: 'custom', url: '/rich' },
            },
          ],
        },
      ],
    } as never)

    expect(result.navItems[0]).toMatchObject({
      id: 'nav-item-0',
      content: [
        {
          id: 'nav-item-0-block-0',
          categories: [
            {
              id: 'nav-item-0-block-0-category-0',
              cards: [{ id: 'nav-item-0-block-0-category-0-card-0' }],
            },
          ],
        },
        {
          id: 'nav-item-0-block-1',
          links: [{ id: 'nav-item-0-block-1-link-0' }],
        },
        {
          id: 'nav-item-0-block-2',
          card: { id: 'nav-item-0-block-2' },
        },
      ],
    })
  })
})
