import { describe, expect, it } from 'vitest'

import { adaptFooter } from '@/Footer/adaptFooter'

const asset = (name: string) => ({
  id: `${name}-id`,
  alt: `${name} alt`,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T01:02:03.000Z',
  url: `/api/site-assets/file/${name}.svg`,
  width: 120,
  height: 30,
})

const page = (slug: string, title: string) => ({ id: slug, slug, title })

describe('adaptFooter', () => {
  it('omits automatic copyright when both brand names are blank', () => {
    expect(adaptFooter({} as never, { siteName: ' ', legalCompanyName: ' ' } as never).copyrightText)
      .toBeNull()
  })

  it('prefers the configured site name over the legal name for automatic copyright', () => {
    expect(adaptFooter({} as never, { siteName: ' Tea Studio ', legalCompanyName: 'Example LLC' } as never).copyrightText)
      .toBe('© Tea Studio')
  })

  it('maps valid non-empty columns and ignores legacy or empty navigation data', () => {
    const footer = {
      id: 'footer',
      navItems: [{ link: { label: 'Legacy', type: 'custom', url: '/legacy' } }],
      columns: [
        {
          id: 'products',
          label: 'Products',
          navItems: [
            { id: 'custom', link: { label: 'Overview', type: 'custom', url: '/products' } },
            {
              id: 'reference',
              link: {
                label: 'Latest news',
                type: 'reference',
                newTab: true,
                reference: { relationTo: 'blogs', value: page('latest', 'Latest news') },
              },
            },
          ],
        },
        {
          id: 'solutions',
          label: 'Solutions',
          navItems: [
            {
              id: 'page-reference',
              link: {
                label: 'Tea solutions',
                type: 'reference',
                reference: {
                  relationTo: 'pages',
                  value: page('tea-solutions', 'Tea solutions'),
                },
              },
            },
          ],
        },
        {
          id: 'resources',
          label: 'Resources',
          navItems: [
            {
              id: 'case-study-reference',
              link: {
                label: 'Customer story',
                type: 'reference',
                reference: {
                  relationTo: 'case-studies',
                  value: page('customer-story', 'Customer story'),
                },
              },
            },
            {
              id: 'category-reference',
              link: {
                label: 'Sustainability',
                type: 'reference',
                reference: {
                  relationTo: 'blog-categories',
                  value: page('sustainability', 'Sustainability'),
                },
              },
            },
          ],
        },
        { id: 'company', label: 'Company', navItems: [] },
      ],
    }

    const result = adaptFooter(
      footer as never,
      {
        id: 'site-settings',
        siteName: 'Ecolitea',
        logo: asset('primary'),
      } as never,
    )

    expect(result.columns).toHaveLength(3)
    expect(result.columns[0]).toEqual({
      id: 'products',
      label: 'Products',
      navItems: [
        {
          id: 'custom',
          link: { href: '/products', label: 'Overview', newTab: false, type: 'custom' },
        },
        {
          id: 'reference',
          link: {
            href: '/blogs/latest',
            label: 'Latest news',
            newTab: true,
            type: 'reference',
          },
        },
      ],
    })
    expect(result.columns[1]?.navItems[0]?.link.href).toBe('/tea-solutions')
    expect(result.columns[2]?.navItems[0]?.link.href).toBe('/case-studies/customer-story')
    expect(result.columns[2]?.navItems[1]?.link.href).toBe('/blogs/category/sustainability')
    expect(result.columns.find((column) => column.id === 'company')).toBeUndefined()
    expect(JSON.stringify(result)).not.toContain('Legacy')
    expect(result.logo?.src).toContain('/primary.svg')
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('omits columns whose links are all invalid after link adaptation', () => {
    const result = adaptFooter(
      {
        id: 'footer',
        columns: [
          {
            id: 'invalid',
            label: 'Invalid',
            navItems: [
              { id: 'missing-url', link: { label: 'Missing URL', type: 'custom' } },
              { id: 'missing-label', link: { type: 'custom', url: '/missing-label' } },
            ],
          },
          {
            id: 'valid',
            label: 'Valid',
            navItems: [
              { id: 'overview', link: { label: 'Overview', type: 'custom', url: '/overview' } },
              { id: 'broken', link: { label: 'Broken', type: 'reference' } },
            ],
          },
        ],
      } as never,
      { id: 'site-settings', siteName: 'Ecolitea' } as never,
    )

    expect(result.columns).toEqual([
      {
        id: 'valid',
        label: 'Valid',
        navItems: [
          {
            id: 'overview',
            link: { href: '/overview', label: 'Overview', newTab: false, type: 'custom' },
          },
        ],
      },
    ])
  })

  it('falls back to the primary logo and emits required contact strings without removed fields', () => {
    const result = adaptFooter(
      { id: 'footer', columns: [] } as never,
      {
        id: 'site-settings',
        siteName: '  ',
        legalCompanyName: '  Ecolitea Limited  ',
        logo: asset('primary'),
        siteDescription: '  Sustainable tea systems.  ',
        salesEmail: ' sales@example.com ',
        phone: null,
        whatsapp: ' +86 138 0000 0000 ',
        address: '',
        businessHours: ' Monday–Friday ',
      } as never,
    )

    expect(result).not.toHaveProperty('siteName')
    expect(result.logo?.src).toContain('/primary.svg')
    expect(result.siteDescription).toBe('Sustainable tea systems.')
    expect(result.contact).toEqual({
      address: '',
      phone: '',
      salesEmail: 'sales@example.com',
    })
    expect(result.contact).not.toHaveProperty('businessHours')
    expect(result.contact).not.toHaveProperty('whatsapp')
    expect(result.copyrightText).toBe('© Ecolitea Limited')
  })

  it('maps enabled newsletter content including hidden interface copy', () => {
    const result = adaptFooter(
      { id: 'footer', columns: [] } as never,
      {
        id: 'site-settings',
        siteName: 'Ecolitea',
        newsletter: {
          enabled: true,
          heading: '  Tea notes  ',
          description: '  Product launches and practical insights.  ',
          emailPlaceholder: '  Work email  ',
          buttonLabel: '  Join the list  ',
        },
      } as never,
    )

    expect(result.newsletter).toEqual({
      heading: 'Tea notes',
      description: 'Product launches and practical insights.',
      emailPlaceholder: 'Work email',
      buttonLabel: 'Join the list',
    })
  })

  it.each([
    ['disabled', { enabled: false }],
    ['missing', undefined],
    [
      'incomplete legacy',
      {
        enabled: true,
        heading: 'Tea notes',
        description: null,
        emailPlaceholder: 'Email address',
        buttonLabel: 'Subscribe',
      },
    ],
  ])('omits the newsletter for %s settings', (_label, newsletter) => {
    const result = adaptFooter(
      { id: 'footer', columns: [] } as never,
      { id: 'site-settings', siteName: 'Ecolitea', newsletter } as never,
    )

    expect(result.newsletter).toBeNull()
  })

  it('maps populated social and legal relationships, skips unresolved IDs, and preserves configured copyright', () => {
    const result = adaptFooter(
      { id: 'footer' } as never,
      {
        id: 'site-settings',
        siteName: 'Ecolitea',
        logo: 'unresolved-logo-id',
        socialLinks: [
          {
            id: 'linkedin-row',
            platform: {
              id: 'linkedin',
              platform: 'LinkedIn',
              icon: asset('linkedin'),
              createdAt: '2026-09-01T00:00:00.000Z',
              updatedAt: '2026-09-01T00:00:00.000Z',
            },
            url: ' https://www.linkedin.com/company/ecolitea ',
          },
          { id: 'unresolved', platform: 'platform-id', url: 'https://example.com' },
        ],
        privacyPolicyPage: page('privacy', 'Privacy'),
        termsPage: page('terms', 'Terms'),
        copyrightText: '  © 2026 Ecolitea. All rights reserved.  ',
      } as never,
    )

    expect(result.socialLinks).toEqual([
      {
        id: 'linkedin-row',
        platform: 'LinkedIn',
        url: 'https://www.linkedin.com/company/ecolitea',
        icon: {
          alt: 'linkedin alt',
          height: 30,
          src: '/api/site-assets/file/linkedin.svg?2026-09-01T01%3A02%3A03.000Z',
          width: 120,
        },
      },
    ])
    expect(result.legalLinks).toEqual([
      {
        href: '/privacy',
        label: 'Privacy Policy',
        newTab: false,
        type: 'reference',
      },
      { href: '/terms', label: 'Terms', newTab: false, type: 'reference' },
    ])
    expect(result.logo).toBeNull()
    expect(result.copyrightText).toBe('© 2026 Ecolitea. All rights reserved.')
  })
})

describe('consent legal configuration', () => {
  it('exposes the Cookie Policy relationship and an opt-in emergency disable switch', async () => {
    const { legalTab } = await import('@/SiteSettings/fields/legal')
    expect(legalTab.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'cookiePolicyPage', type: 'relationship', relationTo: 'pages', label: 'Cookie Policy Page' }),
      expect.objectContaining({ name: 'disableGtm', type: 'checkbox', defaultValue: false, label: 'Disable Google Tag Manager', admin: { description: 'Emergency switch. When enabled, Google Tag Manager is never loaded, regardless of visitor consent.' } }),
    ]))
  })
  it('orders configured legal links and omits absent Cookie Policy pages', () => {
    const settings = { id: 'site-settings', privacyPolicyPage: page('privacy', 'Privacy'), cookiePolicyPage: page('cookies', 'Cookies'), termsPage: page('terms', 'Terms') }
    expect(adaptFooter({ id: 'footer' } as never, settings as never).legalLinks.map(({ label }) => label)).toEqual(['Privacy Policy', 'Cookie Policy', 'Terms'])
    expect(adaptFooter({ id: 'footer' } as never, { ...settings, cookiePolicyPage: undefined } as never).legalLinks.map(({ label }) => label)).toEqual(['Privacy Policy', 'Terms'])
  })
})
