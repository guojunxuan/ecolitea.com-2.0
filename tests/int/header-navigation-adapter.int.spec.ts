import { describe, expect, it } from 'vitest'

import { adaptHeaderNavigation } from '@/Header/Nav/adaptNavigation'

const pageReference = (slug: string, title: string) => ({
  type: 'reference' as const,
  reference: {
    relationTo: 'pages' as const,
    value: { id: slug, slug, title },
  },
})

describe('adaptHeaderNavigation', () => {
  it('maps active direct, dropdown, and hybrid branches without leaking stale branches', () => {
    const richContent = {
      root: { children: [{ text: 'Featured copy', type: 'text' }], type: 'root' },
    }
    const input = {
      id: 'header',
      enableMenuCta: true,
      menuCta: { label: 'Talk to sales', type: 'custom', url: '/contact' },
      navItems: [
        {
          id: 'direct',
          label: 'Pricing',
          navigationType: 'directLink',
          link: { type: 'custom', url: '/pricing', newTab: true },
          dropdown: {
            items: [{ type: 'default', defaultItem: { link: pageReference('stale', 'Stale') } }],
          },
        },
        {
          id: 'dropdown',
          label: 'Solutions',
          navigationType: 'dropdown',
          link: { type: 'custom', url: '/stale-direct' },
          dropdown: {
            description: 'Explore solutions',
            descriptionLinks: [
              {
                id: 'description-1',
                link: { label: 'All solutions', ...pageReference('solutions', 'Solutions') },
              },
              {
                id: 'description-bad',
                link: {
                  label: 'Broken',
                  type: 'reference',
                  reference: { relationTo: 'pages', value: 'id-only' },
                },
              },
            ],
            items: [
              {
                id: 'default-1',
                type: 'default',
                defaultItem: {
                  description: 'For operations teams',
                  link: { label: 'Operations', ...pageReference('operations', 'Operations') },
                },
                featuredItem: { tag: 'Stale', landingLink: pageReference('stale', 'Stale') },
              },
              {
                id: 'featured-1',
                type: 'featured',
                featuredItem: {
                  tag: 'Featured',
                  landingLink: pageReference('featured', 'Featured'),
                  label: richContent,
                  links: [
                    {
                      id: 'feature-link',
                      link: {
                        label: 'Case study',
                        type: 'reference',
                        reference: {
                          relationTo: 'case-studies',
                          value: { id: 'case', slug: 'case-one', title: 'Case one' },
                        },
                      },
                    },
                    { id: 'feature-bad', link: { label: 'Broken', type: 'custom', url: '' } },
                  ],
                },
                listItem: { tag: 'Stale', landingLink: pageReference('stale', 'Stale'), links: [] },
              },
              {
                id: 'list-1',
                type: 'list',
                listItem: {
                  tag: 'Resources',
                  landingLink: {
                    type: 'reference',
                    reference: {
                      relationTo: 'categories',
                      value: { id: 'guides', slug: 'guides', title: 'Guides' },
                    },
                  },
                  links: [
                    {
                      id: 'post-link',
                      link: {
                        label: 'Latest post',
                        type: 'reference',
                        reference: {
                          relationTo: 'posts',
                          value: { id: 'post', slug: 'latest', title: 'Latest' },
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          id: 'hybrid',
          label: 'Company',
          navigationType: 'directLinkAndDropdown',
          link: pageReference('company', 'Company'),
          dropdown: {
            items: [
              {
                id: 'about',
                type: 'default',
                defaultItem: { link: { label: 'About', ...pageReference('about', 'About') } },
              },
            ],
          },
        },
      ],
    }

    const result = adaptHeaderNavigation(input as never)

    expect(result.navItems[0]).toEqual({
      id: 'direct',
      label: 'Pricing',
      navigationType: 'directLink',
      link: { href: '/pricing', label: 'Pricing', newTab: true, type: 'custom' },
      dropdown: null,
    })
    expect(result.navItems[1]?.link).toBeNull()
    expect(result.navItems[1]?.dropdown?.descriptionLinks).toEqual([
      {
        id: 'description-1',
        link: { href: '/solutions', label: 'All solutions', newTab: false, type: 'reference' },
      },
    ])
    expect(result.navItems[1]?.dropdown?.items).toEqual([
      {
        id: 'default-1',
        type: 'default',
        defaultItem: {
          description: 'For operations teams',
          link: { href: '/operations', label: 'Operations', newTab: false, type: 'reference' },
        },
      },
      {
        id: 'featured-1',
        type: 'featured',
        featuredItem: {
          tag: 'Featured',
          landingLink: { href: '/featured', label: 'View all', newTab: false, type: 'reference' },
          label: richContent,
          links: [
            {
              id: 'feature-link',
              link: {
                href: '/case-studies/case-one',
                label: 'Case study',
                newTab: false,
                type: 'reference',
              },
            },
          ],
        },
      },
      {
        id: 'list-1',
        type: 'list',
        listItem: {
          tag: 'Resources',
          landingLink: {
            href: '/posts?category=guides',
            label: 'View all',
            newTab: false,
            type: 'reference',
          },
          links: [
            {
              id: 'post-link',
              link: {
                href: '/posts/latest',
                label: 'Latest post',
                newTab: false,
                type: 'reference',
              },
            },
          ],
        },
      },
    ])
    expect(result.navItems[2]?.link?.label).toBe('Company')
    expect(result.menuCta).toEqual({
      href: '/contact',
      label: 'Talk to sales',
      newTab: false,
      type: 'custom',
    })
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('filters malformed content at the smallest active row and disables CTA explicitly', () => {
    const result = adaptHeaderNavigation({
      id: 'header',
      enableMenuCta: false,
      menuCta: { label: 'Stale CTA', type: 'custom', url: '/contact' },
      navItems: [
        {
          id: 'bad-direct',
          label: 'Broken',
          navigationType: 'directLink',
          link: { type: 'custom', url: '' },
        },
        {
          id: 'mixed-dropdown',
          label: 'Resources',
          navigationType: 'dropdown',
          dropdown: {
            items: [
              {
                id: 'bad',
                type: 'default',
                defaultItem: {
                  link: {
                    label: 'Broken',
                    type: 'reference',
                    reference: { relationTo: 'pages', value: 'id-only' },
                  },
                },
              },
              {
                id: 'good',
                type: 'default',
                defaultItem: { link: { label: 'Docs', type: 'custom', url: '/docs' } },
              },
              {
                id: 'unknown',
                type: 'unknown',
                defaultItem: { link: { label: 'Nope', type: 'custom', url: '/nope' } },
              },
            ],
          },
        },
      ],
    } as never)

    expect(result).toEqual({
      menuCta: null,
      navItems: [
        {
          id: 'mixed-dropdown',
          label: 'Resources',
          navigationType: 'dropdown',
          link: null,
          dropdown: {
            description: null,
            descriptionLinks: [],
            items: [
              {
                id: 'good',
                type: 'default',
                defaultItem: {
                  description: null,
                  link: { href: '/docs', label: 'Docs', newTab: false, type: 'custom' },
                },
              },
            ],
          },
        },
      ],
    })
  })

  it('omits a hybrid row when either active branch is unusable and omits an invalid enabled CTA', () => {
    const result = adaptHeaderNavigation({
      id: 'header',
      enableMenuCta: true,
      menuCta: { label: ' ', type: 'custom', url: '/contact' },
      navItems: [
        {
          id: 'hybrid',
          label: 'Company',
          navigationType: 'directLinkAndDropdown',
          link: pageReference('company', 'Company'),
          dropdown: { items: [] },
        },
      ],
    } as never)

    expect(result).toEqual({ navItems: [], menuCta: null })
  })

  it('forces context labels for top-level and landing links instead of stale stored labels', () => {
    const result = adaptHeaderNavigation({
      id: 'header',
      navItems: [
        {
          id: 'hybrid',
          label: 'Company',
          navigationType: 'directLinkAndDropdown',
          link: { ...pageReference('company', 'Company'), label: 'Stale direct label' },
          dropdown: {
            items: [
              {
                id: 'featured',
                type: 'featured',
                featuredItem: {
                  tag: 'Featured',
                  landingLink: {
                    ...pageReference('featured', 'Featured'),
                    label: 'Stale landing label',
                  },
                },
              },
              {
                id: 'list',
                type: 'list',
                listItem: {
                  tag: 'Resources',
                  landingLink: {
                    ...pageReference('resources', 'Resources'),
                    label: 'Another stale landing label',
                  },
                  links: [],
                },
              },
            ],
          },
        },
      ],
    } as never)

    expect(result.navItems[0]?.link?.label).toBe('Company')
    expect(result.navItems[0]?.dropdown?.items[0]).toMatchObject({
      featuredItem: { landingLink: { label: 'View all' } },
    })
    expect(result.navItems[0]?.dropdown?.items[1]).toMatchObject({
      listItem: { landingLink: { label: 'View all' } },
    })
  })

  it('drops malformed or non-JSON-safe featured rich content without dropping the item', () => {
    const circular: Record<string, unknown> = { root: { children: [], type: 'root' } }
    circular.self = circular

    const featuredItem = (id: string, label: unknown) => ({
      id,
      type: 'featured',
      featuredItem: {
        tag: id,
        landingLink: pageReference(id, id),
        label,
      },
    })

    const result = adaptHeaderNavigation({
      id: 'header',
      navItems: [
        {
          id: 'resources',
          label: 'Resources',
          navigationType: 'dropdown',
          dropdown: {
            items: [
              featuredItem('missing-root', { children: [] }),
              featuredItem('function', {
                root: { children: [], render: () => 'unsafe', type: 'root' },
              }),
              featuredItem('bigint', { root: { children: [], order: BigInt(1), type: 'root' } }),
              featuredItem('circular', circular),
              featuredItem('valid', { root: { children: [], type: 'root', version: 1 } }),
            ],
          },
        },
      ],
    } as never)

    const items = result.navItems[0]?.dropdown?.items
    expect(items?.map((item) => item.type === 'featured' && item.featuredItem.label)).toEqual([
      null,
      null,
      null,
      null,
      { root: { children: [], type: 'root', version: 1 } },
    ])
    expect(() => JSON.stringify(result)).not.toThrow()
  })
})
