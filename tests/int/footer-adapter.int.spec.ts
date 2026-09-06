import { describe, expect, it } from 'vitest'

import { adaptFooter } from '@/Footer/adaptFooter'

const asset = (name: string) => ({
  id: `${name}-id`,
  alt: `${name} alt`,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T01:02:03.000Z',
  url: `/api/brand-assets/file/${name}.svg`,
  width: 120,
  height: 30,
})

const page = (slug: string, title: string) => ({ id: slug, slug, title })

describe('adaptFooter', () => {
  it('maps four columns and ignores the legacy top-level navItems field', () => {
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
                reference: { relationTo: 'posts', value: page('latest', 'Latest news') },
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
                  relationTo: 'categories',
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
        logoDark: asset('inverse'),
      } as never,
    )

    expect(result.columns).toHaveLength(4)
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
            href: '/posts/latest',
            label: 'Latest news',
            newTab: true,
            type: 'reference',
          },
        },
      ],
    })
    expect(result.columns[1]?.navItems[0]?.link.href).toBe('/tea-solutions')
    expect(result.columns[2]?.navItems[0]?.link.href).toBe('/case-studies/customer-story')
    expect(result.columns[2]?.navItems[1]?.link.href).toBe('/posts?category=sustainability')
    expect(result.columns[3]).toEqual({ id: 'company', label: 'Company', navItems: [] })
    expect(JSON.stringify(result)).not.toContain('Legacy')
    expect(result.logo?.src).toContain('/inverse.svg')
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('falls back to the primary logo and Site Name while preserving partial contact data', () => {
    const result = adaptFooter(
      { id: 'footer', columns: [] } as never,
      {
        id: 'site-settings',
        siteName: '  ',
        legalCompanyName: '  Ecolitea Limited  ',
        logo: asset('primary'),
        logoDark: 'unresolved-inverse-id',
        siteDescription: '  Sustainable tea systems.  ',
        salesEmail: ' sales@example.com ',
        phone: null,
        whatsapp: ' +86 138 0000 0000 ',
        address: '',
        businessHours: ' Monday–Friday ',
      } as never,
    )

    expect(result.siteName).toBe('Ecolitea Limited')
    expect(result.logo?.src).toContain('/primary.svg')
    expect(result.siteDescription).toBe('Sustainable tea systems.')
    expect(result.contact).toEqual({
      address: null,
      businessHours: 'Monday–Friday',
      phone: null,
      salesEmail: 'sales@example.com',
      whatsapp: '+86 138 0000 0000',
    })
    expect(result.copyrightText).toBe('© Ecolitea Limited')
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
          src: '/api/brand-assets/file/linkedin.svg?2026-09-01T01%3A02%3A03.000Z',
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
