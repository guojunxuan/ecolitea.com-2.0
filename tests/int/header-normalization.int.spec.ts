import { describe, expect, it } from 'vitest'

import { normalizeHeader } from '@/Header/hooks/normalizeHeader'

const normalize = (data: unknown) => normalizeHeader({ data } as never)

describe('normalizeHeader', () => {
  it('trims Header-owned strings in active and inactive navigation branches plus CTA', () => {
    const richText = { root: { children: [{ text: '  Preserve rich text  ' }] } }
    const input = {
      navItems: [
        {
          label: '  Products  ',
          navigationType: 'directLink',
          link: { type: 'custom', url: '  /products  ' },
          dropdown: {
            description: '  Preserve description  ',
            descriptionLinks: [{ link: { type: 'custom', label: '  Learn  ', url: '  /learn  ' } }],
            items: [
              {
                type: 'default',
                defaultItem: {
                  link: { type: 'custom', label: '  Default  ', url: '  /default  ' },
                  description: '  Preserve item description  ',
                },
                featuredItem: {
                  tag: '  Featured  ',
                  landingLink: { type: 'custom', url: '  /featured  ' },
                  label: richText,
                  links: [{ link: { type: 'custom', label: '  Story  ', url: '  /story  ' } }],
                },
                listItem: {
                  tag: '  Resources  ',
                  landingLink: { type: 'custom', url: '  /resources  ' },
                  links: [{ link: { type: 'custom', label: '  Docs  ', url: '  /docs  ' } }],
                },
              },
            ],
          },
        },
      ],
      enableMenuCta: true,
      menuCta: { type: 'custom', label: '  Contact Us  ', url: '  /contact  ' },
    }

    const result = normalize(input) as typeof input

    expect(result.navItems[0].label).toBe('Products')
    expect(result.navItems[0].link.url).toBe('/products')
    expect(result.navItems[0].dropdown.descriptionLinks[0].link).toMatchObject({
      label: 'Learn',
      url: '/learn',
    })
    expect(result.navItems[0].dropdown.items[0].defaultItem.link).toMatchObject({
      label: 'Default',
      url: '/default',
    })
    expect(result.navItems[0].dropdown.items[0].featuredItem).toMatchObject({
      tag: 'Featured',
      landingLink: { url: '/featured' },
      links: [{ link: { label: 'Story', url: '/story' } }],
    })
    expect(result.navItems[0].dropdown.items[0].listItem).toMatchObject({
      tag: 'Resources',
      landingLink: { url: '/resources' },
      links: [{ link: { label: 'Docs', url: '/docs' } }],
    })
    expect(result.menuCta).toMatchObject({ label: 'Contact Us', url: '/contact' })
    expect(result.navItems[0].dropdown.description).toBe('  Preserve description  ')
    expect(result.navItems[0].dropdown.items[0].defaultItem.description).toBe(
      '  Preserve item description  ',
    )
    expect(result.navItems[0].dropdown.items[0].featuredItem.label).toBe(richText)
  })

  it('returns an immutable normalized copy and preserves case and internal whitespace', () => {
    const input = {
      navItems: [
        { label: '  Keep  My CASE  ', link: { label: '  CTA  Label  ', url: '  #Top  ' } },
      ],
    }

    const result = normalize(input) as typeof input

    expect(result).not.toBe(input)
    expect(result.navItems).not.toBe(input.navItems)
    expect(result.navItems[0]).not.toBe(input.navItems[0])
    expect(result.navItems[0].label).toBe('Keep  My CASE')
    expect(result.navItems[0].link).toMatchObject({ label: 'CTA  Label', url: '#Top' })
    expect(input.navItems[0].label).toBe('  Keep  My CASE  ')
  })

  it('handles null, undefined and partial data safely', () => {
    expect(normalize(undefined)).toBeUndefined()
    expect(normalize(null)).toBeNull()
    expect(normalize({})).toEqual({})
    expect(normalize({ navItems: [null, {}, { dropdown: { items: [null] } }] })).toEqual({
      navItems: [null, {}, { dropdown: { items: [null] } }],
    })
  })
})
